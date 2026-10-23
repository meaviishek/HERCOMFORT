/**
 * ml/safetyInterceptor.js
 *
 * Defense-in-depth safety layer for HerComfort therapy prescriptions.
 *
 * This runs AFTER the ML scorer and BEFORE sending any command to the ESP32.
 * The ML model output is NEVER sent directly to hardware.
 *
 * Safety Rules (in order):
 *  1. Input Validation  — NaN/null/out-of-range sensor → block ML, use safe default
 *  2. Temperature Clamp — Hard clamp to [36.0°C, 40.0°C] (hardware envelope)
 *  3. Speed Clamp       — Hard clamp to [0, 100]
 *  4. Slew Rate Limit   — Max Δtemp = 1.0°C per prescription
 *  5. Contraindication  — Block therapy if pregnancy/pacemaker/skin condition
 *  6. Low Confidence    — If model not loaded, fall back to rule-based safe default
 *
 * ⚠️  Firmware thermal cutoff must also be verified with the ESP32 developer.
 *     Do NOT rely solely on this software layer for hardware safety.
 */

import { SAFE_DEFAULT_PRESET } from './presets.js';

const TEMP_MIN  = 36.0;
const TEMP_MAX  = 40.0;
const SPEED_MIN = 0;
const SPEED_MAX = 100;
const MAX_SLEW_RATE = 1.0; // Max °C change per prescription

/**
 * Validates that context inputs are sane numbers within expected ranges.
 * Returns { valid: boolean, reason: string | null }
 */
export function validateInputs(context) {
  const { painPre, emg, posture } = context;

  if (painPre == null || isNaN(painPre) || painPre < 0 || painPre > 10) {
    return { valid: false, reason: 'INVALID_PAIN_PRE: out of range [0-10] or NaN' };
  }

  if (emg != null && (isNaN(emg) || emg < 0 || emg > 100)) {
    return { valid: false, reason: 'INVALID_EMG: out of range [0-100] or NaN' };
  }

  const validPostures = ['LYING', 'UPRIGHT', 'WALKING', 'UNKNOWN'];
  if (posture != null && !validPostures.includes(posture)) {
    return { valid: false, reason: `INVALID_POSTURE: got '${posture}'` };
  }

  return { valid: true, reason: null };
}

/**
 * Checks for contraindications that should block therapy entirely.
 * Returns { blocked: boolean, reason: string | null }
 */
export function checkContraindications(contraindications = {}) {
  if (contraindications.pregnancy) {
    return { blocked: true, reason: 'CONTRAINDICATION_PREGNANCY' };
  }
  if (contraindications.pacemaker) {
    return { blocked: true, reason: 'CONTRAINDICATION_PACEMAKER' };
  }
  if (contraindications.skinCondition) {
    return { blocked: true, reason: 'CONTRAINDICATION_SKIN_CONDITION' };
  }
  return { blocked: false, reason: null };
}

/**
 * Applies hardware safety clamping to a raw preset recommendation.
 *
 * @param {object} preset            - The ML-recommended preset
 * @param {number} lastSetpointTemp  - The previous session's setpoint (for slew rate)
 * @returns {{ safePreset, wasClamped, clampDetails }}
 */
