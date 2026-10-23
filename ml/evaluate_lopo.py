#!/usr/bin/env python3
"""
ml/evaluate_lopo.py — Leave-One-Participant-Out Evaluation

PURPOSE
-------
Secondary analysis script for the HerComfort pilot feasibility study.
Evaluates predictive performance of a model using LOPO cross-validation:
  - For each participant P, train on all other participants' data.
  - Predict deltaPain_15min for participant P's sessions.
  - Report MAE, RMSE, R², per-arm bias, and data readiness summary.

IMPORTANT SCOPE LIMITATIONS:
  • This script measures predictive performance, NOT treatment efficacy.
  • Results from LOPO do NOT establish that any arm is superior.
  • The primary efficacy analysis is a mixed-effects model on deltaPain_15min.
  • LOPO is a secondary analysis to assess whether predictive modeling
    is feasible with this dataset size. Do not overinterpret these results.

INPUT
-----
  pilot_data/sessions.csv — output of export_pilot_dataset.js
    Required columns: participantId, trialArm, sessionOrderForParticipant,
                      cycleDay, tookMedication, painPre_baseline, deltaPain_15min

OUTPUT
------
  Prints per-fold and overall LOPO metrics to stdout.
  Writes pilot_data/lopo_results.json for downstream reporting.

USAGE
-----
  python ml/evaluate_lopo.py
  python ml/evaluate_lopo.py --input pilot_data/sessions.csv
  python ml/evaluate_lopo.py --min-sessions 3  # minimum sessions per participant
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_csv(path: str):
    """Minimal CSV loader — avoids pandas dependency for portability."""
    import csv
    rows = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def coerce_numeric(row: dict, field: str, fallback=None):
    v = row.get(field)
    if v is None or v == '' or v == 'null':
        return fallback
    try:
        return float(v)
    except ValueError:
        return fallback


def arm_to_int(arm: str) -> int:
    mapping = {'ARM_HEAT_ONLY': 0, 'ARM_HEAT_PULSE': 1, 'ARM_HEAT_HARMONIC': 2}
    return mapping.get(arm, -1)


def prepare_features(row: dict):
    """Extract numeric feature vector from a CSV row."""
    return {
        'painPre_baseline':          coerce_numeric(row, 'painPre_baseline', 5.0),
        'cycleDay':                  coerce_numeric(row, 'cycleDay', 14.0),
        'tookMedication':            1.0 if row.get('tookMedication') in ('true', '1', True) else 0.0,
        'sessionOrder':              coerce_numeric(row, 'sessionOrderForParticipant', 1.0),
        'arm_heat_pulse':            1.0 if row.get('trialArm') == 'ARM_HEAT_PULSE' else 0.0,
        'arm_heat_harmonic':         1.0 if row.get('trialArm') == 'ARM_HEAT_HARMONIC' else 0.0,
    }


# ---------------------------------------------------------------------------
# Linear model (mean predictor baseline + arm coefficient)
# ---------------------------------------------------------------------------

def fit_linear(X_dicts: list, y: list):
    """
    Fit a simple OLS regression:
      y ~ intercept + b_painPre*painPre + b_session*sessionOrder
          + b_med*tookMed + b_pulse*arm_pulse + b_harmonic*arm_harmonic

    Uses normal equations. Avoids numpy/scipy for portability.
    Falls back to grand mean if <5 training samples.
    """
    n = len(y)
    if n < 5:
        mean_y = sum(y) / n if n > 0 else 0.0
        return {'intercept': mean_y, 'coefficients': {}}

    feature_names = list(X_dicts[0].keys())
    k = len(feature_names)

    # Build design matrix (add intercept column)
    A = []
    for i, x in enumerate(X_dicts):
        row = [1.0] + [x[f] for f in feature_names]
        A.append(row)

    # Normal equations: b = (AᵀA)⁻¹Aᵀy
    # Simple implementation for small k
    m = k + 1  # number of coefficients including intercept
    AtA = [[0.0] * m for _ in range(m)]
    Aty = [0.0] * m
    for i in range(n):
        for j in range(m):
            Aty[j] += A[i][j] * y[i]
            for l in range(m):
                AtA[j][l] += A[i][j] * A[i][l]

    # Solve via Gaussian elimination with partial pivoting
    try:
        b = _solve_linear_system(AtA, Aty)
    except Exception:
        # Fallback: grand mean
        mean_y = sum(y) / n
        return {'intercept': mean_y, 'coefficients': {}}

    return {
        'intercept': b[0],
        'coefficients': {feature_names[i]: b[i + 1] for i in range(k)},
    }


def predict_linear(model: dict, x: dict) -> float:
    pred = model['intercept']
    for feat, coef in model['coefficients'].items():
        pred += coef * x.get(feat, 0.0)
    return pred


def _solve_linear_system(A, b):
    """Gaussian elimination with partial pivoting. Returns solution vector."""
    n = len(b)
    A = [row[:] for row in A]
    b = b[:]
    for col in range(n):
        # Partial pivot
        max_row = max(range(col, n), key=lambda r: abs(A[r][col]))
        A[col], A[max_row] = A[max_row], A[col]
        b[col], b[max_row] = b[max_row], b[col]
        if abs(A[col][col]) < 1e-12:
            raise ValueError('Singular matrix — not enough variation in training data.')
        pivot = A[col][col]
        for row in range(col + 1, n):
            factor = A[row][col] / pivot
            for c in range(col, n):
                A[row][c] -= factor * A[col][c]
            b[row] -= factor * b[col]
    # Back-substitution
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = b[i]
        for j in range(i + 1, n):
            x[i] -= A[i][j] * x[j]
        x[i] /= A[i][i]
    return x


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_metrics(y_true: list, y_pred: list) -> dict:
    n = len(y_true)
    if n == 0:
        return {'n': 0, 'mae': None, 'rmse': None, 'r2': None}
    errors = [y_pred[i] - y_true[i] for i in range(n)]
    mae  = sum(abs(e) for e in errors) / n
    rmse = math.sqrt(sum(e ** 2 for e in errors) / n)
    mean_y = sum(y_true) / n
    ss_tot = sum((y - mean_y) ** 2 for y in y_true)
    ss_res = sum(e ** 2 for e in errors)
    r2 = 1 - ss_res / ss_tot if ss_tot > 1e-12 else None
    return {'n': n, 'mae': round(mae, 4), 'rmse': round(rmse, 4),
            'r2': round(r2, 4) if r2 is not None else None}


# ---------------------------------------------------------------------------
# LOPO evaluation
# ---------------------------------------------------------------------------

def run_lopo(sessions: list, min_sessions: int = 2) -> dict:
    """
    Leave-One-Participant-Out cross-validation.

    For each participant:
      - Train on all other participants' complete sessions (deltaPain_15min not null).
      - Predict on held-out participant's sessions.
      - Report per-fold and aggregate metrics.

    Returns results dict.
    """
    # Filter to sessions with primary outcome available
    complete = [
        s for s in sessions
        if coerce_numeric(s, 'deltaPain_15min') is not None
        and s.get('participantId')
    ]

    if len(complete) == 0:
        return {'error': 'No sessions with deltaPain_15min found. Run more pilot sessions first.'}

    participants = sorted(set(s['participantId'] for s in complete))
    n_participants = len(participants)

    print(f'\n🔬 LOPO Evaluation — HerComfort Pilot Feasibility Study')
    print(f'   Sessions with primary outcome: {len(complete)}')
    print(f'   Participants: {n_participants}')
    print(f'   Primary outcome: deltaPain_15min = painPre_baseline − painPost_15min')
    print(f'   NOTE: This measures predictive performance, NOT treatment efficacy.\n')

    if n_participants < 3:
        return {
            'warning': f'Only {n_participants} participants with data. LOPO requires ≥3. '
                       'Collect more sessions before running this evaluation.',
            'n_participants': n_participants,
        }

    fold_results = []
    all_y_true = []
    all_y_pred = []

    for held_out in participants:
        train = [s for s in complete if s['participantId'] != held_out]
        test  = [s for s in complete if s['participantId'] == held_out]

        if len(test) < min_sessions:
            print(f'  ⚠️  Skipping {held_out}: only {len(test)} sessions (min={min_sessions})')
            continue

        X_train = [prepare_features(s) for s in train]
        y_train = [coerce_numeric(s, 'deltaPain_15min') for s in train]
        X_test  = [prepare_features(s) for s in test]
        y_test  = [coerce_numeric(s, 'deltaPain_15min') for s in test]

        model = fit_linear(X_train, y_train)
        y_pred = [predict_linear(model, x) for x in X_test]

        metrics = compute_metrics(y_test, y_pred)
        fold_results.append({
            'participant':  held_out,
            'n_test':       len(test),
            'n_train':      len(train),
            'metrics':      metrics,
            'y_true':       [round(v, 3) for v in y_test],
            'y_pred':       [round(v, 3) for v in y_pred],
            'model_intercept': round(model['intercept'], 4),
            'model_coefs':  {k: round(v, 4) for k, v in model['coefficients'].items()},
        })

        all_y_true.extend(y_test)
        all_y_pred.extend(y_pred)

        print(
            f'  Fold {held_out}: n={len(test)} | '
            f'MAE={metrics["mae"]} RMSE={metrics["rmse"]} R²={metrics["r2"]}'
        )

    overall_metrics = compute_metrics(all_y_true, all_y_pred)

    # Per-arm bias analysis
    arm_bias = {}
    for s, yt, yp in zip(
        [s for s in complete if s['participantId'] in participants],
        all_y_true, all_y_pred
    ):
        arm = s.get('trialArm', 'UNKNOWN')
        if arm not in arm_bias:
            arm_bias[arm] = {'errors': [], 'n': 0}
        arm_bias[arm]['errors'].append(yp - yt)
        arm_bias[arm]['n'] += 1

    arm_summary = {}
    for arm, d in arm_bias.items():
        errors = d['errors']
        arm_summary[arm] = {
            'n':         d['n'],
            'mean_bias': round(sum(errors) / len(errors), 4) if errors else None,
            'mae':       round(sum(abs(e) for e in errors) / len(errors), 4) if errors else None,
        }

    print(f'\n📊 Overall LOPO Metrics (n={overall_metrics["n"]} predictions):')
    print(f'   MAE  = {overall_metrics["mae"]}  (VAS points)')
    print(f'   RMSE = {overall_metrics["rmse"]} (VAS points)')
    print(f'   R²   = {overall_metrics["r2"]}')
    print(f'\n   ⚠️  These are predictive accuracy metrics only.')
    print(f'   For efficacy analysis, use the mixed-effects model on deltaPain_15min.')
    print(f'\nPer-arm prediction bias:')
    for arm, s in arm_summary.items():
        print(f'   {arm}: n={s["n"]} mean_bias={s["mean_bias"]} mae={s["mae"]}')

    results = {
        'study':           'HerComfort Pilot Feasibility Study',
        'analysis_type':   'Leave-One-Participant-Out (LOPO) — secondary analysis',
        'scope_note':      (
            'Predictive performance only. Does not establish treatment efficacy. '
            'Primary efficacy analysis is the mixed-effects model on deltaPain_15min.'
        ),
        'primary_outcome': 'deltaPain_15min',
        'n_participants':  n_participants,
        'n_sessions':      len(complete),
        'overall_metrics': overall_metrics,
        'arm_prediction_bias': arm_summary,
        'fold_results':    fold_results,
    }

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='LOPO evaluation for HerComfort pilot feasibility study (secondary analysis).'
    )
    parser.add_argument(
        '--input', default='pilot_data/sessions.csv',
        help='Path to sessions CSV (output of export_pilot_dataset.js)'
    )
    parser.add_argument(
        '--output', default='pilot_data/lopo_results.json',
        help='Path to write LOPO results JSON'
    )
    parser.add_argument(
        '--min-sessions', type=int, default=2,
        help='Minimum sessions per held-out participant to include in LOPO'
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f'❌ Input file not found: {input_path}')
        print('   Run export_pilot_dataset.js first to generate pilot_data/sessions.csv')
        sys.exit(1)

    sessions = load_csv(str(input_path))
    print(f'📂 Loaded {len(sessions)} rows from {input_path}')

    results = run_lopo(sessions, min_sessions=args.min_sessions)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

    print(f'\n✅ LOPO results written to {output_path}')


if __name__ == '__main__':
    main()
