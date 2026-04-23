const { test } = require('node:test');
const assert = require('node:assert/strict');
const { marginalRate } = require('../www/calc/tax.js');

// Happy path — mid-bracket values
test('$10k → 0%',   () => assert.equal(marginalRate(10000),  0));
test('$30k → 21%',  () => assert.equal(marginalRate(30000),  0.21));
test('$80k → 34.5%',() => assert.equal(marginalRate(80000),  0.345));
test('$150k → 39%', () => assert.equal(marginalRate(150000), 0.39));
test('$200k → 47%', () => assert.equal(marginalRate(200000), 0.47));

// Exact bracket boundaries
test('$18,200 → 0%',    () => assert.equal(marginalRate(18200),  0));
test('$18,201 → 21%',   () => assert.equal(marginalRate(18201),  0.21));
test('$45,000 → 21%',   () => assert.equal(marginalRate(45000),  0.21));
test('$45,001 → 34.5%', () => assert.equal(marginalRate(45001),  0.345));
test('$120,000 → 34.5%',() => assert.equal(marginalRate(120000), 0.345));
test('$120,001 → 39%',  () => assert.equal(marginalRate(120001), 0.39));
test('$180,000 → 39%',  () => assert.equal(marginalRate(180000), 0.39));
test('$180,001 → 47%',  () => assert.equal(marginalRate(180001), 0.47));

// Edge cases
test('$0 → 0%', () => assert.equal(marginalRate(0), 0));

// Negative / bad input
test('negative income → 0%',    () => assert.equal(marginalRate(-1000), 0));
test('null → 0%',               () => assert.equal(marginalRate(null), 0));
test('undefined → 0%',          () => assert.equal(marginalRate(undefined), 0));
test('NaN → 0%',                () => assert.equal(marginalRate(NaN), 0));
