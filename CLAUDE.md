# Debt Recycling Calculator — KashVector Tool

A vanilla JS web app that helps Australian homeowners model whether debt recycling is profitable for their situation. Part of the KashVector financial tools suite at kashvector.com.

**Live URL:** https://kashvector.com/debt-recycling/
**GitHub:** https://github.com/kanurag4/debt-reclycling

## What This Tool Does

Debt recycling converts non-deductible home loan debt into tax-deductible investment debt. Users can model three strategies:
1. **Offset Strategy** — use savings in offset account to invest (most common)
2. **Equity Release → Stocks/ETFs** — refinance to access equity, invest in market
3. **Equity Release → Investment Property** — refinance to use equity as deposit on IP

The tool shows: annual tax savings, total tax saved over projection, net wealth comparison with vs. without recycling, out-of-pocket salary cost (if negatively geared), ±2% sensitivity bands on the wealth chart, year-by-year projections, CGT-adjusted wealth, a "Without Budget Changes" comparison card, novice-friendly chart explainers, a column guide in the year table, and a full FAQ section.

## Tech Stack

- **Vanilla HTML/CSS/JS** — no build step, no npm in www/
- **Chart.js** — via CDN for line charts
- **No backend** — all calculations are client-side pure functions
- **LocalStorage** — persists user inputs between sessions

## Project Structure

```
www/
├── index.html          # Single-page UI
├── style.css           # KashVector dark theme
├── utils.js            # Pure helpers: fmt(), safe(), formatCurrency()
├── calc/
│   ├── amortization.js # loanSchedule(), monthlyPayment() — pure functions
│   ├── tax.js          # Australian tax brackets 2026-27, marginalRate()
│   └── recycling.js    # runScenario() — year-by-year projection engine
└── app.js              # ONLY file that touches the DOM
tests/
├── tax.test.js
├── amortization.test.js
├── recycling.test.js
└── utils.test.js
package.json            # "test": "node --test tests/*.test.js"
```

**Script load order** in `index.html`:
`utils.js` → `calc/tax.js` → `calc/amortization.js` → `calc/recycling.js` → `app.js`

## Critical Architecture Rule: DOM Boundary

**`app.js`** is the ONLY file allowed to:
- Read from `document` or `window`
- Write to DOM
- Handle user events
- Call `localStorage`

All other files (`utils.js`, `calc/*.js`) must be pure functions with zero DOM access. This is non-negotiable — it enables Capacitor mobile wrapping in future.

## Design System

Follows KashVector design rules. Source: `C:\Projects\Rules\kashvector-design.md`

### Colours (CSS variables)
```css
--kv-bg:       #0f172a   /* page background */
--kv-card:     #1e293b   /* card backgrounds */
--kv-card-2:   #273449   /* nested cards, inputs */
--kv-text:     #f1f5f9   /* primary text */
--kv-muted:    #94a3b8   /* secondary text */
--kv-accent:   #38bdf8   /* buttons, active states, UI chrome only */
--kv-accent-h: #0ea5e9   /* hover state */
--kv-border:   #334155   /* all borders */
--kv-pass:     #22c55e   /* positive values, savings, good outcomes */
--kv-fail:     #ef4444   /* negative values, warnings */
--kv-warn:     #f59e0b   /* caution states */
```

### Rules
- Always dark mode (no light toggle needed)
- `slate-*` colours only (never `gray-*` or `stone-*`)
- Accent (sky blue) for UI chrome only — never for semantic meaning
- Green = positive/savings, Red = negative/risk, Amber = caution
- All dollar inputs use `type="text" inputmode="numeric"` — never `type="number"` for money fields

## Calculation Logic

### Australian Tax Brackets (2026-27 + Medicare)

| Income | Marginal Rate |
| --- | --- |
| $0–$18,200 | 0% |
| $18,201–$45,000 | 17% (15% + 2% Medicare) |
| $45,001–$135,000 | 32% (30% + 2% Medicare) |
| $135,001–$190,000 | 39% (37% + 2% Medicare) |
| $190,001+ | 47% (45% + 2% Medicare) |

These are the Stage 3 + 2026 budget rates. The $45k and $135k thresholds replaced the old $120k/$180k thresholds from the Stage 3 cuts; the 15% base rate in the bottom bracket is new from the 2026 budget.

### Key Debt Recycling Mechanics (as implemented in `recycling.js`)

**Two separate loans:**
- Home loan (non-deductible): `interestRate`, scheduled P&I repayments, reduces each year
- Investment loan (deductible): `investmentRate` + `investmentLoanTerm`, P&I amortises each year

