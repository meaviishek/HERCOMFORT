# HerComfort Pilot Feasibility Study — Design Protocol

> **DRAFT — Needs mentor and ethics/IRB review before any data collection begins.**
> This document must not be used for any human-subjects research until reviewed and approved.

---

## 1. Study Classification

**Type:** Pilot feasibility study (within-person crossover)
**Purpose:** To assess the practicality of data collection protocols, device tolerance,
signal quality, and to estimate effect size variance for future sample size calculations.

> **This study is not powered to make efficacy claims.**
> All arm comparisons are exploratory. Any observed differences between arms
> are hypothesis-generating only and must be validated in a future powered study.

---

## 2. Hypotheses (Not Assumptions — Unconfirmed)

The following are stated as testable hypotheses, not established facts.
Mechanism claims are marked explicitly as unconfirmed.

| Hypothesis | Testable in this study? | Notes |
|:---|:---|:---|
| H1: Localized heat at 39.0°C reduces self-reported pain at 15 min compared to pre-session baseline | Yes (within-arm, no control) | Cannot separate from spontaneous regression — no sham control arm |
| H2: Adding PULSE vibration to heat produces a different pain change than heat alone | Yes (between-arm comparison, underpowered) | Mechanism unconfirmed; exploratory only |
| H3: HARMONIC vibration produces a different outcome than PULSE | Yes (between-arm comparison, underpowered) | Mechanism unconfirmed; exploratory only |
| H4: EMG RMS envelope decreases from PRE_BASELINE to POST_BASELINE | Yes (within-session signal quality) | Exploratory; subject to signal quality gate |

> **Mechanism note:** Gate-control theory and endorphin-release pathways are cited in
> pain physiology literature. These mechanisms have **not** been confirmed in this device
> or this population and are stated as background hypotheses only.
> Do not include mechanism claims in participant materials or progress reports.

---

## 3. Participants

| Criterion | Specification |
|:---|:---|
| Age | 18–45 years |
| Diagnosis | Primary dysmenorrhoea (self-reported or clinician-confirmed); secondary dysmenorrhoea included with notes |
| Baseline pain | VAS ≥ 4 on at least 1 menstrual cycle without this device |
| Feasibility target | n = 15 participants completing all 3 sessions |
| **Exclusion** | |
| Pregnancy | Confirmed or suspected |
| Cardiac device | Implanted pacemaker, ICD, or other active implant |
| Skin condition | Active lesion, rash, infection, or burn at device contact area |
| Contraindicated medications | As advised by supervising clinician |
| Unable to consent | Cognitive or language barrier preventing informed consent |

> **Safety stop criteria:**
> Any MODERATE or SEVERE adverse event triggers immediate session termination.
> Contact the study supervisor before the next session for any participant with a moderate/severe event.

---

## 4. Arms

| Arm ID | Label | Heat Setpoint | Motor | Motor Speed | Session Duration |
|:---|:---|:---|:---|:---|:---|
| `ARM_HEAT_ONLY` | Thermal Arm | `PILOT_HEAT_SETPOINT` (default 39.0°C) | OFF | 0% | 20 min |
| `ARM_HEAT_PULSE` | Thermo-Pulsed Arm | `PILOT_HEAT_SETPOINT` | PULSE | 80% | 20 min |
| `ARM_HEAT_HARMONIC` | Harmonic Arm | `PILOT_HEAT_SETPOINT` | HARMONIC | 80% | 20 min |

> **Heat setpoint:** Default 39.0°C. This is a configuration value (`PILOT_HEAT_SETPOINT` in `.env`).
> The supervising clinician must review and confirm this value before data collection begins.
> The safety interceptor enforces a hard ceiling of **40.0°C** — this cannot be overridden in software.
> Any change to the setpoint mid-study requires a protocol amendment and mentor approval.

---

## 5. Randomization and Allocation

- **Design:** Within-person crossover. Each participant completes all 3 arms across 3 menstrual cycles.
- **Allocation:** Server-side block-balanced Latin-square (6 permutations of 3 arms).
  - Implemented in: `ml/trial_allocator.js`
  - Allocation is **deterministic** from `participantId` → sequence index → arm per session.
  - Allocation is **auditable**: no database state beyond `sequenceIndex` is required to verify.
- **Propensity:** Exactly `1/K = 1/3 ≈ 0.333` for every arm in every session.
- **Epsilon-greedy is disabled** during the pilot trial (`PILOT_TRIAL_MODE=true`).
- **Safety interceptor always runs after allocation.** The allocator's output is not final until
  the safety pipeline has cleared it. If the safety interceptor clamps the setpoint,
  `mlAudit.wasClamped = true` is logged.

---

## 6. Session Protocol

### 6.1 Pre-Session (T-5 min to T=0)

