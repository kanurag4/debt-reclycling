# Debt Recycling Calculator — KashVector Tool

A vanilla JS web app that helps Australian homeowners model whether debt recycling is profitable for their situation. Part of the KashVector financial tools suite at kashvector.com.

## What This Tool Does

Debt recycling converts non-deductible home loan debt into tax-deductible investment debt. Users can model three strategies:
1. **Offset Strategy** — use savings in offset account to invest (most common)
2. **Equity Release → Stocks/ETFs** — refinance to access equity, invest in market
3. **Equity Release → Investment Property** — refinance to use equity as deposit on IP

The tool shows: annual tax savings, home loan payoff acceleration (years saved), net wealth comparison with vs. without recycling, and year-by-year projections.

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
│   ├── tax.js          # Australian tax brackets 2024-25, marginalRate()
│   └── recycling.js    # runScenario() — year-by-year projection engine
└── app.js              # ONLY file that touches the DOM
```

**Script load order** in `index.html`:
`utils.js` → `calc/tax.js` → `calc/amortization.js` → `calc/recycling.js` → `app.js`

## Critical Architecture Rule: DOM Boundary

**`app.js`**** is the ONLY file allowed to:**
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

## Reference Implementations in StockAnalysis

These files in `C:\Projects\StockAnalysis\www` are the canonical patterns to follow:

| File | Reuse for |
| --- | --- |
| `stock/style.css` | CSS variable pattern, card/button/input styles |
| `stock/utils.js` | `safe()`, `fmt()` null-safety helpers |
| `stock/app.js` | DOM event wiring pattern |
| `brand.css` | CSS custom property definitions |

## Calculation Logic

### Australian Tax Brackets (2024-25 + Medicare)

| Income | Marginal Rate |
| --- | --- |
| $0–$18,200 | 0% |
| $18,201–$45,000 | 21% (19% + 2% Medicare) |
| $45,001–$120,000 | 34.5% (32.5% + 2% Medicare) |
| $120,001–$180,000 | 39% (37% + 2% Medicare) |
| $180,001+ | 47% (45% + 2% Medicare) |

### Key Debt Recycling Mechanics

- Recyclable amount from offset: user's offset balance
- For property: `recycleAmount = equityReleaseP − stampDuty` (stamp duty deducted from equity)
- Available equity: `(propertyValue × 0.80) - loanBalance` (80% LVR)
- Two separate interest rates: `interestRate` (home loan, non-deductible) and `investmentRate` (investment loan, deductible)
- Tax deduction = `deductibleDebt × investmentRate`
- Annual tax saving = `taxDeduction × marginalTaxRate`
- Net interest cost = `deductibleInterest × (1 − taxRate)` — what user actually pays after refund
- Net dividends = `investmentValue × dividendYield × (1 − taxRate)`
- Net cash flow = `netDividends − netInterestCost` (positive = extra goes on home loan; negative = negatively geared, no extra repayment)
- `extraRepayment = max(netCashFlow, 0)` — only positive cash flow applied to home loan
- Investment value grows at `investmentReturn` annually (capital + reinvested dividends)

### LVR Rules
- Flag warning (amber) if releasing equity results in LVR > 80%
- Don't block calculation — just surface the risk clearly

### Three Strategy Modes

**Mode 1 — Offset Strategy**
1. Pay offset balance as lump sum onto home loan
2. Immediately redraw same amount → invest (now tax-deductible debt)
3. Each year: interest on investment portion → tax deduction → refund
4. Refund + net dividends → extra home loan repayment → reduces non-deductible balance
5. Recycle again from any new offset savings each year

**Mode 2 — Equity Release → Stocks/ETFs**
- Equity to release capped at 80% LVR (warn if exceeded)
- Refinancing costs optional input (default $0)
- Outputs: LVR check, portfolio growth projection

**Mode 3 — Equity Release → Investment Property**
- Additional inputs: purchase price, rental yield %, capital growth %, stamp duty/costs
- Additional outputs: negative gearing benefit, total portfolio value, rental cashflow after tax

## UI Layout

```
[Header: KashVector logo + "Debt Recycling Calculator"]
[Strategy Tabs: Offset | Equity → Stocks | Equity → Property]
[Two-column layout: Input Panel left, Results Panel right]

Input Panel sections (in order):
  1. Home Loan — balance, property value, home loan rate, loan term, monthly repayment (auto)
  2. Strategy-specific — offset balance / equity release / IP details (tab-driven)
  3. Investment Loan — investment rate, investment loan term (separate section, always visible)
  4. Your Income — annual income (derives marginal rate), optional override
  5. Investment Assumptions — expected return, dividend yield, projection slider
     (hidden for Property tab — uses rental yield + capital growth instead)
  [Warnings: LVR, repayment below minimum]
  [Calculate] [Reset]

Results Panel:
  - Summary Cards: Tax saved/yr | Years saved | Wealth gain
  - Verdict banner (green/amber/red)
  - Chart: Loan Balance Over Time (recycling vs baseline)
  - Chart: Net Wealth Over Time
  - [Download PDF] button
  - Table: Year-by-year breakdown (collapsible) — columns:
    Year | Non-Ded. Loan | Total Loan | Baseline Loan | Investment |
    Inv. Loan Interest | Tax Saving | Net Cash Flow | Net Wealth | Baseline Wealth
