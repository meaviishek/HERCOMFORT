# HerComfort Pilot Study Protocol — v1.0

> **Status:** Draft for internal review. Not cleared for participant use until reviewed by a qualified healthcare professional.

---

## 1. Study Purpose

HerComfort is a wearable abdominal belt delivering controlled **heat** and **vibration** to relieve menstrual pain. This pilot collects real-world session data from a small cohort (target **10–30 participants, ≥3 sessions each**) to:

1. Validate that the rule-based preset system provides measurable relief.
2. Build a labelled dataset sufficient to train a real personalised preset-ranking model (see §8).
3. Measure safety: confirm no adverse thermal or motor events.

---

## 2. Participant Consent Text

> **⚠️ DRAFT — Needs mentor / ethics board review before use with real participants.**
> **Do NOT show this text to participants until it has been reviewed and signed off.**

> *Please read this carefully before your first session.*
>
> **What we are collecting:**
> Each therapy session records your pain level before and after (0–10 scale), which preset the device applied, sensor readings (temperature, EMG muscle activity), and optional context (stress, fatigue, cycle day). Your identity is replaced with an anonymous participant ID — your name and contact details are stored separately and will not appear in any dataset shared outside the research team.
>
> **How data is used:**
> Session data is used solely to improve HerComfort's preset recommendations. It will not be sold, shared with insurers, or used for any purpose other than improving this product.
>
> **Your rights:**
> You may withdraw at any time by pressing the **STOP** button on the device or in the app. Withdrawal will not affect your access to the product. You may request deletion of all your data by contacting the research team.
>
> **Risks:**
> Heat therapy is generally safe for healthy adults. The device is limited to a maximum temperature of **40 degrees C** and will not exceed this limit. If you feel burning, unusual pain, or discomfort, press STOP immediately and remove the belt.
>
> **By starting a session you confirm:**
> - You have read and understood this consent text.
> - You are not pregnant.
> - You do not have an implanted pacemaker or cardiac device.
> - You have no open wounds, rashes, or skin infections at the belt contact area.
> - You are 18 years of age or older.

---

## 3. Exclusion Criteria (Safety Checklist — Pre-Session)

The app **blocks** therapy if any of the following contraindications are flagged during session start:

| # | Criterion | Field checked | Code reference |
|---|-----------|--------------|----------------|
| 1 | Confirmed pregnancy | `contraindications.pregnancy = true` | TherapyLog.js L196; therapy.routes.js L128 |
| 2 | Implanted pacemaker or ICD | `contraindications.pacemaker = true` | TherapyLog.js L198; therapy.routes.js L129 |
| 3 | Active skin lesion or infection at belt site | `contraindications.skinCondition = true` | TherapyLog.js L200; therapy.routes.js L130 |
| 4 | Under 18 years of age | Account-level field — add before recruitment | — |

When any criterion is `true`, safetyInterceptor.js sets `safety.blocked = true` and therapy is refused with HTTP 200 + `blocked: true` (therapy.routes.js L90–97).

---

## 4. Heat Limits and Safety Ceilings

| Parameter | Ceiling | Enforcement location |
|-----------|---------|---------------------|
| Max heater setpoint | 40.0 degrees C | safetyInterceptor.js TEMP_EXCEEDED_MAX clamp |
| Min heater setpoint | 36.0 degrees C | safetyInterceptor.js TEMP_BELOW_MIN clamp |
| Max slew rate | 1.0 degree C per step | safetyInterceptor.js SLEW_RATE_EXCEEDED |
| Max session duration | 60 min (hard ceiling) | session.tsx auto-stop timer |
| Stop button | Immediate motor + heater off | session.tsx handleStopSession() |

All clamp events are logged in `TherapyLog.mlAudit.wasClamped` and `clampDetails.reason` (TherapyLog.js L126–147).

---

## 5. Data Fields Collected Per Session

### 5a. pilot_sessions.csv (one row per session)

