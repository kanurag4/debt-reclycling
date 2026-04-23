const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monthlyPayment, loanSchedule } = require('../www/calc/amortization.js');

const near = (actual, expected, tol = 1) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `Expected ~${expected}, got ${actual}`);

// monthlyPayment
test('$500k at 6% over 30yr ≈ $2,998/mo', () =>
  near(monthlyPayment(500000, 0.06, 30), 2997.75, 1));

test('zero interest rate → principal / months', () =>
  near(monthlyPayment(120000, 0, 10), 1000, 0.01));

test('principal = 0 → payment = 0', () =>
  assert.equal(monthlyPayment(0, 0.06, 30), 0));

// loanSchedule
test('schedule length = years × 12 (or less if early payoff)', () => {
  const rows = loanSchedule(300000, 0.06, 25);
  assert.ok(rows.length <= 300);
  assert.ok(rows.length > 0);
});

test('1-year schedule has 12 rows and ends near zero', () => {
  const rows = loanSchedule(12000, 0, 1);
  assert.equal(rows.length, 12);
  near(rows[11].balance, 0, 1);
});

test('zero interest: total interest paid = 0', () => {
  const rows = loanSchedule(60000, 0, 5);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  near(totalInterest, 0, 0.01);
});

test('standard schedule: final balance near zero', () => {
  const rows = loanSchedule(500000, 0.06, 30);
  near(rows[rows.length - 1].balance, 0, 2);
});

test('standard schedule: total interest > 0', () => {
  const rows = loanSchedule(500000, 0.06, 30);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  assert.ok(totalInterest > 100000);
});

// Edge: repayment equals interest only → balance never grows (our impl uses max(0))
test('principal=0 → schedule is empty or all-zero', () => {
  const rows = loanSchedule(0, 0.06, 30);
  assert.equal(rows.length, 0);
});
