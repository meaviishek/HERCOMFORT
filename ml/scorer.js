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
/**
 * Validates model_weights.json schema, version, and dimensions.
 * Rejects malformed or incompatible artifacts before inference.
 */
export function validateModelWeights(weights) {
  if (!weights || typeof weights !== 'object') {
    return { valid: false, reason: 'Weights must be a non-null object' };
  }
  if (!weights.model_version || typeof weights.model_version !== 'string') {
    return { valid: false, reason: 'Missing or invalid model_version string' };
  }
  const expectedFeatures = ["pain_pre_baseline", "emg_pre_rms", "cycle_day", "posture_code", "took_medication"];
  if (!Array.isArray(weights.feature_columns) || weights.feature_columns.length !== expectedFeatures.length) {
    return { valid: false, reason: `feature_columns must be an array of length ${expectedFeatures.length}` };
  }
  for (let i = 0; i < expectedFeatures.length; i++) {
    if (weights.feature_columns[i] !== expectedFeatures[i]) {
      return { valid: false, reason: `feature_columns mismatch at index ${i}: expected ${expectedFeatures[i]}, got ${weights.feature_columns[i]}` };
    }
  }
  if (!weights.scaler || !Array.isArray(weights.scaler.mean) || !Array.isArray(weights.scaler.scale)) {
    return { valid: false, reason: 'scaler must contain mean and scale arrays' };
  }
  if (weights.scaler.mean.length !== expectedFeatures.length || weights.scaler.scale.length !== expectedFeatures.length) {
    return { valid: false, reason: `scaler mean and scale arrays must have length ${expectedFeatures.length}` };
  }
  if (!weights.arm_models || typeof weights.arm_models !== 'object') {
    return { valid: false, reason: 'arm_models must be an object' };
  }
  for (const [armKey, armModel] of Object.entries(weights.arm_models)) {
    if (typeof armModel !== 'object' || armModel === null) {
      return { valid: false, reason: `arm model for ${armKey} must be an object` };
    }
    if (armModel.is_fallback) {
      if (typeof armModel.fallback_reason !== 'string') {
        return { valid: false, reason: `fallback arm ${armKey} must specify fallback_reason` };
      }
    } else {
      if (typeof armModel.intercept !== 'number' || !Number.isFinite(armModel.intercept)) {
        return { valid: false, reason: `trained arm ${armKey} must have finite numeric intercept` };
      }
      if (!Array.isArray(armModel.coefficients) || armModel.coefficients.length !== expectedFeatures.length) {
        return { valid: false, reason: `trained arm ${armKey} coefficients must have length ${expectedFeatures.length}` };
      }
      if (!armModel.coefficients.every(c => typeof c === 'number' && Number.isFinite(c))) {
        return { valid: false, reason: `trained arm ${armKey} coefficients must all be finite numbers` };
      }
    }
  }
  return { valid: true };
}

/**
 * Loads model_weights.json from disk.
 * Called once at server startup. Falls back to rule-based scoring if file missing or invalid.
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
    const parsed = JSON.parse(raw);
    const validation = validateModelWeights(parsed);
    if (!validation.valid) {
      console.error(`❌ [ML Scorer] Model weights validation failed: ${validation.reason}`);
      isModelLoaded = false;
      modelWeights = null;
      return false;
    }

    modelWeights = parsed;
    modelVersion = modelWeights.model_version || 'preset-scorer-v1.0';
    isModelLoaded = true;

    console.log(`✅ [ML Scorer] Loaded model: ${modelVersion}`);
    console.log(`   Type: ${modelWeights.model_type}`);
    console.log(`   Dataset type: ${modelWeights.training_meta?.dataset_type}`);
    console.log(`   Trained at: ${modelWeights.training_meta?.trained_at}`);
    console.log(`   ⚠️  Disclaimer: ${modelWeights.training_meta?.disclaimer}`);

    // Warn on fallback arms so operator knows which arms lack learned weights
    const fallbackArms = Object.entries(modelWeights.arm_models || {})
      .filter(([, m]) => m.is_fallback)
      .map(([arm]) => arm);
    if (fallbackArms.length > 0) {
      console.warn(`⚠️  [ML Scorer] FALLBACK arms (not learned — will not produce ML scores): ${fallbackArms.join(', ')}`);
    }
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
 * Evaluate the exact trained model from model_weights.json.
 * Zero discrepancy with Python training pipeline.
 *
 * Prediction formula:
 *   y_hat(X, a) = intercept[a] + sum_j( coeff[a][j] * (X[j] - mean[j]) / scale[j] )
 *
 * @param {object} context - User context features
 * @returns {Array} - Presets sorted descending by predicted DeltaPain
 */
