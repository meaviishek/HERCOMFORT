/**
 * ml/trial_allocator.js
 *
 * Server-side, block-balanced Latin-square arm allocator.
 *
 * PURPOSE
 * -------
 * Replaces epsilon-greedy exploration in PILOT_TRIAL_MODE.
 * Assigns a fixed 3-arm sequence to each participant at enrollment
 * (within-person crossover) using balanced permuted blocks so that
 * no arm is systematically assigned earlier or later in the study.
 *
 * DESIGN DECISIONS
 * ----------------
 * • Propensity is exactly 1/K (uniform) for every session.
 *   This avoids propensity extremes and enables valid IPS/weighted analysis.
 * • Allocation is deterministic given participantId + sessionOrder —
 *   fully reproducible and auditable without storing extra state.
 * • All allocations pass through the safety interceptor in the caller
 *   (therapy.routes.js). The allocator only outputs a preset spec;
 *   the safety interceptor has the final word on what is delivered.
 * • Participants may DECREASE heat/intensity during a session (logged as
 *   user modification). Analysis is intention-to-treat by assigned arm.
 *
 * ARMS (K = 3)
 * ------------
 *   ARM_HEAT_ONLY      – Thermal arm (motor OFF).
 *                        Hypothesis (unconfirmed): heat alone may reduce pain
 *                        via increased local perfusion and muscle relaxation.
 *   ARM_HEAT_PULSE     – Heat + PULSE vibration.
 *                        Hypothesis (unconfirmed): rhythmic mechanical stimulation
 *                        may modulate pain perception — not established in this population.
 *   ARM_HEAT_HARMONIC  – Heat + HARMONIC vibration.
 *                        Hypothesis (unconfirmed): low-frequency harmonic sweep
 *                        may assist deep pelvic floor relaxation — exploratory.
 *
 * Heat setpoint: PILOT_HEAT_SETPOINT (default 39.0°C, requires clinician approval
 * to change). Must not exceed safety interceptor ceiling of 40.0°C.
 *
 * Usage (in therapy.routes.js):
 *   import { allocateArm, buildArmPreset, PILOT_K } from '../../../../ml/trial_allocator.js';
 *   const { arm, sessionOrder, propensity } = allocateArm(participantId, sessionIndex);
 *   const armPreset = buildArmPreset(arm);
 *   // Then pass armPreset through runSafetyPipeline(...)
 */

// ── Pilot Configuration ───────────────────────────────────────────────────────
export const PILOT_K            = parseInt(process.env.PILOT_K             ?? '3', 10);
export const PILOT_HEAT_SETPOINT = parseFloat(process.env.PILOT_HEAT_SETPOINT ?? '39.0');
export const PILOT_TRIAL_MODE   = process.env.PILOT_TRIAL_MODE === 'true';

if (PILOT_HEAT_SETPOINT > 40.0) {
  throw new Error(
    `[TrialAllocator] PILOT_HEAT_SETPOINT=${PILOT_HEAT_SETPOINT} exceeds safety ceiling of 40.0°C. ` +
    'Adjust PILOT_HEAT_SETPOINT to ≤40.0 or obtain clinician approval.'
  );
}

if (PILOT_TRIAL_MODE) {
  console.log(
    `🔬 [TrialAllocator] PILOT_TRIAL_MODE ACTIVE — K=${PILOT_K}, ` +
    `heatSetpoint=${PILOT_HEAT_SETPOINT}°C, propensity=1/${PILOT_K}=${(1/PILOT_K).toFixed(4)}`
  );
}

// ── Arm Definitions ───────────────────────────────────────────────────────────
/**
 * The three arms of the pilot feasibility study.
 * Descriptions intentionally avoid causal mechanism claims — all are hypotheses.
 */
export const TRIAL_ARMS = {
  ARM_HEAT_ONLY: {
    id:            'ARM_HEAT_ONLY',
    label:         'Thermal Arm',
    vibrationMode: 'OFF',
    vibrationSpeed: 0,
    description:   'Thermal heat only at configured setpoint. Serves as the active comparator arm.',
  },
  ARM_HEAT_PULSE: {
    id:            'ARM_HEAT_PULSE',
    label:         'Thermo-Pulsed Arm',
    vibrationMode: 'PULSE',
    vibrationSpeed: 80,
    description:   'Heat plus pulsed vibration at 80% intensity. Exploratory arm — mechanism unconfirmed. ' +
                   'Hypothesis: rhythmic mechanical stimulation may modulate pain perception (unverified in this population).',
  },
  ARM_HEAT_HARMONIC: {
    id:            'ARM_HEAT_HARMONIC',
    label:         'Harmonic Arm',
    vibrationMode: 'HARMONIC',
    vibrationSpeed: 80,
    description:   'Heat plus harmonic vibration sweep at 80% intensity. Exploratory arm — mechanism unconfirmed.',
  },
};

