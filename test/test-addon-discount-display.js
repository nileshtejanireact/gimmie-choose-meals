const path = require('path');
const fs = require('fs');
const { Liquid } = require('liquidjs');
const assert = require('assert');

async function runTest() {
  console.log('=============================================');
  console.log('🧪 TESTING ADDON DISCOUNT BADGE & PRICE DISPLAY');
  console.log('=============================================\n');

  const engine = new Liquid({
    root: path.resolve(__dirname, '../views'),
    extname: '.liquid'
  });

  const menuService = require('../services/menu');
  const addons = await menuService.getAddons();
  const meals = await menuService.getWeeklyMenu();

  // Test 1: Render template with default subscriber discount (no query string)
  const rendered = await engine.renderFile('choose-meals', {
    customerName: 'Subscriber Test',
    mealQuota: 6,
    meals,
    addons,
    formattedDeliveryDate: 'Tue 1 Sept',
    isDuplicateTheme: true,
    discount: { title: 'GIMMIEAGO', code: 'GIMMIEAGO', percent: 15, valid: true }
  });

  // Verify discount badge in rendered HTML
  const hasBadge = rendered.includes('class="price-item--discount-badge font-heading uppercase"');
  console.log(`[Check 1] Discount badge span rendered in HTML: ${hasBadge ? '✓ PASS' : '✗ FAIL'}`);
  assert(hasBadge, 'Discount badge span must be rendered in HTML');

  // Verify badge is NOT style="display: none;"
  const hasHiddenBadge = rendered.includes('class="price-item--discount-badge font-heading uppercase" style="display: none;"');
  console.log(`[Check 2] Discount badge is NOT hidden with display: none: ${!hasHiddenBadge ? '✓ PASS' : '✗ FAIL'}`);
  assert(!hasHiddenBadge, 'Discount badge must NOT have style="display: none;" in HTML');

  // Verify badge shows 15% OFF
  const has15Off = rendered.includes('15% OFF');
  console.log(`[Check 3] Discount badge displays "15% OFF": ${has15Off ? '✓ PASS' : '✗ FAIL'}`);
  assert(has15Off, 'Badge must display 15% OFF');

  // Verify strikethrough compare price exists
  const hasComparePrice = rendered.includes('price-item--compare font-heading uppercase');
  console.log(`[Check 4] Strikethrough compare price span exists: ${hasComparePrice ? '✓ PASS' : '✗ FAIL'}`);
  assert(hasComparePrice, 'Compare price span must exist');

  // Test 2: Check Client JS functions in template
  const liquidSource = fs.readFileSync(path.resolve(__dirname, '../views/choose-meals.liquid'), 'utf8');

  // Verify applyAddonDiscounts fallback to 15%
  const hasJsFallback = liquidSource.includes("activeDiscount = { valid: true, code: 'GIMMIEAGO', percent: 15 }");
  console.log(`[Check 5] Client JS applyAddonDiscounts has 15% subscriber fallback: ${hasJsFallback ? '✓ PASS' : '✗ FAIL'}`);
  assert(hasJsFallback, 'Client JS must default to 15% discount for subscribers');

  // Verify initDiscountUI auto-evaluates GIMMIEAGO
  const hasInitFallback = liquidSource.includes("evaluateDiscountCode('GIMMIEAGO')");
  console.log(`[Check 6] Client JS initDiscountUI auto-evaluates GIMMIEAGO: ${hasInitFallback ? '✓ PASS' : '✗ FAIL'}`);
  assert(hasInitFallback, 'initDiscountUI must auto-evaluate GIMMIEAGO');

  // Verify server.js default subscriber discount
  const serverSource = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');
  const hasServerDefault = serverSource.includes("const subscriberDiscount = subscription.discount || {");
  console.log(`[Check 7] server.js passes subscriberDiscount by default: ${hasServerDefault ? '✓ PASS' : '✗ FAIL'}`);
  assert(hasServerDefault, 'server.js must pass subscriberDiscount');

  // Verify subscription.js default subscriber discount
  const subSource = fs.readFileSync(path.resolve(__dirname, '../services/subscription.js'), 'utf8');
  const hasSubDefault = subSource.includes("title: 'GIMMIEAGO'") && subSource.includes("percent: 15");
  console.log(`[Check 8] subscription.js auto-detects 15% GIMMIEAGO for subscribers: ${hasSubDefault ? '✓ PASS' : '✗ FAIL'}`);
  assert(hasSubDefault, 'subscription.js must default to 15% GIMMIEAGO');

  console.log('\n=============================================');
  console.log('🎉 ALL 8 ADDON DISCOUNT DISPLAY CHECKS PASSED 100%');
  console.log('=============================================\n');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
