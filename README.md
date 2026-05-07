# Debt Recycling Calculator

**Live tool:** [kashvector.com/debt-recycling](https://kashvector.com/debt-recycling/)

Model whether converting your non-deductible home loan into tax-deductible investment debt is right for you. Free, browser-only — no sign-up, no data sent anywhere.

## What it does

Debt recycling is an Australian strategy where you pay down your home loan, then immediately redraw the same amount to invest. The redrawn portion becomes tax-deductible investment debt, which reduces your taxable income each year.

This calculator helps you decide whether the math works for your situation by showing:

- **Annual tax saving** — how much you reclaim from the ATO each year based on your marginal rate
- **Net wealth comparison** — recycling vs. doing nothing, projected over 5–30 years
- **Out-of-pocket cost** — how much salary you need to contribute if the strategy is negatively geared
- **Loan payoff trajectory** — how quickly your non-deductible debt shrinks
- **Year-by-year table** — full breakdown of every number, with a plain-English column guide
- **Sensitivity bands** — optional ±2% wealth chart to show how return assumptions affect the outcome

## Three strategies

| Tab | What it models |
|---|---|
| **Offset Strategy** | Redraw your offset account savings to invest (most common approach) |
| **Equity → Stocks/ETFs** | Refinance to release equity, invest in a diversified portfolio |
| **Equity → Investment Property** | Use released equity as a deposit on an investment property |

## Key inputs

- Home loan balance, interest rate, and term
- Amount to recycle (offset balance or equity released)
- Your annual income (derives your marginal tax rate automatically)
- Investment return and dividend yield assumptions
- Franking percentage (e.g. VAS ETF is ~70–100% franked — boosts after-tax dividends)
- State selector for stamp duty estimate (property tab)
- Annual maintenance cost estimate (property tab) — auto-set to 1% of purchase price, editable
- ±2% sensitivity bands on the wealth chart (checkbox)

## Australian tax brackets (2024–25)

| Income | Marginal Rate (inc. Medicare) |
|---|---|
| $0 – $18,200 | 0% |
| $18,201 – $45,000 | 21% |
| $45,001 – $120,000 | 34.5% |
| $120,001 – $180,000 | 39% |
| $180,001+ | 47% |

## Running locally

```bash
npx http-server www -p 8080 -c-1
# Open http://localhost:8080
```

No build step, no npm install required for the app itself.

## Running tests

```bash
npm test
```

Uses Node's built-in test runner (Node 18+). 71 tests covering all pure calculation functions.

## Project structure

```
www/
├── index.html          # Single-page UI
├── style.css           # KashVector dark theme
├── utils.js            # Pure helpers: fmt(), safe(), formatCurrency()
├── calc/
│   ├── amortization.js # loanSchedule(), monthlyPayment()
│   ├── tax.js          # Australian tax brackets, marginalRate()
│   └── recycling.js    # runScenario() — year-by-year projection engine
└── app.js              # Only file that touches the DOM
tests/
├── tax.test.js
├── amortization.test.js
├── recycling.test.js
└── utils.test.js
```

## Tech stack

Vanilla HTML/CSS/JS — no frameworks, no bundler. Chart.js via CDN for charts. All calculations run client-side in your browser.

## Disclaimer

For educational purposes only. Not financial advice. Debt recycling involves investment and interest rate risk. Speak to a licensed financial adviser before implementing any strategy.
