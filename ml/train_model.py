"""
ml/train_model.py

HerComfort ML Training Pipeline — Calibrated Multi-Arm Regression Model.

Fail-Closed Rules:
  - If any required arm has fewer than MIN_SAMPLES_PER_ARM valid records for
    real pilot data, training aborts with [FATAL ERROR].
  - Hard-coded fallback coefficients are NEVER written for real pilot runs.
  - Arms without training data are marked is_fallback=True so the scorer
    refuses to present them as learned predictions.

Leakage Protection:
  - Cross-validation uses a scikit-learn Pipeline(StandardScaler + Ridge)
    fitted ONLY on the training fold in each iteration.
  - The global_scaler (fitted on all data) is used ONLY for the final
    exported production artifact, not for computing validation metrics.
"""

import sys
import os
import json
import time
import math
import csv
import random
import argparse
from pathlib import Path
from collections import defaultdict

try:
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline
    from sklearn.model_selection import GroupKFold
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    import numpy as np
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("[ERROR] scikit-learn and numpy are required.")
    sys.exit(1)

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

DEFAULT_REAL_DATA  = Path(__file__).parent.parent / "pilot_data" / "clean_training_dataset.csv"
SYNTHETIC_DATA     = Path(__file__).parent / "data" / "synthetic_prototype_dataset.csv"
OUTPUT_DIR         = Path(__file__).parent / "models"
WEIGHTS_OUT        = OUTPUT_DIR / "model_weights.json"
REPORT_OUT         = OUTPUT_DIR / "training_report.json"

MODEL_VERSION = "pilot-calibrated-ridge-v1.0"

FEATURE_COLUMNS = [
    "pain_pre_baseline",
    "emg_pre_rms",
    "cycle_day",
    "posture_code",
    "took_medication",
]

POSTURE_MAP = {"LYING": 0.0, "UPRIGHT": 1.0, "WALKING": 2.0, "UNKNOWN": 1.0}
ARMS = ["ARM_HEAT_ONLY", "ARM_HEAT_PULSE", "ARM_HEAT_HARMONIC"]
DEFAULT_MIN_SAMPLES_PER_ARM = 6


def parse_row(row, is_synthetic=False):
    """
    Parse and validate a single CSV row.  Returns None to reject the row.

    Rejection reasons:
      - Missing / unrecognized arm label (real data)
      - Missing participant_id (real data)
      - Missing or non-finite pain_pre or delta_pain
      - Pain values outside [0, 10]
      - Non-finite non-EMG features
    EMG missingness is allowed and propagated as NaN (imputed later).
    """
    try:
        if is_synthetic:
            p_id = row.get("sample_id", f"SYN_{random.randint(1, 9999)}")
            vib = str(row.get("vib_mode", "")).upper()
            spd = float(row.get("vib_speed", 50))
            if vib == "OFF" or spd == 0:
                arm = "ARM_HEAT_ONLY"
            elif vib == "HARMONIC":
                arm = "ARM_HEAT_HARMONIC"
            elif vib in ["PULSE", "CONTINUOUS"]:
                arm = "ARM_HEAT_PULSE"
            else:
                return None  # unrecognized vib_mode

            pain_pre_str   = row.get("pain_pre", "")
            delta_pain_str = row.get("delta_pain", "")
            if pain_pre_str == "" or delta_pain_str == "":
                return None
            pain_pre   = float(pain_pre_str)
            delta_pain = float(delta_pain_str)

            emg_str  = row.get("emg", "")
            emg      = float(emg_str) if emg_str != "" else None
            cycle_day_str = row.get("cycle_day", "")
            cycle_day = float(cycle_day_str) if cycle_day_str != "" else 14.0
            posture_code = POSTURE_MAP.get(str(row.get("posture", "LYING")).upper(), 1.0)
            took_med  = 1.0 if str(row.get("took_med", "0")).lower() in ["1", "true"] else 0.0

        else:
            p_id = row.get("participant_id", "")
            if not p_id:
                return None
            arm = row.get("trial_arm", "").strip()
            if arm not in ARMS:
                return None  # missing or invalid arm — reject

            pain_pre_str   = row.get("pain_pre_baseline", "")
            delta_pain_str = row.get("delta_pain_15min", "")
            if pain_pre_str == "" or delta_pain_str == "":
                return None  # missing primary outcome — reject
            pain_pre   = float(pain_pre_str)
            delta_pain = float(delta_pain_str)

            emg_str  = row.get("emg_pre_rms", "")
            emg      = float(emg_str) if emg_str not in ("", None) else None
            cycle_day_str = row.get("cycle_day", "")
            cycle_day = float(cycle_day_str) if cycle_day_str not in ("", None) else 14.0
            posture_code = POSTURE_MAP.get(str(row.get("posture", "UNKNOWN")).upper(), 1.0)
            took_med  = 1.0 if str(row.get("took_medication", "0")).lower() in ["1", "true"] else 0.0

        # Validate pain range
        if not math.isfinite(pain_pre) or pain_pre < 0 or pain_pre > 10:
            return None
        if not math.isfinite(delta_pain):
            return None

        # EMG: missing -> NaN; non-finite or negative -> NaN
        if emg is None or (not math.isfinite(emg)) or emg < 0:
            emg = float("nan")

        features = [pain_pre, emg, cycle_day, posture_code, took_med]

        # Reject if non-EMG features are non-finite
        for col, val in zip(FEATURE_COLUMNS, features):
            if col == "emg_pre_rms":
                continue
            if not math.isfinite(val):
                return None

        return {
            "participant_id": p_id,
            "arm": arm,
            "features": features,
            "delta_pain": delta_pain,
            "emg_missing": math.isnan(emg),
        }
    except (ValueError, TypeError):
        return None


