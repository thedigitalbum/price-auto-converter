const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.SOURCE_DIR || path.join(__dirname, '..');
const PC = vm.runInNewContext(fs.readFileSync(path.join(root, 'lib.js'), 'utf8') + '\nPC', { Intl, TextEncoder });
const rates = { USD: 1, PHP: 56, EUR: 0.9, KWD: 0.3, BHD: 0.4, INR: 80, MYR: 4.5, TRY: 40, KES: 130, PLN: 4, CAD: 1.4, JPY: 150, ZAR: 18 };
const ctx = { rates, target: 'PHP', bare: 'USD', sym: { dollar: 'USD', yen: 'JPY', rand: 'ZAR' } };
for (const [input, currency, amount] of [
  ['USD 1 299.00', 'USD', 1299], ['USD 1,23,456.78', 'USD', 123456.78],
  ['₹1,23,456', 'INR', 123456], ['KWD 1.234', 'KWD', 1.234],
  ['BHD 12.345', 'BHD', 12.345], ['USD 1,234', 'USD', 1234],
  ['$0.9989', 'USD', 0.9989], ['$0.00001234', 'USD', 0.00001234],
  ['29€99', 'EUR', 29.99], ['349,99 TL', 'TRY', 349.99],
  ['KSh 1,299', 'KES', 1299], ['1 299,99 zł', 'PLN', 1299.99],
  ['€1.299,50', 'EUR', 1299.5], ['$5 CAD', 'CAD', 5], ['R 1 299.00', 'ZAR', 1299]
]) test(input, () => {
  const hits = PC.find(input, ctx);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].from, currency);
  assert.equal(hits[0].amount, amount);
  assert.equal(hits[0].end, input.length, 'must consume the entire amount');
});
test('Model identifiers are not negative money', () => assert.equal(PC.find('Romeo RM-9595', ctx).length, 0));
test('Spaced negative money still works', () => assert.equal(PC.find('RM -25.00', ctx)[0].neg, '-'));
test('Malformed prices are left intact', () => assert.equal(PC.find('USD 12.34.56', ctx).length, 0));
test('Alphabetic split currency labels are recognized', () => {
  for (const label of ['RM', 'TL', 'KSh', 'Rp']) assert.equal(PC.hasCurrency(label, ctx), true, label);
});
test('Target prices remain unchanged', () => assert.equal(PC.find('PHP 100.00', ctx).length, 0));
test('Small converted prices do not round to zero', () => assert.notEqual(PC.formatMoney(0.0007, 'PHP', { locale: 'en-US' }), '₱0.00'));
test('Ranges with repeated symbols still find both prices', () => assert.equal(PC.find('$10 - $20', ctx).length, 2));