```

### Input behaviour
- All dollar fields use `type="text" inputmode="numeric"` with live comma formatting (cursor-aware)
- Monthly repayment: auto-calculated from balance × rate × term; "auto" badge + ↺ reset button
- Stamp duty (property tab): auto-calculated at **3.9% of purchase price**; editable with ↺ reset
- `recycleAmount` for property = `equityReleaseP − stampDuty` (stamp duty deducted from equity)
- Net deposit after costs shown as derived field below stamp duty
- Investment loan rate shows: effective rate after tax + monthly I/O and P&I repayments
- Years saved card: extended to 40-year horizon for payoff detection (not limited to projection window)
- Inputs auto-save to `localStorage` key `'debt_recycling_inputs'`
- Marginal tax rate auto-derived from income, shown to user (overridable)
- Projection period: 5–30 years slider, default 20 years

## Unit Testing

All pure functions in `utils.js` and `calc/*.js` must have unit tests. The `www/` folder stays npm-free — tests live in a sibling `tests/` folder and run via Node's built-in test runner (Node 18+, zero extra dependencies).

### Structure

```
tests/
├── tax.test.js          # marginalRate() edge cases and all brackets
├── amortization.test.js # monthlyPayment(), loanSchedule() correctness
├── recycling.test.js    # runScenario() — key scenarios and edge cases
└── utils.test.js        # fmt(), safe(), formatCurrency()
package.json             # { "scripts": { "test": "node --test tests/*.test.js" } }
```

### Making calc files testable

Each `calc/*.js` and `utils.js` must append a conditional export so Node can `require()` them without touching browser globals:

```js
// at the bottom of each calc file:
if (typeof module !== 'undefined') module.exports = { marginalRate };
```

### Running tests

```bash
npm test          # runs node --test tests/
```

### What to test

**`tax.js` — `marginalRate(income)`**
- Happy path: one value mid-range in each bracket (e.g. $10k → 0%, $30k → 21%, $80k → 34.5%, $150k → 39%, $200k → 47%)
- Bracket boundaries (exact): $18,200 → 0%, $18,201 → 21%, $45,000 → 21%, $45,001 → 34.5%, $120,000 → 34.5%, $120,001 → 39%, $180,000 → 39%, $180,001 → 47%
- Edge: $0 income → 0%
- Negative: negative income → 0% (treat as zero, don't throw)
- Negative: `null` / `undefined` / `NaN` input → 0% (safe default, don't throw)

**`amortization.js` — `monthlyPayment(principal, annualRate, years)` and `loanSchedule(...)`**
- Happy path: $500k at 6% over 30 years → payment ≈ $2,998/mo (known value)
- Edge: 0% interest rate → payment = principal / (years × 12), schedule total interest = $0
- Edge: 1-year term → schedule has exactly 12 rows, final balance ≈ $0
- Edge: repayment equals interest only → principal never reduces (balance flat), no infinite loop
- Negative: repayment below interest-only minimum → function returns result without hanging (caller is responsible for warning)
- Negative: `principal = 0` → payment = $0, schedule is all zeros
- Negative: `NaN` / `null` inputs → returns `NaN` or throws a clear error (document the contract)

**`recycling.js` — `runScenario(inputs)`**
- Happy path: $600k loan, $100k offset, $120k income (34.5% rate), 6% interest, 7% return, 4% yield, 20 years → tax saving year 1 ≈ $2,070 (6,000 × 0.345), net wealth recycling > baseline by year 20
- Edge: `recycleAmount = 0` → deductible balance stays 0, tax saving = $0 every year, results identical to baseline
- Edge: `recycleAmount = full loan balance` → non-deductible balance starts at $0, entire loan is deductible from year 1
- Edge: 1-year projection → returns array of length 1 with correct values
- Edge: 30-year projection → returns array of length 30, no compounding errors
- Edge: `dividendYield = 0` → extra repayment equals tax saving only, investment grows purely by capital
- Edge: investment return exactly equals interest rate → recycling barely profitable (tax saving is the only gain)
- Negative: investment return = 0% → portfolio flat, recycling may still save on home loan interest via tax refund
- Negative: tax rate = 0% → tax saving = $0, recycling benefit comes only from dividends applied to loan
- LVR guard: `(propertyValue × 0.80) - loanBalance < releaseAmount` → result includes `lvrWarning: true`
- LVR guard: exactly at 80% LVR → `lvrWarning: false`
- LVR guard: 1 cent over → `lvrWarning: true`

**`utils.js` — `safe()`, `fmt()`, `formatCurrency()`**
- `safe()`: `null` → 0, `undefined` → 0, `NaN` → 0, `Infinity` → 0, `-Infinity` → 0, valid number → passthrough
- `fmt()`: formats $1,234,567 correctly; `null`/`NaN`/`undefined` → `'N/A'`; $0 → `'$0'`; negative values → `'-$1,000'`
- `formatCurrency()`: same boundary cases as `fmt()`; confirm no decimal places for values ≥ $1

## Running Locally

```bash
npx http-server www -p 8080 -c-1
# Open http://localhost:8080
```

## Deployment

Copy `www/` into `C:\Projects\StockAnalysis\www\debt-recycling\` — auto-deploys to `kashvector.com/debt-recycling/` via Cloudflare Pages (git-connected). No code changes needed.

## Future: Capacitor Mobile

The DOM boundary rule ensures zero changes are needed to wrap this in Capacitor. When ready:
```bash
# In C:\Projects\StockAnalysis\
npx cap sync
npx cap open android
```

## Full Implementation Plan

See `nimbalyst-local/plans/i-want-to-create-sharded-eich.md` for the complete plan including the core calculation engine pseudocode, verification steps, and all UX details.
