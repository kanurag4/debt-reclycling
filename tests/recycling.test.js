const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runScenario } = require('../www/calc/recycling.js');

const near = (actual, expected, tol) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `Expected ~${expected} (±${tol}), got ${actual.toFixed(2)}`);

const BASE = {
  loanBalance: 600000, interestRate: 0.06, monthlyRepayment: 3597,
  recycleAmount: 100000, taxRate: 0.345, investmentReturn: 0.07,
  dividendYield: 0.04, years: 20, propertyValue: 0, releaseAmount: 0,
};

// Happy path
test('returns array of correct length', () => {
  const rows = runScenario(BASE);
  assert.equal(rows.length, 20);
});

test('year 1 tax saving ≈ $2,070 (100k × 6% × 34.5%)', () => {
  const rows = runScenario(BASE);
  near(rows[0].taxSaving, 2070, 10);
});

test('recycling net wealth > baseline after 20 years', () => {
  const rows = runScenario(BASE);
  const last = rows[19];
  assert.ok(last.netWealthRecycling > last.netWealthBaseline,
    `recycling ${last.netWealthRecycling.toFixed(0)} should beat baseline ${last.netWealthBaseline.toFixed(0)}`);
});

test('investment value grows over time', () => {
  const rows = runScenario(BASE);
  assert.ok(rows[19].investmentValue > rows[0].investmentValue);
});

// Edge: recycleAmount = 0 → no tax benefit
test('recycleAmount=0 → tax saving is 0 every year', () => {
  const rows = runScenario({ ...BASE, recycleAmount: 0 });
  rows.forEach(r => assert.equal(r.taxSaving, 0));
});

test('recycleAmount=0 → deductibleBalance stays 0', () => {
  const rows = runScenario({ ...BASE, recycleAmount: 0 });
  rows.forEach(r => assert.equal(r.deductibleBalance, 0));
});

// Edge: recycleAmount = full loan
test('recycleAmount = full loan → nonDeductible starts at 0', () => {
  const rows = runScenario({ ...BASE, recycleAmount: 600000 });
  assert.equal(rows[0].nonDeductibleBalance, 0);
});

// Edge: 1-year projection
test('1-year projection returns 1 row', () => {
  const rows = runScenario({ ...BASE, years: 1 });
  assert.equal(rows.length, 1);
});

// Edge: 30-year projection
test('30-year projection returns 30 rows', () => {
  const rows = runScenario({ ...BASE, years: 30 });
  assert.equal(rows.length, 30);
});

// Edge: dividendYield = 0
test('dividendYield=0 → netDividends is 0', () => {
  const rows = runScenario({ ...BASE, dividendYield: 0 });
  rows.forEach(r => assert.equal(r.netDividends, 0));
});

// Edge: investmentReturn = 0
test('investmentReturn=0, dividendYield=0 → investmentValue stays flat', () => {
  const rows = runScenario({ ...BASE, investmentReturn: 0, dividendYield: 0 });
  rows.forEach(r => near(r.investmentValue, 100000, 1));
});

// P&I investment loan: deductible balance decreases over time
test('investmentLoanTerm provided → deductibleBalance decreases over projection', () => {
  const rows = runScenario({ ...BASE, investmentLoanTerm: 30 });
  assert.ok(rows[19].deductibleBalance < rows[0].deductibleBalance,
    `deductible should decrease, got yr1=${rows[0].deductibleBalance.toFixed(0)} yr20=${rows[19].deductibleBalance.toFixed(0)}`);
});

// P&I investment loan: total loan balance decreases each year
test('investmentLoanTerm provided → totalLoanBalance decreases each year', () => {
  const rows = runScenario({ ...BASE, investmentLoanTerm: 30 });
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].totalLoanBalance <= rows[i - 1].totalLoanBalance,
      `total loan should not increase: yr${i}=${rows[i-1].totalLoanBalance.toFixed(0)} → yr${i+1}=${rows[i].totalLoanBalance.toFixed(0)}`);
  }
});

