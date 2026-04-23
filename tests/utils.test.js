const { test } = require('node:test');
const assert = require('node:assert/strict');
const { safe, fmt, formatCurrency } = require('../www/utils.js');

// safe()
test('safe: valid number passthrough', () => assert.equal(safe(42), 42));
test('safe: null → 0', () => assert.equal(safe(null), 0));
test('safe: undefined → 0', () => assert.equal(safe(undefined), 0));
test('safe: NaN → 0', () => assert.equal(safe(NaN), 0));
test('safe: Infinity → 0', () => assert.equal(safe(Infinity), 0));
test('safe: -Infinity → 0', () => assert.equal(safe(-Infinity), 0));
test('safe: 0 → 0', () => assert.equal(safe(0), 0));
test('safe: string number → numeric', () => assert.equal(safe('5'), 5));

// fmt()
test('fmt: formats positive integer', () => assert.equal(fmt(1000), '$1,000'));
test('fmt: formats zero', () => assert.equal(fmt(0), '$0'));
test('fmt: formats negative', () => assert.equal(fmt(-1000), '-$1,000'));
test('fmt: null → N/A', () => assert.equal(fmt(null), 'N/A'));
test('fmt: undefined → N/A', () => assert.equal(fmt(undefined), 'N/A'));
test('fmt: NaN → N/A', () => assert.equal(fmt(NaN), 'N/A'));
test('fmt: Infinity → N/A', () => assert.equal(fmt(Infinity), 'N/A'));
test('fmt: large value', () => assert.equal(fmt(1234567), '$1,234,567'));

// formatCurrency()
test('formatCurrency: delegates to fmt with 0 decimals', () => assert.equal(formatCurrency(5000), '$5,000'));
test('formatCurrency: null → N/A', () => assert.equal(formatCurrency(null), 'N/A'));
test('formatCurrency: negative', () => assert.equal(formatCurrency(-500), '-$500'));
