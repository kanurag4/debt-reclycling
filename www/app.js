// Main UI logic — only file allowed to touch the DOM or localStorage.

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = 'debt_recycling_inputs';

const els = {
  tabs:               document.querySelectorAll('.tab-btn'),
  // home loan
  loanBalance:        $('loanBalance'),
  propertyValue:      $('propertyValue'),
  interestRate:       $('interestRate'),
  loanTerm:           $('loanTerm'),
  monthlyRepayment:   $('monthlyRepayment'),
  autoRepayTag:       $('autoRepayTag'),
  resetRepayBtn:      $('resetRepayBtn'),
  // offset
  offsetBalance:      $('offsetBalance'),
  // stocks
  equityRelease:      $('equityRelease'),
  refinancingCosts:   $('refinancingCosts'),
  // property
  equityReleaseP:     $('equityReleaseP'),
  ipPrice:            $('ipPrice'),
  rentalYield:        $('rentalYield'),
  ipGrowth:           $('ipGrowth'),
  stampDuty:          $('stampDuty'),
  autoStampTag:       $('autoStampTag'),
  resetStampBtn:      $('resetStampBtn'),
  netEquityDisplay:   $('netEquityDisplay'),
  maintenanceCost:    $('maintenanceCost'),
  autoMaintTag:       $('autoMaintTag'),
  resetMaintBtn:      $('resetMaintBtn'),
  maintPctDisplay:    $('maintPctDisplay'),
  // investment loan
  investmentRate:       $('investmentRate'),
  investmentLoanTerm:   $('investmentLoanTerm'),
  effectiveRateDisplay: $('effectiveRateDisplay'),
  invLoanRepayDisplay:  $('invLoanRepayDisplay'),
  // income
  income:             $('income'),
  taxRateOverride:    $('taxRateOverride'),
  taxRateDerived:     $('taxRateDerived'),
  // investment assumptions
  investmentReturn:   $('investmentReturn'),
  dividendYield:      $('dividendYield'),
  frankingPct:        $('frankingPct'),
  years:              $('years'),
  yearsLabel:         $('yearsLabel'),
  sensitivityCheck:   $('sensitivityCheck'),
  // property
  propertyState:      $('propertyState'),
  // warnings
  lvrWarning:         $('lvr-warning'),
  repaymentWarning:   $('repayment-warning'),
  // buttons
  calculateBtn:       $('calculateBtn'),
  resetBtn:           $('resetBtn'),
  downloadPdfBtn:     $('downloadPdfBtn'),
  // results
  placeholder:        $('placeholder'),
  results:            $('results'),
  cardTaxSaving:      $('cardTaxSaving'),
  cardTotalTax:       $('cardTotalTax'),
  cardTotalTaxSub:    $('cardTotalTaxSub'),
  cardWealthGain:     $('cardWealthGain'),
  cardWealthSub:      $('cardWealthSub'),
  verdict:            $('verdict'),
  outOfPocketNote:    $('outOfPocketNote'),
  yearTableBody:      $('yearTableBody'),
};

let activeTab = 'offset';
let loanChart = null;
let wealthChart = null;
let repaymentManual = false;
let stampDutyManual = false;
let maintenanceCostManual = false;

const DEFAULTS = {
  loanBalance: 600000, propertyValue: 900000, interestRate: 6.0,
  loanTerm: 30, monthlyRepayment: 0,
  offsetBalance: 100000,
  equityRelease: 100000, refinancingCosts: 0,
  equityReleaseP: 100000, ipPrice: 600000, rentalYield: 4.0, ipGrowth: 5.0, stampDuty: 0,
  maintenanceCost: 0, maintenanceCostManual: false,
  propertyState: 'NSW',
  investmentRate: 6.0, investmentLoanTerm: 30,
  income: 120000, taxRateOverride: '',
  investmentReturn: 7.0, dividendYield: 4.0, frankingPct: 0, years: 20,
  sensitivityCheck: false,
  tab: 'offset', repaymentManual: false, stampDutyManual: false,
};

