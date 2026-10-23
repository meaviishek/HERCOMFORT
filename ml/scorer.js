/**
 * ml/scorer.js
 *
 * Pure JavaScript Contextual Preset Scorer.
 *
 * Loaded by the Express backend at startup.
 * Zero external dependencies — works entirely with model_weights.json.
 *
 * Architecture:
 *   score(preset | context) = presetMeanΔPain + contextAdjustment(features, weights)
 *
 * The highest-scoring preset is recommended to the user.
 *
 * Safety is handled AFTER scoring by the safetyInterceptor (separate concern).
 *
 * PILOT TRIAL MODE:
 *   When PILOT_TRIAL_MODE=true, the prescribe() function is bypassed entirely.
 *   Instead, allocateArm() from trial_allocator.js assigns the arm using a
 *   server-side, block-balanced Latin-square sequence.
 *   Propensity is exactly 1/K (uniform) — no epsilon-greedy involved.
 *   The allocator output still passes through the safety interceptor.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { THERAPY_PRESETS, SAFE_DEFAULT_PRESET, PRESET_MAP } from './presets.js';
import { allocateArm, buildArmPreset, PILOT_TRIAL_MODE, PILOT_K } from './trial_allocator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WEIGHTS_PATH = path.join(__dirname, 'models', 'model_weights.json');

// ─── Model State ──────────────────────────────────────────────────────────────
let modelWeights = null;
let modelVersion = 'baseline-rules-v1.0';
let isModelLoaded = false;

// ─── Legacy Epsilon-Greedy Pilot Flag (pre-trial exploration mode) ────────────
/**
 * HERCOMFORT_PILOT_MODE: legacy epsilon-greedy exploration for pre-pilot.
 * DEPRECATED for the formal feasibility study — use PILOT_TRIAL_MODE instead.
 * Retained for backward compatibility with earlier test sessions.
 */
export const PILOT_MODE = process.env.HERCOMFORT_PILOT_MODE === 'true';
const PILOT_EPSILON  = parseFloat(process.env.HERCOMFORT_PILOT_EPSILON  ?? '0.10');
const PILOT_TOP_N    = parseInt(process.env.HERCOMFORT_PILOT_TOP_N      ?? '3', 10);

if (PILOT_TRIAL_MODE) {
  console.log(
    `🔬 [ML Scorer] PILOT_TRIAL_MODE ACTIVE — routing through trial_allocator.js ` +
    `(K=${PILOT_K}, propensity=1/${PILOT_K}, epsilon-greedy DISABLED)`
  );
} else if (PILOT_MODE) {
  console.log(`🧪 [ML Scorer] PILOT MODE ACTIVE (legacy) — epsilon=${PILOT_EPSILON}, topN=${PILOT_TOP_N}`);
}

/**
 * Loads model_weights.json from disk.
 * Called once at server startup. Falls back to rule-based scoring if file missing.
 */
export function loadModel() {
  try {
    if (!fs.existsSync(WEIGHTS_PATH)) {
      console.warn('⚠️  [ML Scorer] model_weights.json not found. Using rule-based fallback.');
      console.warn('   Run: python ml/train_model.py to generate weights.');
      isModelLoaded = false;
      return false;
    }

    const raw = fs.readFileSync(WEIGHTS_PATH, 'utf-8');
    modelWeights = JSON.parse(raw);
    modelVersion = modelWeights.model_version || 'preset-scorer-v1.0';
    isModelLoaded = true;

    console.log(`✅ [ML Scorer] Loaded model: ${modelVersion}`);
    console.log(`   Type: ${modelWeights.model_type}`);
    console.log(`   Dataset: ${modelWeights.training_meta?.dataset}`);
    console.log(`   ⚠️  Disclaimer: ${modelWeights.training_meta?.disclaimer}`);
    return true;
  } catch (err) {
    console.error('[ML Scorer] Failed to load model weights:', err.message);
    isModelLoaded = false;
    return false;
  }
}

/**
 * Normalize a feature value to [0, 1] given its expected range.
 */
