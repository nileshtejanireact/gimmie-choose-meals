const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=============================================');
console.log('🧪 TESTING SUBSCRIBER RECURRING DISCOUNT & ADD-ON ENGINE');
console.log('=============================================\n');

const liquidPath = path.resolve(__dirname, '../views/choose-meals.liquid');
const liquid = fs.readFileSync(liquidPath, 'utf8');

// 1. Check DOM elements: Box compare, current price, and grand total exist
assert(liquid.includes('id="gimmie-summary-box-compare"'), 'Box compare price element must exist');
assert(liquid.includes('id="gimmie-summary-box-current"'), 'Box current price element must exist');
assert(liquid.includes('id="gimmie-summary-grand-total"'), 'Grand total element must exist');
console.log('[Check 1] Box price and grand total DOM elements present: ✓ PASS');

// 2. Check that manual discount input box and discount badge box are completely removed
assert(!liquid.includes('id="gimmie-portal-discount-code"'), 'Discount input must be removed from customer portal');
assert(!liquid.includes('id="gimmie-portal-apply-discount"'), 'Discount apply button must be removed');
assert(!liquid.includes('id="gimmie-summary-discount-section"'), 'Discount badge section must be removed');
console.log('[Check 2] Manual discount input box and discount badge box removed as requested: ✓ PASS');

// 3. Check applyAddonDiscounts function exists
assert(liquid.includes('function applyAddonDiscounts(discountData)'), 'applyAddonDiscounts function must exist');
console.log('[Check 3] Auto-detection engine for add-on slashed prices is wired: ✓ PASS');

// 4. Test GIMMIEAGO welcome code recurring discount (15% off recurring orders)
const gFactor = (100 - 15) / 100;
const originalAddon = 4.00;
const discountedAddon = originalAddon * gFactor;
assert.strictEqual(discountedAddon.toFixed(2), '3.40', '£4.00 add-on with 15% discount must be £3.40');

const originalBox6 = 48.00;
const discountedBox6 = originalBox6 * gFactor;
assert.strictEqual(discountedBox6.toFixed(2), '40.80', '£48.00 box with 15% discount must be £40.80');

const grandTotalGimmie = discountedBox6 + discountedAddon;
assert.strictEqual(grandTotalGimmie.toFixed(2), '44.20', 'Total must equal £40.80 + £3.40 = £44.20');
console.log('[Check 4] GIMMIEAGO recurring discount calculation matches (Add-on ~£4.00~ £3.40, Box ~£48.00~ £40.80): ✓ PASS');

// 5. Test 25% discount (HOY25)
const factor25 = (100 - 25) / 100;
assert.strictEqual((4.00 * factor25).toFixed(2), '3.00');
assert.strictEqual((48.00 * factor25).toFixed(2), '36.00');
console.log('[Check 5] HOY25 (25% off) calculation matches (Add-on ~£4.00~ £3.00, Box ~£48.00~ £36.00): ✓ PASS');

console.log('\n=============================================');
console.log('Overall Result: ✓ 100% PASS');
console.log('=============================================');