| Column | Source schema field | Notes |
|--------|-------------------|-------|
| participantId | anonymised userId | P001, P002, ... |
| sessionId | TherapyLog.sessionId | links to telemetry CSV |
| createdAt | TherapyLog.createdAt | UTC ISO string |
| painPre | context.painPre | VAS 0–10, required |
| emgAtStart | context.emg | RMS muscle, 0–100 |
| posture | context.posture | LYING/UPRIGHT/WALKING |
| cycleDay | context.cycleDay | 1–28, optional |
| stress | context.stress | 0–10, optional |
| fatigue | context.fatigue | 0–10, optional |
| tookMedication | context.tookMedication | 0/1 flag |
| minutesSinceMedication | context.minutesSinceMedication | 0 = no med |
| skinTempIn | context.skinTempIn | belt temp at start, degrees C |
| presetId | preset.presetId | P01–P12 |
| presetName | preset.presetName | human label |
| targetTemp | preset.targetTemp | degrees C |
| vibrationMode | preset.vibrationMode | CONTINUOUS/PULSE/HARMONIC |
| vibrationSpeed | preset.vibrationSpeed | 0–100 |
| durationMin | preset.durationMin | 10/15/20/30 |
| modelVersion | mlAudit.modelVersion | e.g. baseline-rules-v1.0 |
| settingSource | mlAudit.settingSource | ml_recommendation / fallback_rule / user_manual / safety_override |
| propensity | mlAudit.propensity | P(action given context) for IPS |
| wasClamped | mlAudit.wasClamped | 0/1 |
| predictedDeltaPain | mlAudit.predictedDeltaPain | scorer's predicted relief |
| painPost | outcome.painPost | VAS 0–10 |
| deltaPain | outcome.deltaPain | painPre minus painPost (positive = relief) |
| actualDurationSeconds | outcome.actualDurationSeconds | real elapsed time |
| ci_pregnancy | contraindications.pregnancy | safety audit |
| ci_pacemaker | contraindications.pacemaker | safety audit |
| ci_skinCondition | contraindications.skinCondition | safety audit |

### 5b. pilot_telemetry.csv (one row per session, summarised sensor features)

| Column | Derived from | Formula |
|--------|-------------|---------|
| emg_mean | SensorReading.emg | arithmetic mean, ignoring nulls |
| emg_max | SensorReading.emg | max value in session |
| emg_slope | SensorReading.emg | OLS slope over time (proxy for muscle fatigue trend) |
| temp_mean | SensorReading.temp | arithmetic mean in session |
| temp_max | SensorReading.temp | max recorded temperature |

All computations: export_pilot_dataset.js functions mean(), max(), slope() (L79–97).
Join key: SensorReading.sessionId = TherapyLog.sessionId (SensorReading.js L65, L80).

---

## 6. Session Flow (Operator Checklist)

Before each pilot session the operator (or self-administering participant) must confirm:

- [ ] Device firmware version noted
- [ ] Belt positioned at lower abdomen, no skin irritation present
- [ ] Battery greater than 30%
- [ ] App connected to device via BLE (green indicator)
- [ ] Exclusion criteria confirmed (contraindication screen completed)
- [ ] Consent acknowledged in-app
- [ ] Pain pre-score entered on 0–10 slider
- [ ] Optional context fields entered (cycleDay, stress, fatigue) if available

After each session:

- [ ] Pain post-score entered (required — session excluded from dataset if omitted)
- [ ] Any adverse events noted (burning, unexpected motor behaviour, skin redness)

---

## 7. Pilot Mode Activation

To enable preset exploration for data diversity, set in backend/.env:

```
HERCOMFORT_PILOT_MODE=true
HERCOMFORT_PILOT_EPSILON=0.20
HERCOMFORT_PILOT_TOP_N=3
```