const ARM_KEYS = Object.keys(TRIAL_ARMS); // ['ARM_HEAT_ONLY', 'ARM_HEAT_PULSE', 'ARM_HEAT_HARMONIC']

// ── Latin-Square Block Sequences ─────────────────────────────────────────────
/**
 * All 6 permutations of 3 arms (balanced Latin square).
 * Each participant is assigned one permutation at enrollment.
 * The 6 permutations ensure that across every 6 consecutive participants:
 *   - Each arm appears exactly twice in position 1, 2, and 3.
 *   - No systematic first-session or last-session bias.
 *
 * Permutations are indexed 0–5.
 */
const LATIN_SQUARE_SEQUENCES = [
  [0, 1, 2],  // A B C
  [0, 2, 1],  // A C B
  [1, 0, 2],  // B A C
  [1, 2, 0],  // B C A
  [2, 0, 1],  // C A B
  [2, 1, 0],  // C B A
];

import fs from 'fs';

// ── Load Permuted-Block Randomization Sequences ─────────────────────────────
const sequencesFileUrl = new URL('./sequences.json', import.meta.url);
const sequencesData = JSON.parse(fs.readFileSync(sequencesFileUrl, 'utf-8'));

export const RANDOMIZATION_SEED = sequencesData.seed;
export const BLOCK_SIZE = sequencesData.blockSize || 6;
export const PREGENERATED_BLOCKS = sequencesData.blocks;

/**
 * Get the sequence index (0–5) assigned to a given enrollment order (1-indexed).
 * Evaluates blocks of 6 sequences generated from the fixed seed.
 *
 * @param {number} enrollmentOrder - 1-indexed enrollment sequence number (1, 2, 3...)
 * @returns {number} Sequence index 0–5
 */
export function getSequenceIndexForEnrollment(enrollmentOrder) {
  if (!enrollmentOrder || enrollmentOrder < 1) {
    throw new Error(`[TrialAllocator] enrollmentOrder must be an integer >= 1, got: ${enrollmentOrder}`);
  }
  const zeroIndex = enrollmentOrder - 1;
  const blockIndex = Math.floor(zeroIndex / BLOCK_SIZE);
  const inBlockIndex = zeroIndex % BLOCK_SIZE;

  if (blockIndex >= PREGENERATED_BLOCKS.length) {
    throw new Error(
      `[TrialAllocator] enrollmentOrder ${enrollmentOrder} exceeds pregenerated blocks capacity (${PREGENERATED_BLOCKS.length * BLOCK_SIZE})`
    );
  }
  return PREGENERATED_BLOCKS[blockIndex][inBlockIndex];
}

/**
 * Get array of arm keys for a given sequence index (0–5).
 * @param {number} sequenceIndex
 * @returns {string[]}
 */
export function getSequenceArmsForIndex(sequenceIndex) {
  const seq = LATIN_SQUARE_SEQUENCES[sequenceIndex];
  if (!seq) {
    throw new Error(`[TrialAllocator] Invalid sequenceIndex: ${sequenceIndex}`);
  }
  return seq.map((i) => ARM_KEYS[i]);
}

/**
 * Computes exact distribution of sequence assignments and arm allocations
 * across sessions for N simulated enrollments.
 *
 * @param {number} nParticipants - Number of participants (e.g. 25, 30)
 * @returns {object}
 */
