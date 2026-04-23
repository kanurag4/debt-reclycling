// Year-by-year debt recycling projection engine.
// All inputs are numbers; returns array of annual snapshots.
//
// inputs:
//   loanBalance         - current home loan balance
//   interestRate        - home loan annual rate (non-deductible portion, e.g. 0.06)
//   investmentRate      - investment loan annual rate (deductible; defaults to interestRate)
//   investmentLoanTerm  - investment loan term in years for P&I amortisation
//   monthlyRepayment    - scheduled monthly repayment on home loan
//   recycleAmount       - amount being recycled (offset balance or equity released)
//   taxRate             - marginal tax rate (e.g. 0.345)
//   investmentReturn    - total expected annual return (e.g. 0.07)
//   dividendYield       - portion paid as dividends / rental yield (e.g. 0.04)
//   frankingPct         - fraction of dividends that are franked (0–1, default 0)
//   years               - projection length
//   propertyValue       - used for LVR check (mode 2 & 3)
//   releaseAmount       - equity being released (mode 2 & 3; 0 for offset mode)

function _pmt(principal, annualRate, termYears) {
  if (principal <= 0 || termYears <= 0) return 0;
  if (annualRate === 0) return principal / (termYears * 12);
  const m = annualRate / 12;
  const n = termYears * 12;
  return principal * m * Math.pow(1 + m, n) / (Math.pow(1 + m, n) - 1);
}

function runScenario(inputs) {
  const {
    loanBalance,
    interestRate,
    monthlyRepayment,
    recycleAmount,
    taxRate,
    investmentReturn,
    dividendYield,
    years,
    propertyValue = 0,
    releaseAmount = 0,
  } = inputs;

  const investmentRate     = inputs.investmentRate     ?? interestRate;
  const investmentLoanTerm = inputs.investmentLoanTerm ?? null;
  const frankingPct        = inputs.frankingPct        ?? 0;  // 0–1 fraction

  // Fixed annual P&I repayment on investment loan.
  // null investmentLoanTerm → interest-only (IO): no principal reduction.
  const annualInvRepayment = investmentLoanTerm
    ? _pmt(recycleAmount, investmentRate, investmentLoanTerm) * 12
    : null;

  const lvrWarning = propertyValue > 0
    ? (loanBalance / propertyValue) + (releaseAmount / propertyValue) > 0.80
    : false;

  let nonDeductible  = loanBalance - recycleAmount;
  let deductible     = recycleAmount;
  let investmentValue = recycleAmount;
  let baselineBalance = loanBalance;

  const annualRepayment = monthlyRepayment * 12;
  const result = [];

  for (let y = 1; y <= years; y++) {
    // Investment loan: interest on current (decreasing) balance
    const deductibleInterest = deductible * investmentRate;
    const taxSaving          = deductibleInterest * taxRate;
    const netInterestCost    = deductibleInterest - taxSaving;

    // Portfolio grows by capital appreciation only.
    // Dividends are paid out as cash and flow toward investment loan repayment.
    const grossDividends = investmentValue * dividendYield;
    const frankingCredit = grossDividends * frankingPct * (30 / 70);
    const netDividends   = (grossDividends + frankingCredit) * (1 - taxRate);
    const capitalGrowth  = investmentValue * (investmentReturn - dividendYield);
    investmentValue      = investmentValue + capitalGrowth;

    // Net cash from recycling this year:
    //   after-tax dividends + tax refund − investment loan repayment
    // IO fallback: annualInvRepayment = deductibleInterest → simplifies to netDividends − netInterestCost
    const invRepayment   = annualInvRepayment ?? deductibleInterest;
    const netCashFlow    = netDividends + taxSaving - invRepayment;
    const extraRepayment = Math.max(netCashFlow, 0);

    // Reduce investment loan by principal portion of P&I repayment (P&I mode only)
    if (annualInvRepayment !== null) {
      const invPrincipal = Math.max(annualInvRepayment - deductibleInterest, 0);
      deductible = Math.max(deductible - invPrincipal, 0);
    }

    // Reduce home loan (non-deductible) by scheduled P&I + any surplus cash flow
    const nonDeductibleInterest = nonDeductible * interestRate;
    const scheduledPrincipal    = Math.max(annualRepayment - nonDeductibleInterest, 0);
    nonDeductible = Math.max(nonDeductible - scheduledPrincipal - extraRepayment, 0);

    // Baseline: same scheduled repayment, no recycling
    const baselineInterest  = baselineBalance * interestRate;
    const baselinePrincipal = Math.max(annualRepayment - baselineInterest, 0);
    baselineBalance = Math.max(baselineBalance - baselinePrincipal, 0);

    result.push({
      year: y,
      nonDeductibleBalance: nonDeductible,
      deductibleBalance: deductible,
      totalLoanBalance: nonDeductible + deductible,
      baselineBalance,
      investmentValue,
      deductibleInterest,
      taxSaving,
      netInterestCost,
      netDividends,
      netCashFlow,
      extraRepayment,
      investmentLoanMonthlyRepayment: deductibleInterest / 12,
      effectiveInvestmentRate: investmentRate * (1 - taxRate),
      netWealthRecycling: investmentValue - nonDeductible - deductible,
      netWealthBaseline: -baselineBalance,
      lvrWarning,
    });
  }

  return result;
}

if (typeof module !== 'undefined') module.exports = { runScenario };