What this does (scorer.js L29–47):
- 20% of sessions will be assigned a non-greedy preset sampled uniformly from the top-3 ranked presets (not a random preset from all 12).
- Propensity P(action given context) is logged correctly in TherapyLog.mlAudit.propensity so Inverse Propensity Scoring (IPS) is valid at analysis time.
- Exploration is never below rank-3, so participants always receive a medically conservative option.

Default: HERCOMFORT_PILOT_MODE is not set = false = zero exploration = greedy rule-based behaviour. Safe for pre-pilot testing.

---

## 8. Exporting the Dataset

```
MONGODB_URI=mongodb://localhost:27017/hercomfort node ml/export_pilot_dataset.js --out=./pilot_data
```

Outputs:
- pilot_data/pilot_sessions.csv — session-level labels
- pilot_data/pilot_telemetry.csv — derived sensor features
- pilot_data/participant_map.json — CONFIDENTIAL mapping of participantId to real userId (never share this file)

Script: ml/export_pilot_dataset.js

---

## 9. What Model to Train After the Pilot

### Why we are NOT training a Random Forest right now
The current synthetic-data Random Forest (ml/train_model.py) was trained without presetId as a feature. It learns "what context predicts good outcomes" but cannot rank individual presets. It is used only as a weight vector source for the linear scorer — not as a genuine preset ranker.

### What the pilot data enables

| Target | Model type | Minimum data needed |
|--------|-----------|-------------------|
| Predict deltaPain given (context, presetId) | Regression — Ridge or Random Forest Regressor with presetId one-hot encoded | ~200 labelled sessions across 5+ presets |
| Rank presets per user | Bandit / OPE — IPS-weighted evaluation using logged propensities | Same 200 sessions + valid propensity column |
| Personalisation per user | Contextual Bandit — LinUCB or Thompson Sampling | ~500 sessions, multiple users |

### Features to collect (already in schema)

```
context:   painPre, emg, posture, cycleDay, stress, fatigue,
           tookMedication, minutesSinceMedication, skinTempIn
action:    presetId (P01–P12)  <-- CRITICAL: must be an input to the model
telemetry: emg_mean, emg_max, emg_slope, temp_mean, temp_max
label:     deltaPain = painPre - painPost
```

### Regression model (Track 2 — after pilot)
Train f(context, presetId) -> deltaPain using real data:
- Encode presetId as one-hot (12 categories).
- Target: deltaPain (continuous).
- Model: Random Forest Regressor or Ridge Regression (interpretable, not complex).
- Validation: user-stratified train/test split (split by participantId, NOT random rows).
- Minimum viable: R-squared > 0.2 on hold-out set before replacing rule-based scorer.

### When to retrain
- After every 50 new completed sessions with painPostConfirmed=true.
- Retraining is manual (python ml/train_model.py) until session volume justifies automation.

---

## 10. Adverse Event Reporting

If any participant reports:
- Skin burns or persistent redness lasting more than 30 min after session
- Pain increase (deltaPain less than -2)
- Device malfunction (unexpected motor speed, temperature spike)

Immediately set HERCOMFORT_PILOT_MODE=false, stop recruiting, and review the session TherapyLog + SensorReading records for that sessionId.

---

## 11. File and Line Number Index

| Item | File | Lines |
|------|------|-------|
| Exclusion criteria schema | TherapyLog.js | L194–203 |
| Therapy blocked response | therapy.routes.js | L90–97 |
| Heat ceiling (40 degrees C) | safetyInterceptor.js | TEMP_EXCEEDED_MAX clamp |
| Session hard stop (60 min) | session.tsx | MAX_SESSION_CEILING_MS |
| Pilot mode flag constant | scorer.js | L29–47 |
| Pilot mode env vars | backend/.env | L11–14 |
| Export script filter query | export_pilot_dataset.js | L109–115 |
| Export script anonymisation | export_pilot_dataset.js | L118–125 |
| Export script telemetry agg | export_pilot_dataset.js | L79–97, L172–184 |
| Propensity formula (IPS) | scorer.js | L228–237 |
