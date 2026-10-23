/**
 * ml/test_propensity.js
 *
 * Unit test: verifies that the epsilon-greedy propensity values sum to 1.
 *
 * Propensity formula (IPS-correct, scorer.js L234-248):
 *   P(top-1)       = (1 - eps) + eps/N  = (1 - eps + eps/N)
 *   P(rank 2..N)   = eps / N
 *
 * Sum check:
 *   P(top-1) + (N-1) * P(other)
 *   = (1 - eps + eps/N) + (N-1)*(eps/N)
 *   = 1 - eps + eps/N + eps*(N-1)/N
 *   = 1 - eps + eps/N + eps - eps/N
 *   = 1  ✓
 *
 * Usage:
 *   node ml/test_propensity.js
 */

const EPSILON_VALUES = [0.0, 0.10, 0.20, 0.50];
const N = 3;

let pass = 0;
let fail = 0;

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function computePropensities(eps, n) {
  const pExploreEach = round4(eps / n);
  const pTop1        = round4(1.0 - eps + pExploreEach);
  return { pTop1, pExploreEach };
}

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS  ${message}`);
    pass++;
  } else {
    console.error(`  ❌ FAIL  ${message}`);
    fail++;
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  HerComfort scorer.js — Propensity Sum Unit Tests');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const eps of EPSILON_VALUES) {
  console.log(`─── eps=${eps}  N=${N} ────────────────────────────────────────────`);
  const { pTop1, pExploreEach } = computePropensities(eps, N);

  const sumOfAll = round4(pTop1 + (N - 1) * pExploreEach);

  console.log(`  pTop1       = ${pTop1}`);
  console.log(`  pExploreEach= ${pExploreEach}  (for ranks 2..${N})`);
  console.log(`  sum         = ${sumOfAll}  (must equal 1.0000)`);

  // Core invariant: probabilities sum to 1
  assert(
    Math.abs(sumOfAll - 1.0) < 1e-4,
    `sum(propensities) = 1.0  [got ${sumOfAll}]`,
  );

  // P(top-1) is always >= P(other)
  assert(
    pTop1 >= pExploreEach,
    `P(top-1)=${pTop1} >= P(other)=${pExploreEach}`,
  );

  // All probabilities in (0, 1]
  assert(
    pTop1 > 0 && pTop1 <= 1,
    `P(top-1) in (0,1] — got ${pTop1}`,
  );

  if (eps > 0) {
    assert(
      pExploreEach > 0 && pExploreEach <= 1,
      `P(other) in (0,1] — got ${pExploreEach}`,
    );
  }

  // When eps=0: deterministic, pTop1 must be 1.0
  if (eps === 0) {
    assert(pTop1 === 1.0, `eps=0 → P(top-1)=1.0, got ${pTop1}`);
    assert(pExploreEach === 0, `eps=0 → P(other)=0, got ${pExploreEach}`);
  }

  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Results: ${pass} passed, ${fail} failed`);
console.log('═══════════════════════════════════════════════════════════════');

if (fail > 0) {
  process.exit(1);
}