1. Participant confirms no new contraindications (pregnancy, skin change, pacemaker question).
2. App prompts for **pain reading at T-5 min** (`painPre_tMinus5`). VAS 0–10.
3. Participant applies belt device to lower abdomen.
4. App prompts for **pain reading at T=0 (START SESSION tap)** (`painPre_t0`).
5. `painPre_baseline = (painPre_tMinus5 + painPre_t0) / 2` is computed server-side.

### 6.2 Baseline Window — T=0 to T=60s (PRE_BASELINE)

> **Heater OFF. Motor OFF. First 60 seconds.**

App displays banner: *"Measuring baseline muscle tone (1 min). Please stay still. Heater and motor are off."*

- All telemetry packets during this window are tagged `windowType = 'PRE_BASELINE'`.
- `emg_pre_rms` and `emg_pre_mean` are computed from these packets at session end.
- Both `heaterState = false` and `motorState = false` must be verified on every packet in this window.
  Any packet where either is `true` is flagged and excluded from the baseline aggregate.

### 6.3 Active Therapy — T=61s to T=1140s (ACTIVE_THERAPY)

- Assigned arm protocol is activated: heater ramps to setpoint, motor activates per arm spec.
- All packets are tagged `windowType = 'ACTIVE_THERAPY'`.
- **Participant rule:** Participants may only **decrease** heat or intensity.
  - The app UI blocks any increase above the assigned arm setpoint.
  - Every participant-initiated change is logged: `isUserModification = true`,
    `modificationDirection`, `modificationTimestampSec`.
- **ITT policy:** Sessions are analyzed by assigned arm regardless of participant modifications.
  All deviations are logged for per-protocol sensitivity analysis.

### 6.4 Post-Baseline Window — T=1141s to T=1200s (POST_BASELINE)

> **Motor OFF (forced). Heater ON (maintaining temperature).**

App displays banner: *"Session ending. Motor shutting off for 1 final minute."*

- `emg_post_rms` and `emg_post_mean` are computed from packets in this window.
- `delta_emg_clean_rms = emg_pre_rms − emg_post_rms` — exploratory EMG outcome.

### 6.5 Immediate Post-Session Outcomes (T=1200s)

1. App prompts for **immediate post-session pain** (`painPost_0min`). VAS 0–10. Explicit slider tap required.
2. App prompts for **adverse event screen**: burning, numbness, nausea, skin redness, dizziness, other.
3. `deltaPain_0min = painPre_baseline − painPost_0min` is computed server-side.

### 6.6 15-Minute Follow-Up — PRIMARY OUTCOME

At T+15 minutes after session end, the app sends a **push notification**:

> *"How is your pain now? Please rate 0–10."*

- Participant responds: `painPost_15min`. Explicit tap required (`painPostConfirmed_15min = true`).
- `deltaPain_15min = painPre_baseline − painPost_15min` — **this is the primary outcome variable**.
- If `painPostConfirmed_15min = false`, the session is **excluded from primary analysis**
  (included in feasibility denominator as a missing outcome event).

---

## 7. Outcomes

### 7.1 Primary Outcome

> **Pain change from baseline at 15 minutes post-session (deltaPain_15min)**
>
> `deltaPain_15min = painPre_baseline − painPost_15min`
>
> Positive = pain decrease (relief). Negative = pain increase.

Requires: `painPostConfirmed_15min = true`.

### 7.2 Secondary Outcomes

| Outcome | Timing | Variable |
|:---|:---|:---|
| Immediate pain change | End of session | `deltaPain_0min` |
| Adverse event rate | Per session | `adverseEvent`, `adverseCategory`, `adverseSeverity` |
| Session completion rate | Per session | `completionStatus`, `earlyTermination` |

### 7.3 Exploratory Outcomes

| Outcome | Variable | Notes |
|:---|:---|:---|
| EMG change score | `delta_emg_clean_rms` | Subject to signal quality gate (see data readiness report) |
| Patient Global Impression of Change | `pgicScore` | Should priority; deferred to follow-up sprint |
| Telemetry feasibility | `telemetry_packet_loss_pct` | Feasibility only; not clinical outcome |
| 30-min pain follow-up | `deltaPain_30min` | Should priority; requires push notification infrastructure |

---

## 8. Primary Statistical Analysis

**Model:** Linear mixed-effects regression

```
deltaPain_15min ~ trialArm + cycleDay + sessionOrderForParticipant
                 + tookMedication + (1 | participantId)
```

- `trialArm`: Fixed effect (reference = `ARM_HEAT_ONLY`)
- `cycleDay`: Continuous covariate (day 1 = first bleeding day)
- `sessionOrderForParticipant`: Carry-over covariate (1, 2, 3)
- `tookMedication`: Boolean covariate
- `(1 | participantId)`: Random intercept for within-person correlation

**Secondary:** Pairwise arm comparison via paired t-test (Bonferroni-corrected for 3 pairs).