def mean_impute_emg(records):
    """
    Replace NaN EMG with arm-level mean (fallback: global mean).
    Returns (updated_records, imputed_count).
    Imputation is logged transparently; no silent substitution.
    """
    EMG_IDX = FEATURE_COLUMNS.index("emg_pre_rms")
    arm_emg = defaultdict(list)
    for r in records:
        v = r["features"][EMG_IDX]
        if not math.isnan(v):
            arm_emg[r["arm"]].append(v)

    global_vals = [v for vals in arm_emg.values() for v in vals]
    global_mean = float(np.mean(global_vals)) if global_vals else 35.0

    imputed = 0
    for r in records:
        v = r["features"][EMG_IDX]
        if math.isnan(v):
            arm_mean = float(np.mean(arm_emg[r["arm"]])) if arm_emg[r["arm"]] else global_mean
            r["features"][EMG_IDX] = arm_mean
            imputed += 1
    return records, imputed


def load_dataset(file_path, is_synthetic=False):
    if not os.path.exists(file_path):
        return []
    records, rejected = [], 0
    with open(file_path, mode="r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            parsed = parse_row(r, is_synthetic=is_synthetic)
            if parsed:
                records.append(parsed)
            else:
                rejected += 1
    if rejected > 0:
        print(f"[!] Rejected {rejected} rows (invalid arm, missing outcome, out-of-range).")
    return records


def train_pipeline(records, is_synthetic=False, min_samples_per_arm=DEFAULT_MIN_SAMPLES_PER_ARM):
    start_time = time.time()
    n_samples = len(records)
    print(f"\n[*] Training on {n_samples} validated samples...")

    records, emg_imputed = mean_impute_emg(records)
    if emg_imputed > 0:
        print(f"[!] EMG mean-imputation: {emg_imputed} rows (transparent, logged in artifact).")

    unique_pids = list(set(r["participant_id"] for r in records))
    print(f"[*] Unique participants: {len(unique_pids)}")

    by_arm = defaultdict(list)
    for r in records:
        by_arm[r["arm"]].append(r)

    # ── Fail-closed arm checks (real data only) ───────────────────────────────
    if not is_synthetic:
        missing_arms = [a for a in ARMS if len(by_arm.get(a, [])) == 0]
        insuff_arms  = [(a, len(by_arm[a])) for a in ARMS
                        if 0 < len(by_arm.get(a, [])) < min_samples_per_arm]
        if missing_arms:
            print(f"\n[FATAL ERROR] Arms with ZERO training records: {missing_arms}")
            print("Hard-coded fallback coefficients are forbidden for real pilot data.")
            print("Use --synthetic for development or add pilot data for all arms.")
            sys.exit(1)
        if insuff_arms:
            print(f"\n[FATAL ERROR] Arms below minimum ({min_samples_per_arm}) samples:")
            for arm, n in insuff_arms:
                print(f"  {arm}: {n} samples")
            sys.exit(1)

    # ── Global scaler for production artifact ─────────────────────────────────
    X_all = np.array([r["features"] for r in records], dtype=np.float64)
    global_scaler = StandardScaler()
    global_scaler.fit(X_all)

    arm_models, cv_metrics = {}, {}

    for arm in (ARMS if is_synthetic else list(by_arm.keys())):
        arm_records = by_arm.get(arm, [])
        n_arm = len(arm_records)

        if n_arm == 0:
            arm_models[arm] = {
                "intercept": 1.2, "coefficients": [0.2, 0.0, 0.0, 0.0, 0.0],
                "n_samples": 0, "is_fallback": True, "fallback_reason": "NO_TRAINING_DATA",
            }
            cv_metrics[arm] = {
                "evaluation_method": "unavailable_untrained_arm",
                "reason": "NO_TRAINING_DATA",
                "n_samples": 0,
                "note": "Evaluation metrics unavailable: arm has 0 training samples.",
            }
            print(f"[!] Synthetic arm '{arm}': 0 samples — marked FALLBACK.")
            continue

        if n_arm < 3:
            mean_y = float(np.mean([r["delta_pain"] for r in arm_records]))
            arm_models[arm] = {
                "intercept": round(mean_y, 4),
                "coefficients": [0.0] * len(FEATURE_COLUMNS),
                "n_samples": n_arm, "is_fallback": True,
                "fallback_reason": f"INSUFFICIENT_SAMPLES_{n_arm}",
            }
            cv_metrics[arm] = {
                "evaluation_method": "unavailable_untrained_arm",
                "reason": f"INSUFFICIENT_SAMPLES_{n_arm}",
                "n_samples": n_arm,
                "note": f"Evaluation metrics unavailable: arm has {n_arm} samples (minimum 3 required for CV).",
            }
            print(f"[!] Arm '{arm}': {n_arm} samples — empirical mean, marked FALLBACK.")
            continue

        X_arm = np.array([r["features"] for r in arm_records], dtype=np.float64)
        y_arm = np.array([r["delta_pain"] for r in arm_records], dtype=np.float64)
        pids_arm = np.array([r["participant_id"] for r in arm_records])

        # Final production model (global scaler, full arm data)
        X_arm_scaled = global_scaler.transform(X_arm)
        final_model = Ridge(alpha=1.0, random_state=RANDOM_SEED)
        final_model.fit(X_arm_scaled, y_arm)
        arm_models[arm] = {
            "intercept": round(float(final_model.intercept_), 4),
            "coefficients": [round(float(c), 4) for c in final_model.coef_],
            "n_samples": n_arm, "is_fallback": False,
        }

        # ── Leakage-free evaluation ───────────────────────────────────────────
        n_pids = len(set(pids_arm))
        if not is_synthetic and n_pids >= 3:
            n_splits = min(5, n_pids)
            gkf = GroupKFold(n_splits=n_splits)
            mae_list, rmse_list, r2_list, fold_sizes = [], [], [], []
            for train_idx, val_idx in gkf.split(X_arm, y_arm, groups=pids_arm):
                pipe = Pipeline([("sc", StandardScaler()), ("ridge", Ridge(alpha=1.0, random_state=RANDOM_SEED))])
                pipe.fit(X_arm[train_idx], y_arm[train_idx])
                preds = pipe.predict(X_arm[val_idx])
                fold_sizes.append(len(val_idx))
                mae_list.append(mean_absolute_error(y_arm[val_idx], preds))
                rmse_list.append(math.sqrt(mean_squared_error(y_arm[val_idx], preds)))
                n_val = len(y_arm[val_idx])
                r2_list.append(r2_score(y_arm[val_idx], preds)
                                if n_val > 1 and np.std(y_arm[val_idx]) > 1e-6 else None)
            r2_valid = [v for v in r2_list if v is not None]
            cv_metrics[arm] = {
                "evaluation_method": "GroupKFold_cv",
                "cv_folds": n_splits, "cv_n_participants": n_pids,
                "cv_n_observations": n_arm, "cv_fold_sizes": fold_sizes,
                "cv_mae": round(float(np.mean(mae_list)), 4),
                "cv_rmse": round(float(np.mean(rmse_list)), 4),
                "cv_r2": round(float(np.mean(r2_valid)), 4) if r2_valid else None,
                "cv_r2_undefined_folds": len(r2_list) - len(r2_valid),
                "note": "GroupKFold by participant_id; Pipeline scaler fitted per fold (no leakage).",
            }
        elif is_synthetic:
            preds = final_model.predict(X_arm_scaled)
            cv_metrics[arm] = {
                "evaluation_method": "in_sample_synthetic_development",
                "in_sample_mae":  round(float(mean_absolute_error(y_arm, preds)), 4),
                "in_sample_rmse": round(float(math.sqrt(mean_squared_error(y_arm, preds))), 4),
                "in_sample_r2":   round(float(r2_score(y_arm, preds)), 4),
                "note": "SYNTHETIC — in-sample only. Not representative of clinical performance.",
            }
        else:
            preds = final_model.predict(X_arm_scaled)
            cv_metrics[arm] = {
                "evaluation_method": "in_sample_insufficient_participants",
                "in_sample_mae":  round(float(mean_absolute_error(y_arm, preds)), 4),
                "in_sample_rmse": round(float(math.sqrt(mean_squared_error(y_arm, preds))), 4),
                "in_sample_r2":   round(float(r2_score(y_arm, preds)), 4),
                "note": f"WARNING: Only {n_pids} participant(s). In-sample metrics are severely optimistic.",
            }

    elapsed = round(time.time() - start_time, 3)

    # Imputation parameters fitted on training data
    imputation_means = {
        col: round(float(np.mean(X_all[:, idx])), 4)
        for idx, col in enumerate(FEATURE_COLUMNS)
    }

    per_arm_pids = {
        a: len(set(r["participant_id"] for r in by_arm.get(a, [])))
        for a in ARMS
    }

    weights = {
        "model_version": MODEL_VERSION,
        "model_type": "MultiArmRidgeRegression",
        "feature_columns": FEATURE_COLUMNS,
        "imputation": imputation_means,
        "scaler": {
            "mean": [round(float(m), 4) for m in global_scaler.mean_],
            "scale": [round(float(s), 4) for s in global_scaler.scale_],
            "n_samples_fit": int(X_all.shape[0]),
        },
        "arm_models": arm_models,
        "training_meta": {
            "dataset_type": "SYNTHETIC_DEVELOPMENT" if is_synthetic else "REAL_PILOT_FEASIBILITY",
            "dataset_path": str(SYNTHETIC_DATA if is_synthetic else DEFAULT_REAL_DATA),
            "target_definition": "deltaPain_15min = painPre_baseline - painPost_15min",
            "n_samples": n_samples,
            "unique_participants": len(unique_pids),
            "per_arm_samples": {a: len(by_arm.get(a, [])) for a in ARMS},
            "per_arm_unique_participants": per_arm_pids,
            "emg_imputed_rows": emg_imputed,
            "train_time_seconds": elapsed,
            "random_seed": RANDOM_SEED,
            "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "disclaimer": (
                "Synthetic cold-start prior. Not for clinical use."
                if is_synthetic else
                "Empirical pilot feasibility prior. Not for clinical use."
            ),
        },
        "evaluation": cv_metrics,
    }
    return weights