const STAMP_DUTY_RATES = {
  NSW: 0.039, VIC: 0.055, QLD: 0.035, SA: 0.040,
  WA: 0.035, TAS: 0.035, ACT: 0.035, NT: 0.045,
};

// ── Money formatting ──────────────────────────────────────────────────────────

function parseMoney(el) {
  const raw = String(el.value).replace(/,/g, '').trim();
  if (/e/i.test(raw)) return 0;   // reject exponential notation (e.g. "1e6" → 1, not 1,000,000)
  return Math.round(parseFloat(raw)) || 0;
}

function formatMoneyVal(n) {
  const num = parseInt(String(n).replace(/,/g, ''), 10);
  return isNaN(num) || num === 0 ? '' : num.toLocaleString('en-AU');
}

function formatMoneyInput(el) {
  const pos = el.selectionStart;
  const oldVal = el.value;
  const digitsBeforeCursor = (oldVal.slice(0, pos).match(/\d/g) || []).length;

  const raw = oldVal.replace(/[^\d]/g, '');
  if (!raw) { el.value = ''; return; }

  const formatted = Number(raw).toLocaleString('en-AU');
  el.value = formatted;

  // Restore cursor position relative to digit count
  let digitCount = 0;
  let newPos = formatted.length;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) digitCount++;
    if (digitCount === digitsBeforeCursor) { newPos = i + 1; break; }
  }
  el.setSelectionRange(newPos, newPos);
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadFromStorage();
updateTaxRateDisplay();
updateEffectiveRate();
updateInvLoanRepay();
updateYearsLabel();
bindEvents();

// ── Events ───────────────────────────────────────────────────────────────────

function bindEvents() {
  els.tabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // Money input formatting
  document.querySelectorAll('.money-input').forEach(el => {
    el.addEventListener('input', () => formatMoneyInput(el));
  });

  // Auto-repayment
  els.loanBalance.addEventListener('input', onLoanDetailsChange);
  els.interestRate.addEventListener('input', onLoanDetailsChange);
  els.loanTerm.addEventListener('input', onLoanDetailsChange);
  els.monthlyRepayment.addEventListener('input', onRepaymentManualEdit);
  els.resetRepayBtn.addEventListener('click', onResetRepayment);

  // Auto stamp duty + auto maintenance
  els.ipPrice.addEventListener('input', onIpPriceChange);
  els.stampDuty.addEventListener('input', onStampDutyManualEdit);
  els.resetStampBtn.addEventListener('click', onResetStampDuty);
  els.propertyState.addEventListener('change', () => {
    if (!stampDutyManual) autoCalcStampDuty();
    saveToStorage();
  });
  els.maintenanceCost.addEventListener('input', onMaintenanceCostManualEdit);
  els.resetMaintBtn.addEventListener('click', onResetMaintenanceCost);

  // Effective rate + monthly cost
  els.income.addEventListener('input', () => { updateTaxRateDisplay(); updateEffectiveRate(); });
  els.taxRateOverride.addEventListener('input', updateEffectiveRate);
  els.investmentRate.addEventListener('input', () => { updateEffectiveRate(); updateInvLoanRepay(); });
  els.investmentLoanTerm.addEventListener('input', updateInvLoanRepay);
  els.offsetBalance.addEventListener('input', updateInvLoanRepay);
  els.equityRelease.addEventListener('input', updateInvLoanRepay);
  els.equityReleaseP.addEventListener('input', () => { updateInvLoanRepay(); updateNetEquity(); });
  els.stampDuty.addEventListener('input', () => { updateInvLoanRepay(); updateNetEquity(); });

  els.years.addEventListener('input', updateYearsLabel);
  els.calculateBtn.addEventListener('click', onCalculate);
  els.resetBtn.addEventListener('click', onReset);
  els.downloadPdfBtn.addEventListener('click', () => window.print());

  // Resize charts when year table opens — prevents Chart.js overdrawing on layout shift
  $('yearDetails').addEventListener('toggle', () => {
    if (loanChart)   loanChart.resize();
    if (wealthChart) wealthChart.resize();
  });

  document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', saveToStorage));
}