**LOPO (secondary):** `ml/evaluate_lopo.py` — predictive performance only.
See script header for scope limitations. Do not conflate LOPO metrics with efficacy.

**Analysis population:** Intention-to-treat (ITT) by assigned arm.
Sessions where participant decreased heat/intensity are included under assigned arm.

---

## 9. Limitations

> These limitations must be communicated to participants and reviewers. They are not
> contingencies — they are structural features of this study design.

1. **No blinding:** Participants can feel the difference between arms (motor vibration is
   perceptible and differentiable). Expectation effects and placebo response cannot be
   controlled and may differ across arms.

2. **No rest/sham control:** The thermal arm (`ARM_HEAT_ONLY`) is an active comparator,
   not a no-treatment control. Whether heat itself is superior to no treatment cannot
   be established from this design. Spontaneous regression-to-the-mean cannot be separated
   from treatment effect.

3. **Cycle-day confounding:** Sessions occur on different days of different menstrual cycles.
   Pain severity varies with cycle phase. The `cycleDay` covariate is included but is
   insufficient to fully deconfound inter-cycle variability in pain severity.

4. **Order and carry-over effects:** The crossover design assumes no carry-over between arms
   (sessions are separated by a full menstrual cycle). However, device familiarity, learned
   pain coping, and regression expectations may carry over across sessions.

5. **Small N:** The feasibility target is n = 15 participants. This study is not powered
   for any efficacy endpoint. All between-arm comparisons are exploratory and hypothesis-
   generating only. Effect size and variance estimates from this study will be used to
   power a future adequately-sized study.

6. **Self-reported outcomes:** Pain is measured by VAS which is subjective and susceptible
   to response bias, social desirability, and recall effects at T+15 min.

---

## 10. Data Management and Privacy

- All participants are assigned a de-identified ID (`P001`–`P999`).
- The mapping of real user IDs to participant IDs is stored in `participant_map.json`
  (never committed to version control — see `.gitignore`).
- Raw pilot data is exported to `pilot_data/` (never committed — see `.gitignore`).
- Device IDs are retained for feasibility analysis but not linked to participant names.
- All `.env` files are excluded from version control.
- Data export script: `ml/export_pilot_dataset.js`
- Data dictionary: `ml/data_dictionary.json`

---

## 11. Consent Statement

> **DRAFT — Must be reviewed and approved by mentor and ethics committee before use.**
> This text has NOT been approved for participant-facing use.

---

**Research Consent Form — HerComfort Pilot Feasibility Study**

You are being invited to participate in a pilot feasibility study of the HerComfort wearable
device for managing menstrual cramps (dysmenorrhoea).

**What you will do:**
You will use the HerComfort belt device during 3 separate menstrual periods, each time
assigned to one of 3 different heat and vibration settings (arms). You will rate your pain
before, immediately after, and 15 minutes after each session. You will also answer a short
questionnaire about comfort and adverse effects.

**What we are testing:**
This study tests whether our data collection methods work, whether the device is comfortable,
and whether a larger study is feasible. **It is not designed to prove that the device works**,
and we cannot make any guarantees about pain relief.

**Heat and vibration:**
The device applies gentle heat (up to 39°C, about 102°F) and optional vibration to your
lower abdomen. These are within the ranges approved for consumer heat therapy devices.

**Risks:**
- Mild skin redness (erythema) from heat contact is possible.
- You may feel discomfort from the vibration or heat.
- You can stop the session at any time using the STOP button in the app.
- Tell us immediately if you experience skin burning, numbness, nausea, or dizziness.

**Participation is voluntary:**
You can withdraw at any time without penalty. Your data collected to that point will
be retained unless you request deletion.

**Data privacy:**
Your identity will be replaced with an anonymous participant ID (e.g., "P001").
Your name is never stored in the research dataset.

**Contact:**
For questions or to report a problem, contact the study supervisor at: [CONTACT TO BE ADDED]

---

## 12. Safety Checklist (Study Supervisor)

Complete before every session:

- [ ] Participant has confirmed: no pregnancy, no pacemaker/ICD, no skin lesion at contact site
- [ ] Device firmware version confirmed and logged
- [ ] App version confirmed and logged
- [ ] Heat setpoint confirmed at `PILOT_HEAT_SETPOINT` (default 39.0°C)
- [ ] Safety interceptor tested at study start (verify 40.0°C hard ceiling is active)
- [ ] STOP button demonstrated to participant
- [ ] Emergency contact for the study supervisor available to participant
- [ ] Adverse event from any previous session reviewed before proceeding

---

*Generated: ml/data_dictionary.json, ml/trial_allocator.js, ml/evaluate_lopo.py*
*Backend: backend/src/models/TherapyLog.js (pilot subdocument)*
*Telemetry: backend/src/models/SensorReading.js*
