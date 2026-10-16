const path = require('path');
const { Liquid } = require('liquidjs');
const fs = require('fs');

async function testAddonVerification() {
  console.log('=============================================');
  console.log('🧪 TESTING ADD-ON FUNCTIONALITY & THEME SYNC');
  console.log('=============================================\n');

  const engine = new Liquid({
    root: path.resolve(__dirname, '../views'),
    extname: '.liquid'
  });

  const menuService = require('../services/menu');
  const addons = await menuService.getAddons();
  const meals = await menuService.getWeeklyMenu();

  // Test Case 1: Template renders with fallbacks and Step 3 Featured Add-ons
  const rendered = await engine.renderFile('choose-meals', {
    customerName: 'Hannah Conway',
    customerEmail: 'hannahconway@hotmail.co.uk',
    mealQuota: 6,
    meals: meals,
    addons: addons,
    activeContractId: '12345',
    formattedDeliveryDate: 'Mon 19 Oct',
    cutoffPassed: false,
    cutoffTimestamp: Date.now() + 86400000
  });

  const checks = [
    { name: 'Step 3 FEATURED ADD-ONS panel exists', pass: rendered.includes('FEATURED ADD-ONS') },
    { name: 'Toggle switch input exists with id gimmie-addon-toggle', pass: rendered.includes('id="gimmie-addon-toggle"') },
    { name: 'Switch slider styled element exists', pass: rendered.includes('class="gimmie-switch__slider"') },
    { name: 'Add-ons collapsible container exists', pass: rendered.includes('id="gimmie-addons-container"') },
    { name: 'Add-on counter badge exists', pass: rendered.includes('id="gimmie-addon-selected-count"') },
    { name: 'Add-on cards rendered in grid', pass: rendered.includes('gimmie-build-box__addon-item') },
    { name: 'Price tag rendered with +£', pass: rendered.includes('gimmie-addon-price-tag') },
    { name: 'Info modal button ℹ rendered for add-ons', pass: rendered.includes('title="View Nutrition & Ingredients"') },
    { name: 'Summary section for add-ons exists in sidebar', pass: rendered.includes('id="gimmie-summary-addons-section"') },
    { name: 'Summary addons total element exists', pass: rendered.includes('id="gimmie-summary-addons-total"') },
    { name: 'Selected addons list container exists in sidebar', pass: rendered.includes('id="gimmie-selected-addons-list"') },
    { name: 'Overnight Oats present in template', pass: rendered.includes('PEANUT BUTTER OVERNIGHT OATS') },
    { name: 'Immunity Shot present in template', pass: rendered.includes('IMMUNITY SHOT') },
    { name: 'High-Protein Flapjack present in template', pass: rendered.includes('PROTEIN FLAPJACK') },
    { name: 'Cold-Pressed Juice present in template', pass: rendered.includes('COLD-PRESSED GREEN ZING JUICE') },
    { name: 'Dynamic active_meta_addons lookup includes all aliases', pass: rendered.includes('featured_add_ons') && rendered.includes('step_3_products') },
    { name: 'Dynamic next_week_menu.fields inspection present', pass: rendered.includes('next_week_menu.fields') },
    { name: 'Shopify pence conversion to decimal pounds logic present', pass: rendered.includes('divided_by: 100.0') },
    { name: 'JS price safety for raw pence present', pass: rendered.includes('cleanPrice >= 100') }
  ];

  let allPassed = true;
  checks.forEach((c, i) => {
    console.log(`[Check ${i + 1}] ${c.name}: ${c.pass ? '✓ PASS' : '✗ FAIL'}`);
    if (!c.pass) allPassed = false;
  });

  console.log(`\n=============================================`);
  console.log(`Overall Result: ${allPassed ? '✓ 100% PASS' : '✗ FAILED'}`);
  console.log(`=============================================\n`);

  if (!allPassed) process.exit(1);
}

testAddonVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