function switchTab(tab) {
  activeTab = tab;
  els.tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.strategy-fields').forEach(el => el.classList.remove('active'));
  $(`fields-${tab}`).classList.add('active');
  $('inv-stocks-fields').style.display = tab === 'property' ? 'none' : '';
  updateInvLoanRepay();
  saveToStorage();
}

// ── Auto-repayment ─────────────────────────────────────────────────────────────

function onLoanDetailsChange() {
  if (!repaymentManual) autoCalcRepayment();
}

function autoCalcRepayment() {
  const balance = parseMoney(els.loanBalance);
  const rate    = (parseFloat(els.interestRate.value) || 0) / 100;
  const term    = parseInt(els.loanTerm.value) || 30;
  if (balance > 0 && rate > 0 && term > 0) {
    els.monthlyRepayment.value = formatMoneyVal(Math.round(monthlyPayment(balance, rate, term)));
  }
  els.autoRepayTag.classList.remove('hidden');
  saveToStorage();
}

function onRepaymentManualEdit() {
  repaymentManual = true;
  els.autoRepayTag.classList.add('hidden');
}

function onResetRepayment() {
  repaymentManual = false;
  autoCalcRepayment();
}

// ── Auto stamp duty ────────────────────────────────────────────────────────────

function onIpPriceChange() {
  if (!stampDutyManual) autoCalcStampDuty();
  if (!maintenanceCostManual) autoCalcMaintenance();
}

function autoCalcStampDuty() {
  const price = parseMoney(els.ipPrice);
  const rate  = STAMP_DUTY_RATES[els.propertyState.value] ?? 0.039;
  els.stampDuty.value = formatMoneyVal(Math.round(price * rate));
  els.autoStampTag.classList.remove('hidden');
  updateNetEquity();
  updateInvLoanRepay();
  saveToStorage();
}

function onStampDutyManualEdit() {
  stampDutyManual = true;
  els.autoStampTag.classList.add('hidden');
  updateNetEquity();
}

function onResetStampDuty() {
  stampDutyManual = false;
  autoCalcStampDuty();
}

// ── Auto maintenance cost ───────────────────────────────────────────────────────

function autoCalcMaintenance() {
  const price = parseMoney(els.ipPrice);
  els.maintenanceCost.value = price > 0 ? formatMoneyVal(Math.round(price * 0.01)) : '';
  els.autoMaintTag.classList.remove('hidden');
  updateMaintPctDisplay();
  saveToStorage();
}

function onMaintenanceCostManualEdit() {
  maintenanceCostManual = true;
  els.autoMaintTag.classList.add('hidden');
  updateMaintPctDisplay();
}

function onResetMaintenanceCost() {
  maintenanceCostManual = false;
  autoCalcMaintenance();
}

function updateMaintPctDisplay() {
  const price = parseMoney(els.ipPrice);
  const cost  = parseMoney(els.maintenanceCost);
  if (price > 0 && cost > 0) {
    const pct = (cost / price * 100).toFixed(1);
    els.maintPctDisplay.textContent = `${pct}% of purchase price / yr`;
  } else if (price > 0) {
    els.maintPctDisplay.textContent = '0% of purchase price';
  } else {
    els.maintPctDisplay.textContent = '—';
  }
}

function updateNetEquity() {
  const equity = parseMoney(els.equityReleaseP);
  const duty   = parseMoney(els.stampDuty);
  const net    = equity - duty;
  els.netEquityDisplay.textContent = net > 0
    ? `Net deposit after costs: ${formatCurrency(net)}`
    : net < 0
      ? 'Stamp duty exceeds equity released — increase equity or reduce costs'
      : 'Net deposit after costs: —';
  els.netEquityDisplay.style.color = net < 0 ? 'var(--kv-fail)' : '';
}

// ── Derived displays ──────────────────────────────────────────────────────────