def main():
    parser = argparse.ArgumentParser(description="HerComfort Multi-Arm Trainer")
    parser.add_argument("--dataset", default=None)
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--min-samples", type=int, default=6)
    parser.add_argument("--min-samples-per-arm", type=int, default=DEFAULT_MIN_SAMPLES_PER_ARM)
    args = parser.parse_args()

    is_synthetic = False
    if args.synthetic:
        data_path, is_synthetic = SYNTHETIC_DATA, True
        print("[!] DEV MODE: Training on SYNTHETIC dataset. Metrics are NOT clinical evidence.")
    elif args.dataset:
        data_path = Path(args.dataset)
    else:
        data_path = DEFAULT_REAL_DATA

    if not data_path.exists():
        print(f"\n[FATAL ERROR] Dataset not found: {data_path}")
        sys.exit(1)

    # Provenance guard: prevent synthetic demo export from being trained as real pilot data
    if not is_synthetic:
        report_file = data_path.parent / "dataset_validation_report.json"
        if report_file.exists():
            try:
                with open(report_file, "r", encoding="utf-8") as rf:
                    rpt = json.load(rf)
                if rpt.get("isSynthetic") or rpt.get("datasetType") == "SYNTHETIC_DEMO":
                    print(f"\n[FATAL ERROR] Dataset at '{data_path}' has provenance 'SYNTHETIC_DEMO'.")
                    print("Cannot train REAL_PILOT_FEASIBILITY model on synthetic demo data.")
                    print("Use --synthetic flag for development training on synthetic data.")
                    sys.exit(1)
            except Exception:
                pass

    records = load_dataset(data_path, is_synthetic=is_synthetic)

    if len(records) < args.min_samples:
        print(f"\n[FATAL ERROR] Insufficient records: {len(records)} < {args.min_samples}.")
        sys.exit(1)

    weights = train_pipeline(records, is_synthetic=is_synthetic,
                             min_samples_per_arm=args.min_samples_per_arm)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(WEIGHTS_OUT, "w", encoding="utf-8") as f:
        json.dump(weights, f, indent=2)
    with open(REPORT_OUT, "w", encoding="utf-8") as f:
        json.dump({"model_version": weights["model_version"],
                   "training_meta": weights["training_meta"],
                   "evaluation": weights["evaluation"],
                   "arm_models": weights["arm_models"]}, f, indent=2)

    print(f"\n[+] Saved: {WEIGHTS_OUT}")
    print("\nArm Model Summary:")
    for arm, m in weights["arm_models"].items():
        tag = " [FALLBACK]" if m.get("is_fallback") else ""
        print(f"  [{arm:<18}] n={m['n_samples']:<5} intercept={m['intercept']:+.2f}{tag}")

    untrained = [a for a, m in weights["arm_models"].items() if m.get("is_fallback")]
    if untrained:
        print(f"\n*** FALLBACK ARMS (not learned): {untrained} ***")
        print("    Scorer will NOT present these as ML predictions.")


if __name__ == "__main__":
    main()