export function applyHardwareSafety(preset, lastSetpointTemp = null) {
  const clampDetails = {
    originalTargetTemp: preset.targetTemp,
    clampedTargetTemp:  null,
    originalSpeed:      preset.vibrationSpeed,
    clampedSpeed:       null,
    reason:             null,
  };

  let wasClamped = false;
  let safeTemp   = preset.targetTemp;
  let safeSpeed  = preset.vibrationSpeed;
  const reasons  = [];

  // ── 1. Temperature hard clamp ──────────────────────────────────────────────
  if (safeTemp > TEMP_MAX) {
    safeTemp = TEMP_MAX;
    wasClamped = true;
    reasons.push('TEMP_EXCEEDED_MAX_40C');
  }
  if (safeTemp < TEMP_MIN) {
    safeTemp = TEMP_MIN;
    wasClamped = true;
    reasons.push('TEMP_BELOW_MIN_36C');
  }

  // ── 2. Slew Rate: max 1°C jump from last setpoint ─────────────────────────
  if (lastSetpointTemp != null && !isNaN(lastSetpointTemp)) {
    const delta = safeTemp - lastSetpointTemp;
    if (Math.abs(delta) > MAX_SLEW_RATE) {
      safeTemp = lastSetpointTemp + Math.sign(delta) * MAX_SLEW_RATE;
      safeTemp = Math.min(Math.max(safeTemp, TEMP_MIN), TEMP_MAX);
      wasClamped = true;
      reasons.push('SLEW_RATE_EXCEEDED');
    }
  }

  // ── 3. Speed hard clamp ────────────────────────────────────────────────────
  if (safeSpeed > SPEED_MAX) {
    safeSpeed = SPEED_MAX;
    wasClamped = true;
    reasons.push('SPEED_EXCEEDED_MAX');
  }
  if (safeSpeed < SPEED_MIN) {
    safeSpeed = SPEED_MIN;
    wasClamped = true;
    reasons.push('SPEED_BELOW_MIN');
  }

  if (wasClamped) {
    clampDetails.clampedTargetTemp = safeTemp;
    clampDetails.clampedSpeed      = safeSpeed;
    clampDetails.reason            = reasons.join(' | ');
  }

  const safePreset = {
    ...preset,
    targetTemp:     safeTemp,
    vibrationSpeed: safeSpeed,
  };

  return { safePreset, wasClamped, clampDetails };
}

/**
 * Full safety pipeline.
 * Combines input validation + contraindication check + hardware clamping.
 *
 * @param {object} context            - User context features
 * @param {object} rawPreset          - Raw preset from ML scorer
 * @param {object} contraindications  - User contraindication flags
 * @param {number} lastSetpointTemp   - Previous session temperature setpoint
 * @returns {{ finalPreset, settingSource, wasClamped, clampDetails, blocked, blockReason }}
 */
export function runSafetyPipeline(
  context,
  rawPreset,
  contraindications = {},
  lastSetpointTemp = null
) {
  // Step 1: Input validation
  const inputCheck = validateInputs(context);
  if (!inputCheck.valid) {
    console.warn(`[Safety] Input validation failed: ${inputCheck.reason} → fallback`);
    return {
      finalPreset:   SAFE_DEFAULT_PRESET,
      settingSource: 'safety_override',
      wasClamped:    true,
      clampDetails: {
        originalTargetTemp: null,
        clampedTargetTemp:  SAFE_DEFAULT_PRESET.targetTemp,
        originalSpeed:      null,
        clampedSpeed:       SAFE_DEFAULT_PRESET.vibrationSpeed,
        reason:             `NAN_INPUT_DETECTED: ${inputCheck.reason}`,
      },
      blocked:      false,
      blockReason:  null,
    };
  }

  // Step 2: Contraindication check
  const ciCheck = checkContraindications(contraindications);
  if (ciCheck.blocked) {
    console.warn(`[Safety] Contraindication block: ${ciCheck.reason}`);
    return {
      finalPreset:   null,
      settingSource: 'safety_override',
      wasClamped:    false,
      clampDetails:  null,
      blocked:       true,
      blockReason:   ciCheck.reason,
    };
  }

  // Step 3: Hardware clamping
  const { safePreset, wasClamped, clampDetails } = applyHardwareSafety(
    rawPreset,
    lastSetpointTemp
  );

  if (wasClamped) {
    console.warn(`[Safety] Clamp applied: ${clampDetails.reason}`);
  }

  return {
    finalPreset:   safePreset,
    settingSource: wasClamped ? 'safety_override' : undefined, // caller merges with ML source
    wasClamped,
    clampDetails:  wasClamped ? clampDetails : null,
    blocked:       false,
    blockReason:   null,
  };
}