function updateTaxRateDisplay() {
  if (!String(els.income.value).replace(/,/g, '').trim()) {
    els.taxRateDerived.textContent = 'Marginal rate: —';
    return;
  }
  const rate = marginalRate(parseMoney(els.income));
  els.taxRateDerived.textContent = `Marginal rate: ${(rate * 100).toFixed(1)}%`;
}

function updateEffectiveRate() {
  const invRate = (parseFloat(els.investmentRate.value) || 0) / 100;
  const override = parseFloat(els.taxRateOverride.value);
  const taxRate = isFinite(override) && els.taxRateOverride.value !== ''
    ? override / 100
    : marginalRate(parseMoney(els.income));
  const effective = invRate * (1 - taxRate);
  els.effectiveRateDisplay.textContent = invRate > 0
    ? `Effective rate after tax: ${(effective * 100).toFixed(2)}% (saves ${((invRate - effective) * 100).toFixed(2)}% p.a.)`
    : 'Effective rate after tax: —';
}

function updateInvLoanRepay() {
  const rate = (parseFloat(els.investmentRate.value) || 0) / 100;
  const term = parseInt(els.investmentLoanTerm.value) || 30;

  let amount = 0;
  if (activeTab === 'offset')        amount = parseMoney(els.offsetBalance);
  else if (activeTab === 'stocks')   amount = parseMoney(els.equityRelease);
  else if (activeTab === 'property') amount = Math.max(parseMoney(els.equityReleaseP) - parseMoney(els.stampDuty), 0);

  if (amount <= 0 || rate <= 0) {
    els.invLoanRepayDisplay.textContent = 'Monthly interest (I/O): —';
    return;
  }

  const monthlyIO  = (amount * rate) / 12;
  const monthlyPI  = monthlyPayment(amount, rate, term);
  els.invLoanRepayDisplay.textContent =
    `Monthly interest (I/O): ${formatCurrency(monthlyIO)} | P&I over ${term} yrs: ${formatCurrency(monthlyPI)}`;
}

function updateYearsLabel() {
  els.yearsLabel.textContent = `${els.years.value} years`;
}

// ── Storage ───────────────────────────────────────────────────────────────────

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tab: activeTab, repaymentManual, stampDutyManual, maintenanceCostManual,
    loanBalance:      els.loanBalance.value,
    propertyValue:    els.propertyValue.value,
    interestRate:     els.interestRate.value,
    loanTerm:         els.loanTerm.value,
    monthlyRepayment: els.monthlyRepayment.value,
    offsetBalance:    els.offsetBalance.value,
    equityRelease:    els.equityRelease.value,
    refinancingCosts: els.refinancingCosts.value,
    equityReleaseP:   els.equityReleaseP.value,
    ipPrice:          els.ipPrice.value,
    rentalYield:      els.rentalYield.value,
    ipGrowth:         els.ipGrowth.value,
    stampDuty:        els.stampDuty.value,
    maintenanceCost:  els.maintenanceCost.value,
    propertyState:    els.propertyState.value,
    investmentRate:      els.investmentRate.value,
    investmentLoanTerm:  els.investmentLoanTerm.value,
    income:           els.income.value,
    taxRateOverride:  els.taxRateOverride.value,
    investmentReturn: els.investmentReturn.value,
    dividendYield:    els.dividendYield.value,
    frankingPct:      els.frankingPct.value,
    years:            els.years.value,
    sensitivityCheck: els.sensitivityCheck.checked,
  }));
}

