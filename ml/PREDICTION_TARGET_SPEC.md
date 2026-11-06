# HerComfort ML Specification: Prediction Target & Inference Modeling

**Document Version:** 1.0 (Pilot Protocol Feasibility Specification)  
**Task Definition:** Formalizing the Prediction Target, Causal Boundaries, and Recommendation Model Architecture.

---

## 1. Intended Prediction Task

In the HerComfort clinical feasibility protocol, each participant undergoes a 3-arm within-subject Latin-square crossover study:
- $a_1$: `ARM_HEAT_ONLY` ($39.0^\circ\text{C}$, Motor OFF, 20 min)
- $a_2$: `ARM_HEAT_PULSE` ($39.0^\circ\text{C}$, Pulse Vibration 80%, 20 min)
- $a_3$: `ARM_HEAT_HARMONIC` ($39.0^\circ\text{C}$, Harmonic Vibration 80%, 20 min)

### The Primary Target Variable ($Y$)
$$Y = \Delta\text{Pain}_{15\text{min}} = \text{painPre\_baseline} - \text{painPost\_15min}$$
- **Units:** Visual Analog Scale (VAS) points (continuous float, range $-10.0$ to $+10.0$).
- **Interpretation:** Positive values indicate pain reduction / clinical relief. Higher is better.
- **Timing:** Evaluated at exactly $T = +15\text{ minutes}$ post-session to capture peak physiological neuromodulation and thermal vasodilation.

---

## 2. Distinguishing Three Distinct Modeling Objectives

Do not conflate the following three objectives:

### Objective A: Predicting an Individual Session's Absolute Outcome
$$\hat{Y} = f(X, A)$$
- **Inputs:** Participant baseline context $X$ (baseline pain, resting EMG envelope, posture, cycle day, medication history) and delivered therapy arm $A$.
- **What this answers:** *"If this patient receives Arm $A$ in context $X$, how much pain reduction is expected?"*
- **Feasibility:** Fully supported by crossover pilot data.

### Objective B: Estimating Treatment Effects Between Arms (Causal Inference)
$$\tau(A_j, A_k) = \mathbb{E}[Y(A_j) - Y(A_k) \mid X]$$
- **What this answers:** *"Does Heat + Pulse offer incremental pain reduction over Heat-Only?"*
- **Feasibility:** Guaranteed unconfounded by Latin-square uniform randomization ($p = 1/3$) and within-person pairing.
- **Target Analysis:** Primary statistical model in `ml/analyze_primary.py` (paired t-test and linear mixed-effects model with sequence/period covariates).

### Objective C: Autonomous Treatment Personalization (Policy Optimization)
$$\pi^*(X) = \arg\max_{a \in \mathcal{A}} \hat{\mathbb{E}}[Y(a) \mid X]$$
- **What this answers:** *"Which arm should be prescribed to this specific patient to maximize relief?"*
- **Critical Limitation for Pilot Phase:** An empirical feasibility sample ($N \approx 25$, 75 total sessions) is powered to detect main treatment effects and estimate variance. It is **underpowered to detect heterogeneous treatment interactions** across multi-dimensional feature spaces (e.g. high-EMG × walking vs low-EMG × lying).
- **Architectural Policy:** During the pilot study phase, **autonomous model recommendation is disabled or kept exploratory**. All formal pilot allocations are strictly governed by `trial_allocator.js`.

---

## 3. Mathematical Model & Inference Export Architecture

To eliminate the defect where Python trains an unexported Random Forest while Node.js evaluates an ad-hoc heuristic, the inference model is unified as a **Calibrated Multi-Arm Ridge Model**:

For each candidate therapy arm $a \in \mathcal{A}$:
$$\hat{Y}(X, a) = \beta_{0, a} + \sum_{j=1}^{d} \beta_{j, a} \cdot \left(\frac{X_j - \mu_j}{\sigma_j}\right)$$

Where:
- $\mu_j, \sigma_j$ are the feature means and standard deviations from `StandardScaler`.
- $\beta_{0, a}$ is the arm-specific intercept.
- $\beta_{j, a}$ are the trained ridge regression weights corresponding to feature $X_j$.

### Exported Artifact (`ml/models/model_weights.json`)
```json
{
  "model_version": "pilot-calibrated-v1.0",
  "model_type": "MultiArmRidgeRegression",
  "feature_columns": [
    "pain_pre_baseline",
    "emg_pre_rms",
    "cycle_day",
    "posture_code",
    "took_medication"
  ],
  "scaler": {
    "mean": [6.2, 35.0, 14.0, 0.5, 0.2],
    "scale": [1.8, 12.0, 4.0, 0.6, 0.4]
  },
  "arm_models": {
    "ARM_HEAT_ONLY": {
      "intercept": 1.25,
      "coefficients": [0.35, 0.12, -0.04, -0.08, -0.21]
    },
    "ARM_HEAT_PULSE": {
      "intercept": 2.45,
      "coefficients": [0.52, 0.28, -0.02, -0.05, -0.15]
    },
    "ARM_HEAT_HARMONIC": {
      "intercept": 2.10,
      "coefficients": [0.48, 0.22, -0.03, -0.06, -0.18]
    }
  }
}
```

### Zero-Discrepancy Invariant
Both Python training evaluation and the Node.js production scorer execute this **exact mathematical dot-product**. No decision tree heuristics, no proxy Gini importance weights. Predictions match to 6 decimal places.
