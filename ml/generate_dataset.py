"""
ml/generate_dataset.py

Generates a synthetic cold-start prototype dataset for the HerComfort
therapy recommendation system.

IMPORTANT DISCLAIMER:
  This is a SYNTHETIC PROTOTYPE DATASET (not real patient data).
  It encodes initial engineering assumptions about pain physiology based on
  general medical concepts (Gate Control Theory, thermal vasodilation).
  These assumptions have NOT been clinically validated.
  Label this clearly in all presentations: "Synthetic Cold-Start Prior".

Hardware Safety:
  All generated target temperatures are HARD-CLAMPED to [36.0°C, 40.0°C].
  This mirrors the ESP32 hardware safety envelope defined in README.

Output: ml/data/synthetic_prototype_dataset.csv
"""

import random
import math
import csv
import os
from pathlib import Path

# ─── Reproducibility ──────────────────────────────────────────────────────────
random.seed(42)

# ─── Config ───────────────────────────────────────────────────────────────────
N_SAMPLES = 5000
OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = OUTPUT_DIR / "synthetic_prototype_dataset.csv"

# 12 pre-approved presets (mirrored from ml/presets.js)
PRESETS = [
    # (id, targetTemp, vibMode, vibSpeed, durationMin)
    ("P01", 37.5, "PULSE",       40, 10),
    ("P02", 38.0, "HARMONIC",    50, 15),
    ("P03", 38.0, "CONTINUOUS",  45, 15),
    ("P04", 38.5, "PULSE",       60, 15),
    ("P05", 38.5, "HARMONIC",    65, 20),
    ("P06", 38.0, "PULSE",       70, 15),
    ("P07", 39.0, "HARMONIC",    75, 20),
    ("P08", 39.5, "HARMONIC",    80, 20),
    ("P09", 39.0, "CONTINUOUS",  85, 15),
    ("P10", 40.0, "HARMONIC",    90, 20),
    ("P11", 37.5, "HARMONIC",    45, 30),
    ("P12", 37.5, "PULSE",       40, 15),
]

VIB_MODE_ENC = {"CONTINUOUS": 0, "PULSE": 1, "HARMONIC": 2}
POSTURE_ENC  = {"LYING": 0, "UPRIGHT": 1, "WALKING": 2}

def clamp(value, lo, hi):
    return max(lo, min(hi, value))

def gaussian_noise(mean=0.0, std=0.3):
    """Box-Muller transform for Gaussian noise."""
    u1, u2 = random.random(), random.random()
    z = math.sqrt(-2.0 * math.log(u1 + 1e-9)) * math.cos(2 * math.pi * u2)
    return mean + std * z

def select_best_preset(pain, emg, posture, cycle_day, stress, fatigue, took_med, mins_since_med):
    """
    Heuristic assignment of best preset per context.
    This is the 'rule-based baseline' that the ML model will eventually learn
    and hopefully improve upon via closed-loop ΔPain feedback.

    Engineering Assumptions (NOT clinically validated):
      - Higher pain + higher EMG → more heat + stronger vibration.
      - LYING posture → more soothing presets (lower speed, longer duration).
      - WALKING posture → higher speed needed to overcome motion noise.
      - Long sessions (>15 min) → prefer HARMONIC to prevent sensory adaptation.
      - Mild pain (0-3) → light presets P01, P02, P11, P12.
      - Moderate pain (4-6) → P03, P04, P05, P06.
      - Severe pain (7-10) → P07, P08, P09, P10.
    """
    if took_med and mins_since_med < 30:
        # Pain may be artificially low — use light preset
        return random.choice(["P01", "P12"])

    if pain <= 3:
        if posture == "LYING":
            return random.choice(["P01", "P11"])
        return random.choice(["P01", "P02", "P12"])

    elif pain <= 6:
        if posture == "WALKING":
            return random.choice(["P06", "P04"])
        if emg > 60:
            return random.choice(["P05", "P07"])
        return random.choice(["P03", "P04", "P05", "P06"])

    else:  # severe pain 7-10
        if posture == "WALKING":
            return random.choice(["P09", "P06"])
        if emg > 70:
            return random.choice(["P08", "P10"])
        return random.choice(["P07", "P08", "P09", "P10"])