function loadFromStorage() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
  const d = Object.assign({}, DEFAULTS, data);

  repaymentManual = !!d.repaymentManual;
  stampDutyManual = !!d.stampDutyManual;
  maintenanceCostManual = !!d.maintenanceCostManual;

  // Money fields (formatted with commas)
  els.loanBalance.value      = formatMoneyVal(d.loanBalance);
  els.propertyValue.value    = formatMoneyVal(d.propertyValue);
  els.monthlyRepayment.value = formatMoneyVal(d.monthlyRepayment);
  els.offsetBalance.value    = formatMoneyVal(d.offsetBalance);
  els.equityRelease.value    = formatMoneyVal(d.equityRelease);
  els.refinancingCosts.value = formatMoneyVal(d.refinancingCosts);
  els.equityReleaseP.value   = formatMoneyVal(d.equityReleaseP);
  els.ipPrice.value          = formatMoneyVal(d.ipPrice);
  els.stampDuty.value        = formatMoneyVal(d.stampDuty);
  els.maintenanceCost.value  = formatMoneyVal(d.maintenanceCost);
  els.income.value           = formatMoneyVal(d.income);

  // Non-money fields
  els.interestRate.value      = d.interestRate;
  els.loanTerm.value          = d.loanTerm;
  els.rentalYield.value       = d.rentalYield;
  els.ipGrowth.value          = d.ipGrowth;
  els.investmentRate.value    = d.investmentRate;
  els.investmentLoanTerm.value = d.investmentLoanTerm;
  els.taxRateOverride.value   = d.taxRateOverride;
  els.investmentReturn.value  = d.investmentReturn;
  els.dividendYield.value     = d.dividendYield;
  els.frankingPct.value          = d.frankingPct ?? 0;
  els.propertyState.value        = d.propertyState || 'NSW';
  els.years.value                = d.years;
  els.sensitivityCheck.checked   = !!d.sensitivityCheck;

  els.autoRepayTag.classList.toggle('hidden', repaymentManual);
  els.autoStampTag.classList.toggle('hidden', stampDutyManual);
  els.autoMaintTag.classList.toggle('hidden', maintenanceCostManual);

  if (!repaymentManual) autoCalcRepayment();
  if (!stampDutyManual) autoCalcStampDuty();
  if (!maintenanceCostManual) autoCalcMaintenance(); else updateMaintPctDisplay();

  updateNetEquity();
  switchTab(d.tab || 'offset');
}

function onReset() {
  localStorage.removeItem(STORAGE_KEY);
  repaymentManual = false;
  stampDutyManual = false;

  els.loanBalance.value      = formatMoneyVal(DEFAULTS.loanBalance);
  els.propertyValue.value    = formatMoneyVal(DEFAULTS.propertyValue);
  els.monthlyRepayment.value = '';
  els.offsetBalance.value    = formatMoneyVal(DEFAULTS.offsetBalance);
  els.equityRelease.value    = formatMoneyVal(DEFAULTS.equityRelease);
  els.refinancingCosts.value = '';
  els.equityReleaseP.value   = formatMoneyVal(DEFAULTS.equityReleaseP);
  els.ipPrice.value          = formatMoneyVal(DEFAULTS.ipPrice);
  els.stampDuty.value        = '';
  els.maintenanceCost.value  = '';
  maintenanceCostManual      = false;
  els.income.value           = formatMoneyVal(DEFAULTS.income);

  els.interestRate.value       = DEFAULTS.interestRate;
  els.loanTerm.value           = DEFAULTS.loanTerm;
  els.rentalYield.value        = DEFAULTS.rentalYield;
  els.ipGrowth.value           = DEFAULTS.ipGrowth;
  els.investmentRate.value     = DEFAULTS.investmentRate;
  els.investmentLoanTerm.value = DEFAULTS.investmentLoanTerm;
  els.taxRateOverride.value    = '';
  els.investmentReturn.value   = DEFAULTS.investmentReturn;
  els.dividendYield.value      = DEFAULTS.dividendYield;
  els.frankingPct.value        = DEFAULTS.frankingPct;
  els.propertyState.value      = DEFAULTS.propertyState;
  els.years.value              = DEFAULTS.years;

  els.autoRepayTag.classList.remove('hidden');
  els.autoStampTag.classList.remove('hidden');
  els.autoMaintTag.classList.remove('hidden');

  switchTab('offset');
  updateTaxRateDisplay();
  updateEffectiveRate();
  autoCalcRepayment();
  autoCalcStampDuty();
  autoCalcMaintenance();
  updateInvLoanRepay();
  updateNetEquity();
  updateYearsLabel();
  hideResults();
}