**Per-year calculation order:**
1. `deductibleInterest = deductible × investmentRate`
2. `effectiveDeductible = negativeGearingRestricted ? min(deductibleInterest + maintenanceCost, grossDividends) : (deductibleInterest + maintenanceCost)`
3. `taxSaving = effectiveDeductible × taxRate` — when restricted, capped at rental income so no excess loss offsets salary
4. `netInterestCost = deductibleInterest × (1 − taxRate)`
5. `grossDividends = investmentValue × dividendYield`
6. `frankingCredit = grossDividends × frankingPct × (30 / 70)` — 0 when frankingPct = 0
7. `netDividends = (grossDividends + frankingCredit) × (1 − taxRate)`
8. Portfolio grows by capital only: `investmentValue += investmentValue × (investmentReturn − dividendYield)`
   — dividends are paid out as cash, NOT reinvested in the portfolio
9. `annualInvRepayment = _pmt(recycleAmount, investmentRate, investmentLoanTerm) × 12` (fixed P&I)
10. `netMaintenanceCost = maintenanceCost` — gross cost; tax benefit already captured in `taxSaving` above
11. `netCashFlow = netDividends + taxSaving − annualInvRepayment − netMaintenanceCost`
12. `extraRepayment = max(netCashFlow, 0)` — positive cash flow → extra repayment on home loan
13. Investment loan principal reduces: `deductible -= max(annualInvRepayment − deductibleInterest, 0)`
14. Home loan reduces: `nonDeductible -= scheduledPrincipal + extraRepayment`

**Key invariants:**
- Tax saving covers both deductible interest AND maintenance cost (both are ATO-deductible for investment properties)
- When `negativeGearingRestricted=true`, tax saving is capped at `grossDividends × taxRate` — excess losses cannot offset salary
- Net effect on cash flow is still `maintenanceCost × (1 − taxRate)` — tax saving offsets part of the cost
- Dividends go to cash flow (loan repayment), not back into the portfolio
- No "ongoing recycling" — the scheduled home loan principal repayments are NOT redrawn as new investment debt
- Both loans decrease each year; total loan balance reduces steadily
- `recycleAmount` is clamped to `loanBalance` inside `runScenario` — the UI should never pass more than the loan balance, but the engine protects itself
- `runScenario()` returns an array with a `.lvrWarning` boolean property attached (not per-row): `rows.lvrWarning`

### CGT Calculation (per year, inside the loop)

Each row includes a CGT liability representing "tax owed if you exited this year", producing `netWealthAfterCGT`.

**Cost base and asset value:**
- Shares/ETFs (offset, stocks tabs): `cgtCostBase = recycleAmount`; `cgtBase = investmentValue`
- Investment property tab: `cgtCostBase = ipPrice`; `cgtBase = fullPropertyValue` (tracked separately as `ipPrice × (1 + ipGrowthRate)^year` — full property value, not equity-only)

**CGT rules:**
- `cgtRules = 'pre-budget'` (assets acquired before 12 May 2026): `cgtLiability = nominalGain × 0.5 × taxRate`
- `cgtRules = 'post-budget'` (assets acquired after 12 May 2026, default): `cgtLiability = indexedGain × max(0.30, taxRate)` where `indexedCostBase = cgtCostBase × (1 + inflationRate)^year`

**"Without Budget Changes" card:** a parallel `runScenario()` call with `cgtRules: 'pre-budget'` and `negativeGearingRestricted: false` is run on every calculate, producing a reference point showing wealth under old rules. Whether this is higher or lower than current rules depends on real capital growth vs inflation — for low-real-growth assets (growth ≈ inflation), post-budget indexed CGT can be lower than the old 50% discount.

### 2026 Federal Budget Changes

Three changes effective from the 2026 budget, modelled in this tool:

| Change | Effective | Who is affected |
|---|---|---|
| Tax rate cut ($18k–$45k → 15% base) | 1 July 2026 | Everyone |
| Negative gearing restricted to new builds | 1 July 2027 | Established IPs purchased after 12 May 2026 |
| CGT 50% discount → inflation indexation + 30% min | 1 July 2027 | Assets acquired after 12 May 2026 |

**Negative gearing restriction:** when `negativeGearingRestricted=true`, the tax saving from rental losses is capped at rental income — excess losses cannot reduce salary tax. Rental income is still effectively tax-free (deductions shelter it), but no further salary offset. Select "Established property (purchased after 12 May 2026)" in the Property Type dropdown to model this.

### LVR Rules
- Flag warning (amber) if `(loanBalance + releaseAmount) / propertyValue > 0.80`
- Don't block calculation — just surface the risk clearly

### Three Strategy Modes

**Mode 1 — Offset Strategy**
- `recycleAmount` = offset balance
- `releaseAmount` = 0 (no equity released, no LVR check)

**Mode 2 — Equity Release → Stocks/ETFs**
- `recycleAmount = equityRelease − refinancingCosts` (net investable amount)
- `releaseAmount = equityRelease` (gross, for LVR check)
- Refinancing costs input is deducted from the invested amount, not just informational

