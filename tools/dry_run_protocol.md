# Her Comfort — Bench & Dry-Run Feasibility Protocol

**Protocol Version:** 1.0 (Pre-Pilot Bench Validation)  
**Participant ID Scheme:** `D01` – `D99` (Strictly segregated from pilot participants `P001`–`P999`)  
**Data Logging:** Direct BLE GATT notification logging to laptop CSV via `tools/dry_run_logger.py`

---

## 1. Safety Rules & Pre-Flight Checklist

> [!CAUTION]
> **RULE 1 (MANDATORY): HEATER IS STRICTLY OFF FOR THE ENTIRETY OF RUN 1.**  
> Thermal heating elements must not be engaged during the initial baseline and EMG artifact characterization test.

- [ ] **Skin Preparation:** Clean skin area (lower abdomen) with alcohol swab; ensure dry prior to electrode contact.
- [ ] **Electrode Inspection:** BioAmp hydrogel pads placed firmly on lower abdomen with ground electrode on bony prominence (iliac crest).
- [ ] **Device Battery:** Band battery > 50%.
- [ ] **Laptop Bluetooth:** Bluetooth enabled on logging laptop with `bleak` installed (`pip install bleak`).
- [ ] **Safety Stop:** Pressing `[Q]` in `dry_run_logger.py` or turning off the physical band switch immediately halts the run.

---

## 2. Dry-Run Sequence & Labeling Steps

Launch the logger in terminal:
```bash
python tools/dry_run_logger.py --participant D01 --run 1
```

| Step # | Phase Name | Duration | Logger Key | Label Recorded | Physical Volunteer Instruction | Verification Checklist |
| :---: | :--- | :---: | :---: | :--- | :--- | :--- |
| **0** | **Pre-Test Calibration** | 15s | `[X]` | `UNLABELED` | Volunteer sits comfortably. Verify BLE packet stream. | Packet stream ~2 Hz; temp ~34–36°C. |
| **1** | **Quiet Baseline Rest** | **60s** | `[R]` | `REST` | Remain seated, relaxed abdominal muscles, normal breathing. Motor OFF, Heater OFF. | `emg_envelope` steady at resting baseline (<25). |
| **2** | **Light Abdominal Tension** | 15s | `[L]` | `LIGHT_TENSION` | Gentle abdominal contraction (simulated mild cramp). | Measurable upward step in `emg_envelope`. |
| **3** | **Recovery Rest** | 20s | `[R]` | `REST` | Full relaxation. | EMG returns to baseline level. |
| **4** | **Strong Contraction** | 15s | `[S]` | `STRONG_TENSION` | Sustained voluntary abdominal contraction (simulated peak cramp). | EMG peak observed (>50). |
| **5** | **Recovery Rest** | 20s | `[R]` | `REST` | Full relaxation. | EMG returns to baseline level. |
| **6** | **Kinematic Activity** | **60s** | `[W]` | `WALK` | Volunteer stands and walks across room at normal pace. | `position` reports WALKING/UPRIGHT; angle changes. |
| **7** | **Post-Walk Rest** | 30s | `[R]` | `REST` | Volunteer sits down and rests. | Stable rest reading resumed. |
| **8** | **Motor Artifact: Pulse** | 30s | `[P]` | `PULSE_MOTOR_ON` | Trigger Pulse vibration (Heater OFF). Observe vibration artifact on EMG. | Quantify RMS delta due to motor coupling. |
| **9** | **Inter-Motor Rest** | 20s | `[R]` | `REST` | Motor OFF. Relax. | Return to baseline. |
| **10**| **Motor Artifact: Harmonic**| 30s | `[H]` | `HARMONIC_MOTOR_ON`| Trigger Harmonic vibration (Heater OFF). | Quantify harmonic noise signature on BioAmp envelope. |
| **11**| **Post-Test Baseline** | **60s** | `[R]` | `REST` | Final quiet rest. Motor OFF, Heater OFF. | Verify drift from initial Step 1 baseline. |
| **12**| **Conclusion** | — | `[Q]` | — | Press `[Q]` to stop and finalize CSV. | Verify CSV output size and row count. |

*Total Run Time: ~6 minutes.*

---

## 3. Label Sheet Template (Manual Clinical Log)

Print or record this alongside automated logger output:

```text
================================================================================
HER COMFORT DRY-RUN OPERATOR RECORD
================================================================================
Participant ID: D01                   Date / Time: ____________________________
Run Number:     1                     Operator Name: __________________________
Band Device ID: ____________________  Firmware Version: _______________________
Skin Prep Done: [ ] YES  [ ] NO       Electrode Batch: ________________________

OBSERVATIONS & ANOMALIES:
--------------------------------------------------------------------------------
Phase 1 Baseline EMG Value:           Mean: _________ uV/idx (Rest)
Phase 2 Light Tension Peak:           Peak: _________ uV/idx
Phase 4 Strong Tension Peak:          Peak: _________ uV/idx
Phase 8 Pulse Vibration EMG Shift:    Delta: +________ uV/idx (Motor Artifact)
Phase 10 Harmonic EMG Shift:          Delta: +________ uV/idx (Motor Artifact)
Phase 11 Post-Baseline Drift:         Delta: _________ uV/idx vs Phase 1

Subjective Comfort & Fit:
[ ] Band secure without slipping
[ ] Electrodes maintained continuous skin contact
[ ] No skin erythema/redness upon pad removal

Operator Signature: ___________________________ Date: _________________________
================================================================================
```