// ── Calculate ─────────────────────────────────────────────────────────────────

function onCalculate() {
  saveToStorage();

  const loanBalance      = parseMoney(els.loanBalance);
  const propertyValue    = parseMoney(els.propertyValue);
  const interestRate     = (parseFloat(els.interestRate.value) || 0) / 100;
  const monthlyRepayment = parseMoney(els.monthlyRepayment);
  const income           = parseMoney(els.income);
  const years            = parseInt(els.years.value) || 20;
  const investmentRate   = (parseFloat(els.investmentRate.value) || 0) / 100;

  let investmentReturn, dividendYield;
  if (activeTab === 'property') {
    dividendYield    = (parseFloat(els.rentalYield.value) || 0) / 100;
    investmentReturn = (parseFloat(els.ipGrowth.value)   || 0) / 100 + dividendYield;
  } else {
    investmentReturn = (parseFloat(els.investmentReturn.value) || 0) / 100;
    dividendYield    = (parseFloat(els.dividendYield.value)    || 0) / 100;
  }

  const override = parseFloat(els.taxRateOverride.value);
  const taxRate = isFinite(override) && els.taxRateOverride.value !== ''
    ? override / 100
    : marginalRate(income);

  let recycleAmount = 0;
  let releaseAmount = 0;

  if (activeTab === 'offset') {
    recycleAmount = parseMoney(els.offsetBalance);
  } else if (activeTab === 'stocks') {
    const equityGross = parseMoney(els.equityRelease);
    const refCosts    = parseMoney(els.refinancingCosts);
    recycleAmount = Math.max(equityGross - refCosts, 0);
    releaseAmount = equityGross;
  } else if (activeTab === 'property') {
    const equityGross = parseMoney(els.equityReleaseP);
    const stampDuty   = parseMoney(els.stampDuty);
    recycleAmount = Math.max(equityGross - stampDuty, 0);
    releaseAmount = equityGross;
  }

  const interestOnlyMin = (loanBalance * interestRate) / 12;
  els.repaymentWarning.style.display = monthlyRepayment < interestOnlyMin ? 'block' : 'none';

  const investmentLoanTerm = parseInt(els.investmentLoanTerm.value) || 30;

  const frankingPct = (parseFloat(els.frankingPct.value) || 0) / 100;
  const maintenanceCost = activeTab === 'property' ? parseMoney(els.maintenanceCost) : 0;

  const scenarioInputs = {
    loanBalance, interestRate, investmentRate, investmentLoanTerm,
    monthlyRepayment, recycleAmount,
    taxRate, investmentReturn, dividendYield, frankingPct, maintenanceCost,
    years, propertyValue, releaseAmount,
  };

  const rows = runScenario(scenarioInputs);

  let rowsHigh = null, rowsLow = null;
  if (els.sensitivityCheck.checked) {
    rowsHigh = runScenario({ ...scenarioInputs, investmentReturn: investmentReturn + 0.02 });
    rowsLow  = runScenario({ ...scenarioInputs, investmentReturn: Math.max(investmentReturn - 0.02, 0) });
  }

  const totalTaxSaved = rows.reduce((sum, r) => sum + r.taxSaving, 0);

  if (rows.lvrWarning) {
    const lvr = ((loanBalance + releaseAmount) / propertyValue * 100).toFixed(1);
    els.lvrWarning.style.display = 'block';
    els.lvrWarning.textContent = `LVR after release: ${lvr}% — exceeds 80%. Lenders may require LMI or decline.`;
  } else {
    els.lvrWarning.style.display = 'none';
  }

  renderResults(rows, years, { totalTaxSaved, rowsHigh, rowsLow });
}

// ── Render ────────────────────────────────────────────────────────────────────