**Mode 3 — Equity Release → Investment Property**
- `recycleAmount = equityReleaseP − stampDuty`
- `releaseAmount = equityReleaseP` (gross, for LVR check)
- `dividendYield = rentalYield`, `investmentReturn = ipGrowth + rentalYield`
- Stamp duty auto-calculated from state dropdown rate; editable with ↺ reset
- `maintenanceCost` auto-calculated at 1% of IP purchase price; editable with ↺ reset; passed to `runScenario()` as annual $ amount (0 for other tabs)
- `ipPrice` passed to `runScenario()` for full-property CGT calculation
- `propertyType` dropdown drives `negativeGearingRestricted` flag

### Stamp Duty Rates by State

```js
const STAMP_DUTY_RATES = {
  NSW: 0.039, VIC: 0.055, QLD: 0.035, SA: 0.040,
  WA: 0.035, TAS: 0.035, ACT: 0.035, NT: 0.045,
};
```
These are indicative rates. Users can override the calculated amount manually.

## UI Layout

```
[Header: KashVector home logo (top-left) + Debt Recycling icon + title + "2026-27 Federal Budget Ready" badge]
[Strategy Tabs: Offset | Equity → Stocks | Equity → Property]
[Two-column layout: Input Panel left, Results Panel right]

Input Panel sections (in order):
  1. Home Loan — balance, property value, home loan rate, loan term, monthly repayment (auto)
  2. Strategy-specific — offset balance / equity release / IP details (tab-driven)
     Property tab includes: state dropdown, stamp duty (auto + ↺ reset),
     Property Type dropdown (Existing / New build / Established post-12 May 2026),
     IP purchase price, rental yield, capital growth, maintenance cost (auto 1% + ↺ reset)
  3. Investment Loan — investment rate, investment loan term (drives P&I amortisation)
  4. Your Income — annual income (derives marginal rate), optional override
  5. Investment Assumptions — expected return, dividend yield, franking % (0–100%),
     CGT Rules dropdown (Post-budget / Pre-budget; hidden on property tab),
     Assumed Inflation % (default 2.5%; used for post-budget CGT indexation; visible on all tabs),
     projection slider, sensitivity checkbox (±2%);
     hidden for Property tab — uses rental yield + capital growth instead
  [Warnings: LVR, repayment below minimum]
  [Calculate] [Reset]

Results Panel:
  - Summary Cards (5):
      Tax Saving / yr | Total Tax Saved | Wealth Gain | Wealth Gain After CGT | Without Budget Changes
  - "Without Budget Changes" card has amber border/glow (pre-budget-card class)
  - Verdict banner (green/amber/red)
  - Out-of-pocket note (amber, shown only when negatively geared)
  - Chart: Loan Balance Over Time (fixed 240px height) — novice explainer below title
  - Chart: Net Wealth Over Time — ±2% sensitivity dashed lines when checkbox checked — novice explainer below title
  - Note below wealth chart: "Net Wealth shown pre-CGT. See 'Net Wealth After CGT' column."
  - [Download PDF] button
  - Table: Year-by-year breakdown (collapsible) — column guide above when expanded; columns:
    Year | Non-Ded. Loan | Total Loan | Baseline Loan | Investment |
    Inv. Loan Interest | Tax Saving | Net Cash Flow | Net Wealth | Net Wealth After CGT | Baseline Wealth

[Below main panel — full width]
  - tool-info section: "About this tool" + FAQ accordion (10 questions)
    FAQ covers: what is debt recycling, legality, risks, tax saving calc,
    2026 budget overview, new tax brackets, negative gearing restriction,
    how tax saving works even when restricted, CGT changes, why "Without Budget Changes"
    can show lower wealth, why net wealth is negative
```

### Input behaviour
- All dollar fields use `type="text" inputmode="numeric"` with live comma formatting (cursor-aware)
- `parseMoney(el)` strips commas, uses `parseFloat + Math.round`, and rejects exponential notation (e.g. `1e6`) — never use raw `parseFloat()` or `parseInt()` on money inputs
- Monthly repayment: auto-calculated from `monthlyPayment(balance, rate, term)`; "auto" badge + ↺ reset
- Stamp duty (property tab): auto-calculated from `STAMP_DUTY_RATES[state]`; editable with ↺ reset; state dropdown triggers recalc
- Annual maintenance (property tab): auto-calculated at 1% of IP price (`ipPrice × 0.01`); `maintenanceCostManual` flag prevents auto-recalc on IP price change; ↺ reset restores auto; `maintPctDisplay` shows live % of purchase price
- Franking %: `frankingPct` input (0–100); stored in localStorage; wired to `scenarioInputs.frankingPct` as decimal
- CGT Rules: dropdown (`post-budget` / `pre-budget`); hidden on property tab (always post-budget for new purchases); persisted in localStorage
- Inflation Rate: `number` input, default 2.5; divided by 100 before passing to `runScenario()`; visible on all tabs; persisted in localStorage
- Property Type: dropdown (`existing` / `new-build` / `established-new`); drives `negativeGearingRestricted`; persisted in localStorage
- Sensitivity: checkbox state persisted in localStorage; runs two extra `runScenario()` calls at ±2% investmentReturn; dashed lines added to wealth chart via `borderDash: [6, 4]`
- On Calculate: page smooth-scrolls to results panel (`scrollIntoView`)
- Out-of-pocket note: shown in results when `rows[0].netCashFlow < 0`; displays `max(-netCashFlow, 0)` as annual salary cost
- Investment loan rate shows: effective rate after tax + monthly I/O and P&I repayments
- Inputs auto-save to `localStorage` key `'debt_recycling_inputs'`
- Marginal tax rate auto-derived from income, shown to user (overridable); shows `—` when income field is blank
- Projection period: 5–30 years slider, default 20 years

