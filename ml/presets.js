/**
 * ml/presets.js
 *
 * 12 pre-approved, clinically safe therapy presets for HerComfort.
 *
 * Design principle:
 *   - Every preset was manually vetted: no illegal temp/speed combo is possible.
 *   - Temperature hard-clamped within hardware limits: 36.0°C – 40.0°C.
 *   - Vibration modes are chosen based on published pain physiology assumptions
 *     (Gate Control Theory, sensory adaptation prevention).
 *   - These are ENGINEERING ASSUMPTIONS, not clinically validated treatments.
 *     Subject to review by a clinical advisor before patient use.
 *
 * Preset Feature Encoding for the ML Scorer:
 *   vibrationMode: { CONTINUOUS: 0, PULSE: 1, HARMONIC: 2 }
 *   durationMin:   { 10: 0, 15: 1, 20: 2, 30: 3 }
 */

export const THERAPY_PRESETS = [
  {
    id: 'P01',
    name: 'Gentle Warmth',
    description: 'Light heat, minimal vibration — ideal for mild cramps',
    targetTemp: 37.5,
    vibrationMode: 'PULSE',
    vibrationSpeed: 40,
    durationMin: 10,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P02',
    name: 'Soothing Flow',
    description: 'Moderate heat with harmonic vibration for bloating + mild pain',
    targetTemp: 38.0,
    vibrationMode: 'HARMONIC',
    vibrationSpeed: 50,
    durationMin: 15,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P03',
    name: 'Calm & Release',
    description: 'Continuous low-speed vibration + moderate heat for muscle fatigue',
    targetTemp: 38.0,
    vibrationMode: 'CONTINUOUS',
    vibrationSpeed: 45,
    durationMin: 15,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P04',
    name: 'Deep Comfort',
    description: 'Steady heat + pulse vibration for moderate cramps at rest',
    targetTemp: 38.5,
    vibrationMode: 'PULSE',
    vibrationSpeed: 60,
    durationMin: 15,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P05',
    name: 'Harmonic Relief',
    description: 'Alternating wave vibration to prevent sensory adaptation (>10 min)',
    targetTemp: 38.5,
    vibrationMode: 'HARMONIC',
    vibrationSpeed: 65,
    durationMin: 20,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P06',
    name: 'Active Relief',
    description: 'Higher vibration for upright/walking posture, moderate heat',
    targetTemp: 38.0,
    vibrationMode: 'PULSE',
    vibrationSpeed: 70,
    durationMin: 15,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P07',
    name: 'Spasm Break',
    description: 'High vibration to suppress EMG muscle spasm + strong heat',
    targetTemp: 39.0,
    vibrationMode: 'HARMONIC',
    vibrationSpeed: 75,
    durationMin: 20,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P08',
    name: 'Deep Spasm Relief',
    description: 'Max thermal vasodilation + harmonic burst for severe cramps',
    targetTemp: 39.5,
    vibrationMode: 'HARMONIC',
    vibrationSpeed: 80,
    durationMin: 20,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P09',
    name: 'Intense Wave',
    description: 'High speed continuous vibration for acute severe pain',
    targetTemp: 39.0,
    vibrationMode: 'CONTINUOUS',
    vibrationSpeed: 85,
    durationMin: 15,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P10',
    name: 'Maximum Relief',
    description: 'Maximum safe heat + high harmonic vibration for extreme cramps',
    targetTemp: 40.0,
    vibrationMode: 'HARMONIC',
    vibrationSpeed: 90,
    durationMin: 20,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P11',
    name: 'Extended Calm',
    description: 'Long gentle session for persistent low-grade ache',
    targetTemp: 37.5,
    vibrationMode: 'HARMONIC',
    vibrationSpeed: 45,
    durationMin: 30,
    heatEnabled: true,
    vibEnabled: true,
  },
  {
    id: 'P12',
    name: 'Safe Default',
    description: 'Fallback preset — always safe, conservative, no-risk',
    targetTemp: 37.5,
    vibrationMode: 'PULSE',
    vibrationSpeed: 40,
    durationMin: 15,
    heatEnabled: true,
    vibEnabled: true,
  },
];

/** Preset lookup by ID */
export const PRESET_MAP = Object.fromEntries(
  THERAPY_PRESETS.map((p) => [p.id, p])
);

/** Safe Default fallback — used when inputs are invalid or confidence is low */
export const SAFE_DEFAULT_PRESET = PRESET_MAP['P12'];