function populatePrintInputs() {
  const override = parseFloat(els.taxRateOverride.value);
  const taxRate = isFinite(override) && els.taxRateOverride.value !== ''
    ? override / 100
    : marginalRate(parseMoney(els.income));

  const tabLabel = {
    offset: 'Offset Strategy',
    stocks: 'Equity → Stocks/ETFs',
    property: 'Equity → Investment Property',
  }[activeTab];

  const pairs = [
    ['Strategy',          tabLabel],
    ['Loan Balance',      formatCurrency(parseMoney(els.loanBalance))],
    ['Property Value',    formatCurrency(parseMoney(els.propertyValue))],
    ['Home Loan Rate',    els.interestRate.value + '% p.a.'],
    ['Loan Term',         els.loanTerm.value + ' yrs'],
    ['Monthly Repayment', formatCurrency(parseMoney(els.monthlyRepayment))],
  ];

  if (activeTab === 'offset') {
    pairs.push(['Offset Balance', formatCurrency(parseMoney(els.offsetBalance))]);
  } else if (activeTab === 'stocks') {
    pairs.push(['Equity Release', formatCurrency(parseMoney(els.equityRelease))]);
    const ref = parseMoney(els.refinancingCosts);
    if (ref > 0) pairs.push(['Refinancing Costs', formatCurrency(ref)]);
  } else if (activeTab === 'property') {
    pairs.push(
      ['Equity Release',   formatCurrency(parseMoney(els.equityReleaseP))],
      ['IP Purchase Price', formatCurrency(parseMoney(els.ipPrice))],
      ['Rental Yield',     els.rentalYield.value + '% p.a.'],
      ['Capital Growth',   els.ipGrowth.value + '% p.a.'],
      ['State',            els.propertyState.value],
      ['Stamp Duty',       formatCurrency(parseMoney(els.stampDuty))],
      ['Annual Maintenance', formatCurrency(parseMoney(els.maintenanceCost))],
    );
  }

  pairs.push(
    ['Inv. Loan Rate', els.investmentRate.value + '% p.a.'],
    ['Inv. Loan Term', els.investmentLoanTerm.value + ' yrs'],
    ['Annual Income',  formatCurrency(parseMoney(els.income))],
    ['Tax Rate',       (taxRate * 100).toFixed(1) + '%'],
  );

  if (activeTab !== 'property') {
    pairs.push(
      ['Expected Return', els.investmentReturn.value + '% p.a.'],
      ['Dividend Yield',  els.dividendYield.value + '% p.a.'],
    );
    const franking = parseFloat(els.frankingPct.value) || 0;
    if (franking > 0) pairs.push(['Franking', franking + '% franked']);
  }

  pairs.push(['Projection', els.years.value + ' years']);

  $('printInputsGrid').innerHTML = pairs.map(([label, value]) =>
    `<div class="pi-row"><span class="pi-label">${label}</span><span class="pi-value">${value}</span></div>`
  ).join('');
}