function normalize(value, min, max) {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Compute context adjustment score for a given preset using linear weights.
 * Higher score = this preset is expected to give more relief in this context.
 *
 * @param {object} context - Validated user context features
 * @param {object} preset  - One of the 12 therapy presets
 * @returns {number} - Context adjustment (additive to preset's mean ΔPain)
 */
function computeContextAdjustment(context, preset) {
  if (!isModelLoaded || !modelWeights?.feature_weights) {
    return 0; // No adjustment without weights
  }

  const weights = modelWeights.feature_weights;
  const norms = modelWeights.feature_norms || {
    pain_pre:       [0, 10],
    emg:            [0, 100],
    posture:        [0, 2],
    cycle_day:      [1, 28],
    stress:         [0, 10],
    fatigue:        [0, 10],
    took_med:       [0, 1],
    mins_since_med: [0, 240],
  };

  const postureCode = { LYING: 0, UPRIGHT: 1, WALKING: 2, UNKNOWN: 1 };

  const features = {
    pain_pre:       normalize(context.painPre      ?? 5, ...norms.pain_pre),
    emg:            normalize(context.emg          ?? 50, ...norms.emg),
    posture:        normalize(postureCode[context.posture] ?? 1, ...norms.posture),
    cycle_day:      normalize(context.cycleDay     ?? 14, ...norms.cycle_day),
    stress:         normalize(context.stress       ?? 5, ...norms.stress),
    fatigue:        normalize(context.fatigue      ?? 5, ...norms.fatigue),
    took_med:       context.tookMedication ? 1 : 0,
    mins_since_med: normalize(context.minutesSinceMedication ?? 0, ...norms.mins_since_med),
  };

  // Preset strength factor (stronger presets benefit more in high-pain context)
  const presetStrengthFactor = preset.vibrationSpeed / 100.0;
  const painSignal = features.pain_pre;

  // Positive: pain × preset_strength → aggressive preset fits high pain context
  const painPresetInteraction = weights.pain_pre * painSignal * presetStrengthFactor;

  // EMG high → stronger presets are more effective
  const emgSignal = weights.emg * features.emg * presetStrengthFactor;

  // Medication penalty: if medication taken recently, body doesn't need strong preset
  const medPenalty = weights.took_med * features.took_med;

  return painPresetInteraction + emgSignal + medPenalty;
}

/**
 * Score all 12 presets for the given context.
 *
 * Scoring = presetMeanDeltaPain × painMatchFactor + contextAdjustment
 *
 * painMatchFactor: Gentle presets score HIGHER for low pain,
 *                  strong presets score HIGHER for high pain.
 * This prevents the synthetic prior from always returning the strongest preset.
 */
function scoreAllPresets(context) {
  const presetStats = modelWeights?.preset_stats || {};
  const painNorm = Math.max(0, Math.min(1, (context.painPre ?? 5) / 10)); // 0=no pain, 1=max pain

  // Preset "strength" (0=gentle, 1=max): based on vibration speed
  const presetStrength = (preset) => preset.vibrationSpeed / 100;

  return THERAPY_PRESETS.map((preset) => {
    const baseMeanDelta = presetStats[preset.id]?.mean_delta_pain ?? 1.5;
    const strength = presetStrength(preset);

    // Pain-match factor: peaks when preset strength ≈ pain level
    // Gaussian-like: e^(-4 * (strength - painNorm)^2)
    const diff = strength - painNorm;
    const painMatchFactor = Math.exp(-4 * diff * diff);

    const adjustment = computeContextAdjustment(context, preset);

    // Final score: base relief weighted by pain match + context
    const score = baseMeanDelta * painMatchFactor + adjustment * 0.5;

    return {
      presetId: preset.id,
      presetName: preset.name,
      score: Math.round(score * 10000) / 10000,
      presetMeanDeltaPain: baseMeanDelta,
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Rule-based baseline scorer (for comparison / when model is not loaded).
 *
 * This is the existing rule-based system — used as the "Rule-Based" column
 * in the AI vs Rule-Based comparison table on the session screen.
 */
export function ruleBasedPreset(context) {
  const { painPre, emg = 50, posture = 'UPRIGHT', tookMedication = false } = context;

  if (tookMedication) return PRESET_MAP['P12']; // Safe default if medicated

  if (painPre <= 3) {
    return posture === 'LYING' ? PRESET_MAP['P11'] : PRESET_MAP['P01'];
  }
  if (painPre <= 6) {
    if (posture === 'WALKING') return PRESET_MAP['P06'];
    if (emg > 60) return PRESET_MAP['P05'];
    return PRESET_MAP['P04'];
  }
  // Severe (7–10)
  if (posture === 'WALKING') return PRESET_MAP['P09'];
  if (emg > 70) return PRESET_MAP['P08'];
  return PRESET_MAP['P07'];
}

/**
 * Main prescription function.
 *
 * @param {object} context - Validated user context
 * @param {object} options
 * @param {number} options.explorationEpsilon  - Probability of adjacent exploration (default 0.0)
 * @param {string} options.participantId       - Required when PILOT_TRIAL_MODE=true
 * @param {number} options.sessionOrder        - 1-indexed session number; required when PILOT_TRIAL_MODE=true
 * @returns {object} prescription with preset, scores, propensity, model version
 */
export function prescribe(context, options = {}) {
  const startMs = Date.now();

  // ── PILOT TRIAL MODE: block-balanced arm allocation ─────────────────────
  // When PILOT_TRIAL_MODE=true this function routes entirely through
  // trial_allocator.js. Epsilon-greedy is DISABLED — propensity is exactly
  // 1/K (uniform) for every session.
  // The allocator output still passes through the safety interceptor in the
  // calling route (therapy.routes.js) before being delivered to the user.
  if (PILOT_TRIAL_MODE) {
    const { participantId, sessionOrder } = options;
    if (!participantId || !sessionOrder) {
      throw new Error(
        '[scorer] PILOT_TRIAL_MODE=true requires options.participantId and options.sessionOrder. ' +
        'Pass these from therapy.routes.js /prescribe body.'
      );
    }

    const allocation  = allocateArm(participantId, sessionOrder, options.sequenceIndex ?? options.enrollmentOrder);
    const armPreset   = buildArmPreset(allocation.arm);
    const latencyMs   = Date.now() - startMs;

    console.log(
      `[scorer→allocator] participant=${participantId} ` +
      `session=${sessionOrder} arm=${allocation.arm} ` +
      `propensity=${allocation.propensity}`
    );

    return {
      preset:            armPreset,
      modelVersion:      'pilot-trial-v1.0',
      settingSource:     'trial_allocator',
      propensity:        allocation.propensity,
      predictedDeltaPain: null,  // No score prediction in trial mode
      allPresetScores:   null,
      inferenceLatencyMs: latencyMs,
      isModelLoaded,
      // Pilot allocation metadata — persisted in TherapyLog.pilot.*
      pilotTrialMode:    true,
      trialArm:          allocation.arm,
      sessionOrder:      allocation.sessionOrder,
      sequenceIndex:     allocation.sequenceIndex,
      allSequence:       allocation.allSequence,
    };
  }

  // ── Standard path (non-trial, or legacy PILOT_MODE epsilon exploration) ──
  const effectiveEpsilon = PILOT_MODE ? PILOT_EPSILON : (options.explorationEpsilon ?? 0.0);
  const effectiveTopN    = PILOT_MODE ? PILOT_TOP_N   : 3;

  let settingSource = 'fallback_rule';
  let chosenPreset = SAFE_DEFAULT_PRESET;
  let propensity = 1.0;
  let allScores = null;
  let predictedDeltaPain = null;

  if (isModelLoaded) {
    const scores = scoreAllPresets(context);
    allScores = Object.fromEntries(scores.map(s => [s.presetId, s.score]));

    // Restrict exploration pool to topN safe presets only
    const topN = Math.min(effectiveTopN, scores.length);

    // ── Propensity formula (IPS-correct) ────────────────────────────────────
    //
    // Under epsilon-greedy with exploration pool of size N:
    //   P(top-1 | context) = (1 - eps)   [exploit mass]
    //                      + eps / N     [explore share when top-1 is sampled]
    //                      = (1 - eps + eps/N)
    //
    //   P(rank 2..N | context) = eps / N  [only reachable via exploration]
    //
    // These probabilities sum to 1:
    //   P(top-1) + (N-1)*P(other) = (1-eps+eps/N) + (N-1)*(eps/N)
    //                             = 1 - eps + eps/N + eps - eps/N = 1  ✓
    //
    const pExploreEach = round4(effectiveEpsilon / topN);      // eps/N
    const pTop1        = round4(1.0 - effectiveEpsilon + pExploreEach); // (1-eps)+eps/N

    let chosenIndex = 0;
    if (effectiveEpsilon > 0 && Math.random() < effectiveEpsilon) {
      // Explore: uniformly sample from top-N safe presets
      chosenIndex = Math.floor(Math.random() * topN);
      propensity = chosenIndex === 0 ? pTop1 : pExploreEach;
      settingSource = 'ml_recommendation';
    } else {
      // Exploit: always pick top-1 (greedy)
      chosenIndex = 0;
      propensity = pTop1;
      settingSource = 'ml_recommendation';
    }

    chosenPreset = PRESET_MAP[scores[chosenIndex].presetId];
    predictedDeltaPain = round4(scores[chosenIndex].score);

    console.log(
      `[scorer] chosen=${chosenPreset.id} rank=${chosenIndex+1}/${topN}` +
      ` propensity=${propensity} eps=${effectiveEpsilon}` +
      ` legacyPilotMode=${PILOT_MODE}`,
    );
  } else {
    // Rule-based baseline (model not yet loaded)
    chosenPreset = ruleBasedPreset(context);
    settingSource = 'fallback_rule';
    propensity = 1.0;
  }

  const latencyMs = Date.now() - startMs;

  return {
    preset: chosenPreset,
    modelVersion,
    settingSource,
    propensity,
    predictedDeltaPain,
    allPresetScores: allScores,
    inferenceLatencyMs: latencyMs,
    isModelLoaded,
    pilotTrialMode: false,
    pilotMode: PILOT_MODE,
  };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export function getModelVersion() {
  return modelVersion;
}

export function getModelStatus() {
  return {
    isLoaded: isModelLoaded,
    version: modelVersion,
    type: modelWeights?.model_type || 'rule-based-fallback',
  };
}