### Chart behaviour
- `maintainAspectRatio: false` + CSS `height: 240px` — chart box never changes size on recalculate
- Y-axis width pinned to 88px via `afterFit` — prevents label width shifts from moving the plot area
- `maxTicksLimit: 6` — keeps Y-axis ticks stable
- Axes auto-scale to data (no fixed bounds)
- Sensitivity datasets use `borderDash: [6, 4]` — pass `dash: [6, 4]` in the dataset object to `renderLineChart()`

## Unit Testing

All pure functions in `utils.js` and `calc/*.js` must have unit tests. The `www/` folder stays npm-free — tests live in a sibling `tests/` folder and run via Node's built-in test runner (Node 18+, zero extra dependencies).

### Running tests

```bash
npm test          # runs node --test tests/*.test.js — 87 tests, all passing
```

### Node testability

Each `calc/*.js` and `utils.js` appends a conditional export:
```js
if (typeof module !== 'undefined') module.exports = { functionName };
```

### Key test scenarios for `runScenario()`

- `recycleAmount=0` → deductible stays 0, tax saving = 0 every year
- `investmentLoanTerm` provided → deductible balance decreases each year (P&I)
- `investmentLoanTerm` provided → total loan balance decreases every year
- `investmentReturn=0, dividendYield=0` → investment value stays flat (no capital growth, no dividends)
- LVR checks at exactly 80%, just over, and well over
- `frankingPct=0` → `netDividends = grossDividends × (1 − taxRate)` (unchanged baseline)
- `frankingPct=1` → `netDividends = grossDividends × (1 + 30/70) × (1 − taxRate)`
- omitting `frankingPct` → same result as `frankingPct=0` (backward compatibility)
- `maintenanceCost=0` (or omitted) → `netCashFlow` unchanged (backward compatibility)
- `maintenanceCost > 0` → `netCashFlow` decreases by `maintenanceCost × (1 − taxRate)`
- `negativeGearingRestricted=true`, negatively geared → `taxSaving` capped at `grossDividends × taxRate`
- `negativeGearingRestricted=true`, positively geared → `taxSaving` unchanged vs unrestricted
- omitting `negativeGearingRestricted` → same as `false` (backward compatibility)
- `cgtRules='pre-budget'` → `cgtLiability = nominalGain × 0.5 × taxRate`
- `cgtRules='post-budget'` with `inflationRate=0` → `cgtLiability = nominalGain × max(0.30, taxRate)`
- `cgtRules='post-budget'` with `inflationRate=0.025` → indexed gain < nominal gain → lower liability
- higher inflation → lower post-budget CGT liability
- `ipPrice > 0` → CGT based on full property value growth, not equity-only `investmentValue`
- omitting `cgtRules` → defaults to `'post-budget'`
- omitting `inflationRate` → defaults to 2.5%

## Running Locally

```bash
npx http-server www -p 8080 -c-1
# Open http://localhost:8080
```

## Deployment

Deployed at `kashvector.com/debt-recycling/` via Cloudflare Pages.

**To redeploy after changes:**
1. Copy `www/` → `C:\Projects\StockAnalysis\www\debt-recycling`
2. Also update `C:\Projects\StockAnalysis\www\index.html` if landing page changes are needed
3. Commit and push `C:\Projects\StockAnalysis` — Cloudflare Pages auto-deploys

**Assets at `C:\Projects\StockAnalysis\www`:**
- `Debt-recycling.png` — tool icon (used in landing page tile and app header)
- `logo.svg` — KashVector logo (referenced as `../logo.svg` from the app)

## Future: Capacitor Mobile

The DOM boundary rule ensures zero changes are needed to wrap this in Capacitor. When ready:
```bash
# In C:\Projects\StockAnalysis\
npx cap sync
npx cap open android
```
