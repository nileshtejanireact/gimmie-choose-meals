const path = require('path');
const { Liquid } = require('liquidjs');
const fs = require('fs');

async function testAddonVerification() {
  console.log('=============================================');
  console.log('🧪 TESTING ADD-ON REDESIGN (CLIENT PDF SPECS)');
  console.log('=============================================\n');

  const engine = new Liquid({
    root: path.resolve(__dirname, '../views'),
    extname: '.liquid'
  });

  const menuService = require('../services/menu');
  const addons = await menuService.getAddons();
  const meals = await menuService.getWeeklyMenu();

  // Test Case: Template renders with fallbacks and Step 3 Featured Add-ons
  const rendered = await engine.renderFile('choose-meals', {
    customerName: 'Hannah Conway',
    customerEmail: 'hannahconway@hotmail.co.uk',
    mealQuota: 6,
    meals: meals,
    addons: addons,
    activeContractId: '12345',
    formattedDeliveryDate: 'Mon 19 Oct',
    cutoffPassed: false,
    cutoffTimestamp: Date.now() + 86400000,
    isDuplicateTheme: true
  });

  const checks = [
    { name: 'Step 3 FEATURED ADD-ONS panel exists', pass: rendered.includes('FEATURED ADD-ONS') },
    { name: 'Toggle switch removed completely (Extras always open)', pass: !rendered.includes('id="gimmie-addon-toggle"') },
    { name: 'Add-ons container has always-open class', pass: rendered.includes('gimmie-addons-container--always-open') },
    { name: 'Header badge exists (YOU\'VE SELECTED X ADD ON MEALS)', pass: rendered.includes('id="gimmie-addon-header-badge"') },
    { name: 'Add-on counter element exists', pass: rendered.includes('id="gimmie-addon-selected-count"') },
    { name: 'Desktop carousel track exists', pass: (rendered.includes('data-gimmie-addonmeals-track') || rendered.includes('id="s4t1"') || rendered.includes('id="gimmie-addon-track"')) },
    { name: 'Desktop carousel prev arrow button exists', pass: rendered.includes('id="gimmie-addon-prev"') },
    { name: 'Desktop carousel next arrow button exists', pass: rendered.includes('id="gimmie-addon-next"') },
    { name: 'Add-on cards rendered in track', pass: rendered.includes('gimmie-build-box__addon-item') },
    { name: 'Real Gimmie add-on Cajun Chicken Penne present', pass: rendered.includes('CAJUN CHICKEN PENNE') },
    { name: 'Real Gimmie add-on Korean Beef Noodles present', pass: rendered.includes('KOREAN BEEF NOODLES') },
    { name: 'Price tag rendered cleanly with £', pass: rendered.includes('gimmie-addon-card-price') },
    { name: 'Info modal button ℹ rendered for nutrition pop-out', pass: rendered.includes('gimmie-addon-info-btn') },
    { name: 'Summary section for add-ons exists in sidebar', pass: rendered.includes('id="gimmie-summary-addons-section"') },
    { name: 'Summary addons total element exists', pass: rendered.includes('id="gimmie-summary-addons-total"') },
    { name: 'Selected addons list container exists in sidebar', pass: rendered.includes('id="gimmie-selected-addons-list"') },
    { name: 'Dynamic active_meta_addons lookup includes add_on_products & addon_meals', pass: rendered.includes("add_on_products") && rendered.includes("addon_meals") },
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
