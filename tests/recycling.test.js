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
  assert.equal(rows[0].lvrWarning, true);
});

// LVR guard: exactly 80% → lvrWarning false
test('LVR exactly 80% → lvrWarning false', () => {
  // $400k loan, release $240k on $800k property → (640k/800k) = 80%
  const rows = runScenario({
    ...BASE, loanBalance: 400000, propertyValue: 800000,
    releaseAmount: 240000, recycleAmount: 240000,
  });
  assert.equal(rows[0].lvrWarning, false);
});

// LVR guard: 1 cent over 80% → lvrWarning true
test('LVR 1 cent over 80% → lvrWarning true', () => {
  // $400k loan, release $240,001 on $800k property → just over 80%
  const rows = runScenario({
    ...BASE, loanBalance: 400000, propertyValue: 800000,
    releaseAmount: 240001, recycleAmount: 240001,
  });
  assert.equal(rows[0].lvrWarning, true);
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