export function getEnrollmentDistribution(nParticipants) {
  const sequenceCounts = [0, 0, 0, 0, 0, 0];
  const armsBySession = {
    1: { ARM_HEAT_ONLY: 0, ARM_HEAT_PULSE: 0, ARM_HEAT_HARMONIC: 0 },
    2: { ARM_HEAT_ONLY: 0, ARM_HEAT_PULSE: 0, ARM_HEAT_HARMONIC: 0 },
    3: { ARM_HEAT_ONLY: 0, ARM_HEAT_PULSE: 0, ARM_HEAT_HARMONIC: 0 },
  };
  const totalArms = { ARM_HEAT_ONLY: 0, ARM_HEAT_PULSE: 0, ARM_HEAT_HARMONIC: 0 };

  for (let order = 1; order <= nParticipants; order++) {
    const sIdx = getSequenceIndexForEnrollment(order);
    sequenceCounts[sIdx]++;
    const seq = LATIN_SQUARE_SEQUENCES[sIdx];
    for (let sess = 1; sess <= PILOT_K; sess++) {
      const armKey = ARM_KEYS[seq[sess - 1]];
      armsBySession[sess][armKey]++;
      totalArms[armKey]++;
    }
  }

  return {
    nParticipants,
    seed: RANDOMIZATION_SEED,
    fullBlocks: Math.floor(nParticipants / BLOCK_SIZE),
    partialBlockRemaining: nParticipants % BLOCK_SIZE,
    sequenceDistribution: sequenceCounts,
    armsBySession,
    totalArms,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Allocate the arm for a given participant's Nth session.
 *
 * @param {string} participantId    - De-identified participant ID (e.g. "P001")
 * @param {number} sessionOrder     - 1-indexed session number for this participant (1, 2, 3)
 * @param {number|null} sequenceIndexOrEnrollmentOrder - sequence index (0-5) or enrollment order (1..N)
 * @returns {{
 *   arm: string,            // Arm ID, e.g. "ARM_HEAT_PULSE"
 *   armLabel: string,       // Human-readable label
 *   sessionOrder: number,   // Same as input, for logging
 *   sequenceIndex: number,  // Which Latin-square sequence this participant is on
 *   propensity: number,     // Always 1/K = 0.3333
 *   allSequence: string[],  // Full 3-arm sequence for audit log
 * }}
 */
export function allocateArm(participantId, sessionOrder, sequenceIndexOrEnrollmentOrder = null) {
  if (!participantId || typeof participantId !== 'string') {
    throw new Error('[TrialAllocator] participantId must be a non-empty string.');
  }
  if (!Number.isInteger(sessionOrder) || sessionOrder < 1 || sessionOrder > PILOT_K) {
    throw new Error(
      `[TrialAllocator] sessionOrder must be an integer 1–${PILOT_K}, got: ${sessionOrder}`
    );
  }

  let sequenceIndex;
  if (sequenceIndexOrEnrollmentOrder != null) {
    if (sequenceIndexOrEnrollmentOrder >= 0 && sequenceIndexOrEnrollmentOrder <= 5) {
      sequenceIndex = sequenceIndexOrEnrollmentOrder;
    } else {
      sequenceIndex = getSequenceIndexForEnrollment(sequenceIndexOrEnrollmentOrder);
    }
  } else {
    // Check if participantId has numeric ID (e.g. "P001" -> enrollmentOrder 1)
    const match = participantId.match(/^P(\d+)$/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      const enrollmentOrder = parsed > 0 ? parsed : 1;
      sequenceIndex = getSequenceIndexForEnrollment(enrollmentOrder);
    } else {
      sequenceIndex = getSequenceIndexForEnrollment(1);
    }
  }

  const sequence      = LATIN_SQUARE_SEQUENCES[sequenceIndex];
  const armIndex      = sequence[sessionOrder - 1];       // 0-indexed
  const armKey        = ARM_KEYS[armIndex];
  const arm           = TRIAL_ARMS[armKey];
  const allSequence   = sequence.map((i) => ARM_KEYS[i]);

  console.log(
    `[TrialAllocator] participant=${participantId} ` +
    `session=${sessionOrder}/${PILOT_K} ` +
    `→ arm=${armKey} ` +
    `(sequence: ${allSequence.join(' → ')}) ` +
    `propensity=${(1 / PILOT_K).toFixed(4)}`
  );

  return {
    arm:           armKey,
    armLabel:      arm.label,
    sessionOrder,
    sequenceIndex,
    propensity:    parseFloat((1 / PILOT_K).toFixed(6)),
    allSequence,
  };
}

/**
 * Build a preset specification from an allocated arm.
 * The result shape is compatible with the safety interceptor input.
 *
 * @param {string} armKey - Arm ID (e.g. "ARM_HEAT_PULSE")
 * @returns {object} Preset spec compatible with runSafetyPipeline
 */
export function buildArmPreset(armKey) {
  const arm = TRIAL_ARMS[armKey];
  if (!arm) {
    throw new Error(`[TrialAllocator] Unknown arm: ${armKey}. Valid arms: ${ARM_KEYS.join(', ')}`);
  }
  return {
    id:            armKey,
    name:          arm.label,
    targetTemp:    PILOT_HEAT_SETPOINT,    // configurable, default 39.0°C
    vibrationMode: arm.vibrationMode,
    vibrationSpeed: arm.vibrationSpeed,
    durationMin:   20,                     // fixed 20-min sessions for pilot
    description:   arm.description,
  };
}

/**
 * Verify allocator correctness: run blocks and assert arm distribution is balanced.
 * Called at startup in PILOT_TRIAL_MODE for fast fail.
 */
export function selfTest() {
  const dist30 = getEnrollmentDistribution(30);
  const balanced30 = Object.values(dist30.totalArms).every((count) => count === 30);

  if (!balanced30) {
    throw new Error(
      `[TrialAllocator] Self-test FAILED — arm distribution is unbalanced for 30 participants: ` +
      JSON.stringify(dist30.totalArms)
    );
  }

  console.log(
    `✅ [TrialAllocator] Self-test PASSED — ` +
    `seed=${RANDOMIZATION_SEED}, 30 enrollments: each arm=30 allocations, propensity=1/${PILOT_K}.`
  );
  return true;
}

// Run self-test at module load in PILOT_TRIAL_MODE
if (PILOT_TRIAL_MODE) {
  selfTest();
}

