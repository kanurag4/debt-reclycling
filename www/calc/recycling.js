// Year-by-year debt recycling projection engine.
// All inputs are numbers; returns array of annual snapshots.
//
// inputs:
//   loanBalance               - current home loan balance
//   interestRate              - home loan annual rate (non-deductible portion, e.g. 0.06)
//   investmentRate            - investment loan annual rate (deductible; defaults to interestRate)
//   investmentLoanTerm        - investment loan term in years for P&I amortisation
//   monthlyRepayment          - scheduled monthly repayment on home loan
//   recycleAmount             - amount being recycled (offset balance or equity released)
//   taxRate                   - marginal tax rate (e.g. 0.32)
//   investmentReturn          - total expected annual return (e.g. 0.07)
//   dividendYield             - portion paid as dividends / rental yield (e.g. 0.04)
//   frankingPct               - fraction of dividends that are franked (0–1, default 0)
//   maintenanceCost           - annual property maintenance cost in $ (deductible; default 0)
//   years                     - projection length
//   propertyValue             - used for LVR check (mode 2 & 3)
//   releaseAmount             - equity being released (mode 2 & 3; 0 for offset mode)
//   negativeGearingRestricted - when true, cap tax saving at rental income (no salary offset)
//   cgtRules                  - 'pre-budget' (50% discount) | 'post-budget' (30% min, default)
//   ipPrice                   - investment property purchase price; triggers full-value CGT calc
//   inflationRate             - annual inflation for post-budget CGT indexation (default 0.025)

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
    recycleAmount: rawRecycle,
    taxRate,
    investmentReturn,
    dividendYield,
    years,
    propertyValue = 0,
    releaseAmount = 0,
  } = inputs;

  // Clamp: can't recycle more than the loan balance (offset can't exceed what's owed)
  const recycleAmount = Math.min(rawRecycle, loanBalance);

  const investmentRate              = inputs.investmentRate              ?? interestRate;
  const investmentLoanTerm          = inputs.investmentLoanTerm          ?? null;
  const frankingPct                 = inputs.frankingPct                 ?? 0;    // 0–1 fraction
  const maintenanceCost             = inputs.maintenanceCost             ?? 0;    // annual $, deductible
  const negativeGearingRestricted   = inputs.negativeGearingRestricted   ?? false;
  const cgtRules                    = inputs.cgtRules                    ?? 'post-budget';
  const ipPrice                     = inputs.ipPrice                     ?? 0;    // property purchase price
  const inflationRate               = inputs.inflationRate               ?? 0.025; // for post-budget CGT indexation

  // Fixed annual P&I repayment on investment loan.
  // null investmentLoanTerm → interest-only (IO): no principal reduction.
  const annualInvRepayment = investmentLoanTerm
    ? _pmt(recycleAmount, investmentRate, investmentLoanTerm) * 12
    : null;

  const lvrWarning = propertyValue > 0
    ? (loanBalance / propertyValue) + (releaseAmount / propertyValue) > 0.80
    : false;

  let nonDeductible   = loanBalance - recycleAmount;
  let deductible      = recycleAmount;
  let investmentValue = recycleAmount;
  let baselineBalance = loanBalance;

  // CGT tracking: for property use full purchase price; for shares use recycleAmount
  const cgtCostBase       = ipPrice > 0 ? ipPrice : recycleAmount;
  const ipGrowthRate      = investmentReturn - dividendYield;  // capital-only growth rate
  let fullPropertyValue   = ipPrice > 0 ? ipPrice : 0;

  const annualRepayment = monthlyRepayment * 12;
  const result = [];

  for (let y = 1; y <= years; y++) {
    // Investment loan: interest on current (decreasing) balance
    const deductibleInterest = deductible * investmentRate;

    // Portfolio grows by capital appreciation only.
    // Dividends are paid out as cash and flow toward investment loan repayment.
    const grossDividends = investmentValue * dividendYield;
    const frankingCredit = grossDividends * frankingPct * (30 / 70);
    const netDividends   = (grossDividends + frankingCredit) * (1 - taxRate);
    const capitalGrowth  = investmentValue * (investmentReturn - dividendYield);
    investmentValue      = investmentValue + capitalGrowth;

    // Tax saving covers deductible interest + maintenance.
    // When negativeGearingRestricted, cap at rental income so no losses offset salary.
    const effectiveDeductible = negativeGearingRestricted
      ? Math.min(deductibleInterest + maintenanceCost, grossDividends)
      : (deductibleInterest + maintenanceCost);
    const taxSaving      = effectiveDeductible * taxRate;
    const netInterestCost = deductibleInterest - deductibleInterest * taxRate;

    // Net cash from recycling this year:
    //   after-tax dividends + tax refund (interest + maintenance) − investment loan repayment − gross maintenance
    // taxSaving already includes the maintenance deduction benefit, so subtract gross maintenance here.
    // IO fallback: annualInvRepayment = deductibleInterest → simplifies to netDividends − netInterestCost
    const invRepayment       = annualInvRepayment ?? deductibleInterest;
    const netMaintenanceCost = maintenanceCost;
    const netCashFlow        = netDividends + taxSaving - invRepayment - netMaintenanceCost;
    const extraRepayment     = Math.max(netCashFlow, 0);

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

    // CGT liability if the investor exited in this year
    if (ipPrice > 0) {
      fullPropertyValue *= (1 + ipGrowthRate);
    }
    const cgtBase = ipPrice > 0 ? fullPropertyValue : investmentValue;

    let cgtLiability;
    if (cgtRules === 'pre-budget') {
      // 50% CGT discount on nominal gain
      const nominalGain = Math.max(cgtBase - cgtCostBase, 0);
      cgtLiability = nominalGain * 0.5 * taxRate;
    } else {
      // Post-budget: inflation-indexation reduces taxable gain; 30% minimum tax applies
      const indexedCostBase = cgtCostBase * Math.pow(1 + inflationRate, y);
      const indexedGain     = Math.max(cgtBase - indexedCostBase, 0);
      cgtLiability = indexedGain * Math.max(0.30, taxRate);
    }

    const netWealthRecycling = investmentValue - nonDeductible - deductible;
    const netWealthAfterCGT  = netWealthRecycling - cgtLiability;

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
      netWealthRecycling,
      netWealthBaseline: -baselineBalance,
      cgtLiability,
      netWealthAfterCGT,
    });
  }

  // Attach lvrWarning to the array so callers get a single flag, not per-row noise
  result.lvrWarning = lvrWarning;
  return result;
}

if (typeof module !== 'undefined') module.exports = { runScenario };