// Edge: taxRate = 0
test('taxRate=0 → taxSaving is 0', () => {
  const rows = runScenario({ ...BASE, taxRate: 0 });
  rows.forEach(r => assert.equal(r.taxSaving, 0));
});

// LVR guard: 87.5% LVR → lvrWarning true
test('LVR 87.5% → lvrWarning true', () => {
  // $500k loan, release $200k on $800k property → (700k/800k) = 87.5%
  const rows = runScenario({
    ...BASE, loanBalance: 500000, propertyValue: 800000,
    releaseAmount: 200000, recycleAmount: 200000,
  });
  assert.equal(rows.lvrWarning, true);
});

// LVR guard: exactly 80% → lvrWarning false
test('LVR exactly 80% → lvrWarning false', () => {
  // $400k loan, release $240k on $800k property → (640k/800k) = 80%
  const rows = runScenario({
    ...BASE, loanBalance: 400000, propertyValue: 800000,
    releaseAmount: 240000, recycleAmount: 240000,
  });
  assert.equal(rows.lvrWarning, false);
});

// LVR guard: 1 cent over 80% → lvrWarning true
test('LVR 1 cent over 80% → lvrWarning true', () => {
  // $400k loan, release $240,001 on $800k property → just over 80%
  const rows = runScenario({
    ...BASE, loanBalance: 400000, propertyValue: 800000,
    releaseAmount: 240001, recycleAmount: 240001,
  });
  assert.equal(rows.lvrWarning, true);
});

// Negative: investment return below interest rate
test('return < interest rate → recycling still saves via tax', () => {
  const rows = runScenario({ ...BASE, investmentReturn: 0.04, dividendYield: 0.02 });
  assert.ok(rows[0].taxSaving > 0);
});

// Franking credits
test('frankingPct=0 (default) → netDividends same as grossDividends × (1 - taxRate)', () => {
  const rows = runScenario({ ...BASE, frankingPct: 0 });
  // $100k × 4% = $4,000 gross dividends; net = $4,000 × (1 - 0.345) = $2,620
  near(rows[0].netDividends, 2620, 5);
});

test('frankingPct=1 (100% franked) → netDividends larger than unranked', () => {
  const rowsNo  = runScenario({ ...BASE, frankingPct: 0 });
  const rowsFull = runScenario({ ...BASE, frankingPct: 1 });
  assert.ok(rowsFull[0].netDividends > rowsNo[0].netDividends,
    `franked (${rowsFull[0].netDividends.toFixed(0)}) should exceed unfranked (${rowsNo[0].netDividends.toFixed(0)})`);
});

test('frankingPct=1 → netDividends ≈ grossDividends × (1 + 30/70) × (1 - taxRate)', () => {
  const rows = runScenario({ ...BASE, frankingPct: 1 });
  // grossDividends=$4,000; frankingCredit=$4,000×(30/70)≈$1,714; taxable=$5,714; net=$5,714×0.655≈$3,743
  near(rows[0].netDividends, 3743, 5);
});

test('frankingPct=0.7 → netDividends between unfranked and fully franked', () => {
  const rowsNo   = runScenario({ ...BASE, frankingPct: 0 });
  const rows70   = runScenario({ ...BASE, frankingPct: 0.7 });
  const rowsFull = runScenario({ ...BASE, frankingPct: 1 });
  assert.ok(rows70[0].netDividends > rowsNo[0].netDividends);
  assert.ok(rows70[0].netDividends < rowsFull[0].netDividends);
});

test('omitting frankingPct → same result as frankingPct=0 (backward compat)', () => {
  const rowsDefault = runScenario(BASE);
  const rowsZero    = runScenario({ ...BASE, frankingPct: 0 });
  near(rowsDefault[0].netDividends, rowsZero[0].netDividends, 0.01);
  near(rowsDefault[0].taxSaving,    rowsZero[0].taxSaving,    0.01);
});