export function scoreAllPresets(context) {
  if (!isModelLoaded || !modelWeights?.arm_models) {
    // Graceful fallback to rule-based ranking if weights not loaded
    const defaultPreset = ruleBasedPreset(context);
    return THERAPY_PRESETS.map((p) => ({
      presetId: p.id,
      presetName: p.name,
      score: null,
      predictedDeltaPain: null,
      isFallback: true,
      fallbackReason: 'MODEL_NOT_LOADED',
      settingSource: 'fallback_rule',
    })).sort((a, b) => (a.presetId === defaultPreset.id ? -1 : 1));
  }

  const scaler = modelWeights.scaler || { mean: [], scale: [] };
  const imputation = modelWeights.imputation || {};
  const postureCode = { LYING: 0.0, UPRIGHT: 1.0, WALKING: 2.0, UNKNOWN: 1.0 };

  // Normalized features aligned with train_model.py FEATURE_COLUMNS:
  // ["pain_pre_baseline", "emg_pre_rms", "cycle_day", "posture_code", "took_medication"]
  // Imputation values are fitted on training data and persisted in the artifact
  const rawFeatures = [
    context.painPre_baseline ?? context.painPre ?? imputation.pain_pre_baseline ?? 5.0,
    context.emg_pre_rms ?? context.emg ?? imputation.emg_pre_rms ?? 35.0,
    context.cycleDay ?? imputation.cycle_day ?? 14.0,
    postureCode[context.posture] ?? imputation.posture_code ?? 1.0,
    context.tookMedication != null
      ? (context.tookMedication ? 1.0 : 0.0)
      : (imputation.took_medication ?? 0.0),
  ];

  const scaledFeatures = rawFeatures.map((val, idx) => {
    const mean = scaler.mean?.[idx] ?? 0.0;
    const scale = scaler.scale?.[idx] ?? 1.0;
    return scale !== 0 ? (val - mean) / scale : 0.0;
  });

  return THERAPY_PRESETS.map((preset) => {
    // Resolve the arm model for this preset by arm label or vibration mode
    const armKey = preset.id === 'ARM_HEAT_ONLY' || preset.vibrationMode === 'OFF'
      ? 'ARM_HEAT_ONLY'
      : preset.vibrationMode === 'HARMONIC'
        ? 'ARM_HEAT_HARMONIC'
        : 'ARM_HEAT_PULSE';

    const model = modelWeights.arm_models[preset.id]
               || modelWeights.arm_models[preset.presetId]
               || modelWeights.arm_models[armKey];

    // If the arm is marked as fallback (no learned weights), do not produce a
    // spurious score. Return a clearly labeled fallback so callers can
    // distinguish a learned prediction from a hard-coded prior.
    if (!model || model.is_fallback) {
      return {
        presetId: preset.id,
        presetName: preset.name,
        arm: armKey,
        score: null,
        predictedDeltaPain: null,
        isFallback: true,
        fallbackReason: model?.fallback_reason ?? 'NO_ARM_MODEL',
        settingSource: 'fallback_untrained',
      };
    }

    let pred = model.intercept ?? 0.0;
    if (Array.isArray(model.coefficients)) {
      for (let j = 0; j < model.coefficients.length; j++) {
        pred += model.coefficients[j] * (scaledFeatures[j] || 0.0);
      }
    }

    return {
      presetId: preset.id,
      presetName: preset.name,
      arm: armKey,
      score: Math.round(pred * 10000) / 10000,
      predictedDeltaPain: Math.round(pred * 100) / 100,
      isFallback: false,
      settingSource: 'ml_model',
    };
  })
  // Sort: trained predictions first (desc by score), fallbacks last
  .sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });
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
  const isTrialActive = process.env.PILOT_TRIAL_MODE !== undefined
    ? process.env.PILOT_TRIAL_MODE === 'true'
    : PILOT_TRIAL_MODE;

  if (isTrialActive) {
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

    // Isolate trained, non-fallback arms only (arms with is_fallback: false and numeric scores)
    const trainedScores = scores.filter(s => !s.isFallback && s.score !== null && Number.isFinite(s.score));

    if (trainedScores.length === 0) {
      // All arms in artifact are fallback arms — cannot provide ML recommendations
      chosenPreset = ruleBasedPreset(context);
      settingSource = 'fallback_untrained';
      propensity = 1.0;
      predictedDeltaPain = null;
    } else {
      // Restrict exploration pool to topN safe trained presets only
      const topN = Math.min(effectiveTopN, trainedScores.length);

      // ── Propensity formula (IPS-correct) ────────────────────────────────────
      const pExploreEach = round4(effectiveEpsilon / topN);      // eps/N
      const pTop1        = round4(1.0 - effectiveEpsilon + pExploreEach); // (1-eps)+eps/N

      let chosenIndex = 0;
      if (effectiveEpsilon > 0 && Math.random() < effectiveEpsilon) {
        // Explore: uniformly sample from top-N safe trained presets
        chosenIndex = Math.floor(Math.random() * topN);
        propensity = chosenIndex === 0 ? pTop1 : pExploreEach;
      } else {
        // Exploit: always pick top-1 (greedy)
        chosenIndex = 0;
        propensity = pTop1;
      }

      chosenPreset = PRESET_MAP[trainedScores[chosenIndex].presetId] || SAFE_DEFAULT_PRESET;
      predictedDeltaPain = round4(trainedScores[chosenIndex].score);
      settingSource = 'ml_recommendation';

      console.log(
        `[scorer] chosen=${chosenPreset.id} rank=${chosenIndex+1}/${topN}` +
        ` propensity=${propensity} eps=${effectiveEpsilon}` +
        ` legacyPilotMode=${PILOT_MODE}`,
      );
    }
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
  const fallbackArms = Object.entries(modelWeights?.arm_models || {})
    .filter(([, m]) => m.is_fallback)
    .map(([arm]) => arm);
  return {
    isLoaded: isModelLoaded,
    version: modelVersion,
    type: modelWeights?.model_type || 'rule-based-fallback',
    datasetType: modelWeights?.training_meta?.dataset_type ?? null,
    isSyntheticModel: modelWeights?.training_meta?.dataset_type === 'SYNTHETIC_DEVELOPMENT',
    hasFallbackArms: fallbackArms.length > 0,
    fallbackArms,
    disclaimer: modelWeights?.training_meta?.disclaimer ?? null,
  };
}

export function scorePresets(context, options = {}) {
  const ranked = scoreAllPresets(context);
  const eps = options.epsilon ?? 0.0;
  return {
    success: true,
    rankedPresets: ranked.map(p => ({ ...p, propensity: 1 / ranked.length })),
    recommendedPreset: ranked[0] || null,
  };
}