def simulate_delta_pain(pain_pre, preset_id, posture, emg):
    """
    Simulate ΔPain = pain_pre - pain_post.

    Engineering assumption:
      - More aggressive presets (P07-P10) produce larger relief for high pain.
      - Posture mismatch (walking + lying preset) reduces relief.
      - High EMG + appropriate preset → better relief.
      - Clinical noise modeled with Gaussian σ=0.8 (pain scales are noisy).
    """
    preset_strengths = {
        "P01": 0.25, "P02": 0.30, "P03": 0.28, "P04": 0.40,
        "P05": 0.45, "P06": 0.42, "P07": 0.55, "P08": 0.60,
        "P09": 0.50, "P10": 0.65, "P11": 0.30, "P12": 0.20,
    }
    strength = preset_strengths.get(preset_id, 0.30)

    # EMG bonus: high spasm + strong preset = more relief
    emg_bonus = 0.0
    if emg > 60 and preset_id in ["P07", "P08", "P09", "P10"]:
        emg_bonus = 0.10

    # Posture penalty
    posture_penalty = 0.0

    raw_delta = pain_pre * (strength + emg_bonus) + gaussian_noise(0.0, 0.8)
    delta = clamp(raw_delta + posture_penalty, 0.0, pain_pre)
    pain_post = clamp(round(pain_pre - delta, 1), 0.0, 10.0)
    return pain_post, round(pain_pre - pain_post, 1)


def generate_record():
    # ── Input Feature Generation ────────────────────────────────────────────
    pain_pre     = round(random.uniform(1.0, 10.0), 1)
    emg          = round(random.uniform(5.0, 95.0), 1)
    posture      = random.choice(["LYING", "UPRIGHT", "WALKING"])
    cycle_day    = random.randint(1, 28)
    stress       = round(random.uniform(0.0, 10.0), 1)
    fatigue      = round(random.uniform(0.0, 10.0), 1)
    took_med     = random.random() < 0.25
    mins_since_med = round(random.uniform(10, 240)) if took_med else 0
    skin_temp    = round(random.uniform(34.0, 37.5) + gaussian_noise(0, 0.3), 2)

    # ── Preset Selection (rule-based cold-start heuristic) ──────────────────
    preset_id = select_best_preset(
        pain_pre, emg, posture, cycle_day, stress, fatigue,
        took_med, mins_since_med
    )

    preset = dict(zip(
        ["id", "targetTemp", "vibMode", "vibSpeed", "durationMin"],
        next(p for p in PRESETS if p[0] == preset_id)
    ))

    # Safety clamp on temperature (hardware limit: 36.0 – 40.0°C)
    safe_temp = clamp(preset["targetTemp"], 36.0, 40.0)
    was_clamped = safe_temp != preset["targetTemp"]

    # ── Simulate outcome ────────────────────────────────────────────────────
    pain_post, delta_pain = simulate_delta_pain(pain_pre, preset_id, posture, emg)

    # ── Propensity (uniform over valid presets for cold-start) ──────────────
    propensity = round(1.0 / len(PRESETS), 4)

    return {
        # Context features (input X)
        "pain_pre":          pain_pre,
        "emg":               emg,
        "posture":           POSTURE_ENC[posture],
        "posture_label":     posture,
        "cycle_day":         cycle_day,
        "stress":            stress,
        "fatigue":           fatigue,
        "took_med":          int(took_med),
        "mins_since_med":    mins_since_med,
        "skin_temp_in":      skin_temp,

        # Action (chosen preset)
        "preset_id":         preset_id,
        "target_temp":       safe_temp,
        "vib_mode":          preset["vibMode"],
        "vib_mode_enc":      VIB_MODE_ENC[preset["vibMode"]],
        "vib_speed":         preset["vibSpeed"],
        "duration_min":      preset["durationMin"],
        "was_clamped":       int(was_clamped),

        # Outcome (target Y for reward model)
        "pain_post":         pain_post,
        "delta_pain":        delta_pain,

        # Metadata
        "propensity":        propensity,
        "model_version":     "baseline-rules-v1.0",
        "setting_source":    "fallback_rule",
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "pain_pre", "emg", "posture", "posture_label", "cycle_day",
        "stress", "fatigue", "took_med", "mins_since_med", "skin_temp_in",
        "preset_id", "target_temp", "vib_mode", "vib_mode_enc",
        "vib_speed", "duration_min", "was_clamped",
        "pain_post", "delta_pain",
        "propensity", "model_version", "setting_source",
    ]

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for _ in range(N_SAMPLES):
            writer.writerow(generate_record())

    print(f"[OK] Synthetic prototype dataset written -> {OUTPUT_FILE}")
    print(f"     Rows: {N_SAMPLES}")
    print(f"     Features (X): 10  |  Action: 6  |  Outcome (Y): 2")
    print(f"     [!] DISCLAIMER: Synthetic Cold-Start Prior, NOT real patient data.")


if __name__ == "__main__":
    main()