// Maintenance cost
test('omitting maintenanceCost → same netCashFlow as maintenanceCost=0 (backward compat)', () => {
  const rowsDefault = runScenario(BASE);
  const rowsZero    = runScenario({ ...BASE, maintenanceCost: 0 });
  near(rowsDefault[0].netCashFlow, rowsZero[0].netCashFlow, 0.01);
});

test('maintenanceCost reduces netCashFlow by maintenanceCost × (1 − taxRate)', () => {
  const cost = 6000;
  const rowsNo   = runScenario({ ...BASE, maintenanceCost: 0 });
  const rowsWith = runScenario({ ...BASE, maintenanceCost: cost });
  const expectedReduction = cost * (1 - BASE.taxRate);  // deductible expense
  near(rowsNo[0].netCashFlow - rowsWith[0].netCashFlow, expectedReduction, 1);
});

// ── Negative gearing restriction ────────────────────────────────────────────
// BASE is negatively geared: deductibleInterest ($6k) > grossDividends ($4k)

test('omitting negativeGearingRestricted → same taxSaving as false (backward compat)', () => {
  const rowsDefault    = runScenario(BASE);
  const rowsUnrestricted = runScenario({ ...BASE, negativeGearingRestricted: false });
  near(rowsDefault[0].taxSaving, rowsUnrestricted[0].taxSaving, 0.01);
});

test('negativeGearingRestricted=false → taxSaving = (interest + maintenance) × taxRate', () => {
  const rows = runScenario({ ...BASE, negativeGearingRestricted: false });
  // 100k × 6% = $6,000 interest; no maintenance; taxSaving = 6000 × 0.345 = 2070
  near(rows[0].taxSaving, 2070, 1);
});

test('negativeGearingRestricted=true, negatively geared → taxSaving capped at grossDividends × taxRate', () => {
  const rows = runScenario({ ...BASE, negativeGearingRestricted: true });
  // grossDividends = 100k × 4% = $4,000; capped taxSaving = 4000 × 0.345 = 1380
  near(rows[0].taxSaving, 1380, 1);
});

test('negativeGearingRestricted=true, negatively geared → netCashFlow lower than unrestricted', () => {
  const rowsUnrestricted = runScenario({ ...BASE, negativeGearingRestricted: false });
  const rowsRestricted   = runScenario({ ...BASE, negativeGearingRestricted: true });
  assert.ok(rowsRestricted[0].netCashFlow < rowsUnrestricted[0].netCashFlow,
    'restricted cashflow should be lower than unrestricted');
});

test('negativeGearingRestricted=true, positively geared → taxSaving unchanged vs unrestricted', () => {
  // Make positively geared: dividendYield (7%) > investmentRate (4%)
  const positiveBase = { ...BASE, investmentRate: 0.04, dividendYield: 0.07, investmentReturn: 0.10 };
  const rowsUnrestricted = runScenario({ ...positiveBase, negativeGearingRestricted: false });
  const rowsRestricted   = runScenario({ ...positiveBase, negativeGearingRestricted: true });
  near(rowsRestricted[0].taxSaving, rowsUnrestricted[0].taxSaving, 0.01);
});

// ── CGT calculations ─────────────────────────────────────────────────────────

test('cgtLiability=0 when recycleAmount=0 (no investment gain)', () => {
  const rows = runScenario({ ...BASE, recycleAmount: 0 });
  rows.forEach(r => assert.equal(r.cgtLiability, 0));
});

test('post-budget CGT on shares: applies 30% min to inflation-indexed gain', () => {
  // With inflationRate=0 to isolate: indexed gain = nominal gain = 3k; cgtLiability ≈ 3000×0.345
  const rows = runScenario({ ...BASE, cgtRules: 'post-budget', inflationRate: 0 });
  near(rows[0].cgtLiability, 3000 * 0.345, 5);
});