function renderResults(rows, years, { totalTaxSaved, rowsHigh = null, rowsLow = null }) {
  els.placeholder.style.display = 'none';
  els.results.style.display = 'flex';
  populatePrintInputs();

  const last  = rows[rows.length - 1];
  const first = rows[0];

  // Tax saving (year 1)
  els.cardTaxSaving.textContent = formatCurrency(first.taxSaving);

  // Total tax saved over projection
  els.cardTotalTax.textContent    = formatCurrency(totalTaxSaved);
  els.cardTotalTax.className      = 'card-value pass';
  els.cardTotalTaxSub.textContent = `over ${years} years`;

  // Wealth gain
  const wealthGain = last.netWealthRecycling - last.netWealthBaseline;
  els.cardWealthGain.textContent = formatCurrency(wealthGain);
  els.cardWealthGain.className   = `card-value ${wealthGain >= 0 ? 'pass' : 'fail'}`;
  els.cardWealthSub.textContent  = `after ${years} years`;

  // Verdict
  const v = els.verdict;
  if (wealthGain > 50000) {
    v.className   = 'verdict pass';
    v.textContent = `Profitable — recycling builds ${formatCurrency(wealthGain)} more wealth over ${years} years.`;
  } else if (wealthGain > 0) {
    v.className   = 'verdict warn';
    v.textContent = `Marginal benefit — ${formatCurrency(wealthGain)} ahead after ${years} years. Consider transaction costs.`;
  } else {
    v.className   = 'verdict fail';
    v.textContent = `Not beneficial under these assumptions — recycling trails by ${formatCurrency(Math.abs(wealthGain))}.`;
  }

  // Out-of-pocket note (negatively geared)
  const year1CashFlow = first.netCashFlow;
  if (year1CashFlow < 0) {
    els.outOfPocketNote.style.display = 'block';
    els.outOfPocketNote.textContent =
      `Out-of-pocket cost: ~${formatCurrency(Math.round(-year1CashFlow))}/yr from salary — this strategy is negatively geared. You fund the shortfall from your income.`;
  } else {
    els.outOfPocketNote.style.display = 'none';
  }

  // Charts
  const labels = rows.map(r => `Yr ${r.year}`);

  renderLineChart('loanChart', labels, [
    { label: 'Recycling (total loan)', data: rows.map(r => r.totalLoanBalance), color: '#38bdf8' },
    { label: 'Baseline (no recycling)', data: rows.map(r => r.baselineBalance),  color: '#94a3b8' },
  ], loanChart, c => { loanChart = c; });

  const wealthDatasets = [
    { label: 'Net Wealth (recycling)', data: rows.map(r => r.netWealthRecycling), color: '#22c55e' },
    { label: 'Net Wealth (baseline)',  data: rows.map(r => r.netWealthBaseline),  color: '#94a3b8' },
  ];
  if (rowsHigh) wealthDatasets.push(
    { label: 'Optimistic (+2%)', data: rowsHigh.map(r => r.netWealthRecycling), color: '#86efac', dash: [6, 4] }
  );
  if (rowsLow) wealthDatasets.push(
    { label: 'Pessimistic (−2%)', data: rowsLow.map(r => r.netWealthRecycling), color: '#f59e0b', dash: [6, 4] }
  );

  renderLineChart('wealthChart', labels, wealthDatasets, wealthChart, c => { wealthChart = c; });

  // Table
  els.yearTableBody.innerHTML = '';
  rows.forEach(r => {
    const wDiff = r.netWealthRecycling - r.netWealthBaseline;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.year}</td>
      <td>${formatCurrency(r.nonDeductibleBalance)}</td>
      <td>${formatCurrency(r.totalLoanBalance)}</td>
      <td>${formatCurrency(r.baselineBalance)}</td>
      <td>${formatCurrency(r.investmentValue)}</td>
      <td class="td-warn">${formatCurrency(r.deductibleInterest)}</td>
      <td class="td-pass">${formatCurrency(r.taxSaving)}</td>
      <td class="${r.netCashFlow >= 0 ? 'td-pass' : 'td-warn'}">${formatCurrency(r.netCashFlow)}</td>
      <td class="${wDiff >= 0 ? 'td-pass' : 'td-warn'}">${formatCurrency(r.netWealthRecycling)}</td>
      <td>${formatCurrency(r.netWealthBaseline)}</td>
    `;
    els.yearTableBody.appendChild(tr);
  });
}

function renderLineChart(canvasId, labels, datasets, existingChart, setChart) {
  if (existingChart) existingChart.destroy();
  const chart = new Chart($(canvasId).getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.label, data: d.data, borderColor: d.color,
        backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, tension: 0.3,
        borderDash: d.dash || [],
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#334155' } },
        y: {
          afterFit: (scale) => { scale.width = 88; },
          ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => formatCurrency(v), maxTicksLimit: 6 },
          grid: { color: '#334155' },
        },
      },
    },
  });
  setChart(chart);
}

function hideResults() {
  els.placeholder.style.display = '';
  els.results.style.display = 'none';
  els.lvrWarning.style.display = 'none';
  els.repaymentWarning.style.display = 'none';
  els.outOfPocketNote.style.display = 'none';
}