test('post-budget CGT with 2.5% inflation: indexed gain < nominal gain', () => {
  // indexedCostBase yr1 = 100k × 1.025 = 102,500; investmentValue ≈ 103k
  // indexedGain ≈ 500; cgtLiability ≈ 500 × 0.345
  const rows = runScenario({ ...BASE, cgtRules: 'post-budget', inflationRate: 0.025 });
  near(rows[0].cgtLiability, 500 * 0.345, 5);
});

test('post-budget CGT: higher inflation → lower CGT liability', () => {
  const rowsLowInf  = runScenario({ ...BASE, cgtRules: 'post-budget', inflationRate: 0 });
  const rowsHighInf = runScenario({ ...BASE, cgtRules: 'post-budget', inflationRate: 0.05 });
  assert.ok(rowsHighInf[0].cgtLiability < rowsLowInf[0].cgtLiability,
    'higher inflation should reduce CGT via indexation');
});

test('pre-budget CGT on shares: 50% discount on nominal gain', () => {
  const rows = runScenario({ ...BASE, cgtRules: 'pre-budget' });
  near(rows[0].cgtLiability, 3000 * 0.5 * 0.345, 5);
});

test('with inflationRate=0: pre-budget CGT < post-budget CGT', () => {
  // Without indexation benefit, post-budget (full gain × 0.345) > pre-budget (half gain × 0.345)
  const rowsPre  = runScenario({ ...BASE, cgtRules: 'pre-budget',  inflationRate: 0 });
  const rowsPost = runScenario({ ...BASE, cgtRules: 'post-budget', inflationRate: 0 });
  assert.ok(rowsPre[0].cgtLiability < rowsPost[0].cgtLiability);
});

test('omitting inflationRate defaults to 2.5%', () => {
  const rowsDefault   = runScenario({ ...BASE, cgtRules: 'post-budget' });
  const rowsExplicit  = runScenario({ ...BASE, cgtRules: 'post-budget', inflationRate: 0.025 });
  near(rowsDefault[0].cgtLiability, rowsExplicit[0].cgtLiability, 0.01);
});

test('netWealthAfterCGT = netWealthRecycling − cgtLiability', () => {
  const rows = runScenario({ ...BASE, cgtRules: 'post-budget' });
  rows.forEach(r => {
    near(r.netWealthAfterCGT, r.netWealthRecycling - r.cgtLiability, 0.01);
  });
});

test('omitting cgtRules defaults to post-budget behaviour', () => {
  const rowsDefault  = runScenario(BASE);
  const rowsPostBudget = runScenario({ ...BASE, cgtRules: 'post-budget' });
  near(rowsDefault[0].cgtLiability, rowsPostBudget[0].cgtLiability, 0.01);
});

test('property tab: CGT based on full ipPrice growth, not equity-only investmentValue', () => {
  // inflationRate=0 to isolate the full-value mechanism
  // ipPrice=$600k growing at 5%/yr; after yr1: fullPropertyValue=630k; nominalGain=30k
  // cgtLiability = 30k × 0.345 ≈ 10350
  // Shares-only CGT would be: 100k×0.03=3k gain → 3k×0.345≈1035 (much smaller)
  const rows = runScenario({
    ...BASE, ipPrice: 600000,
    investmentReturn: 0.09, dividendYield: 0.04,  // ipGrowthRate = 0.05
    cgtRules: 'post-budget', inflationRate: 0,
  });
  near(rows[0].cgtLiability, 30000 * 0.345, 50);
  assert.ok(rows[0].cgtLiability > 1035 * 5, 'property CGT should be much larger than equity-only CGT');
});

test('property tab CGT with 2.5% inflation: indexed gain reduces liability', () => {
  // indexedCostBase yr1 = 600k × 1.025 = 615k; fullPropertyValue = 630k; indexedGain = 15k
  // cgtLiability = 15k × 0.345 ≈ 5175
  const rows = runScenario({
    ...BASE, ipPrice: 600000,
    investmentReturn: 0.09, dividendYield: 0.04,
    cgtRules: 'post-budget', inflationRate: 0.025,
  });
  near(rows[0].cgtLiability, 15000 * 0.345, 50);
});
