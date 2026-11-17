const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { Liquid } = require('liquidjs');
const menuService = require('../services/menu');

async function runNutritionTest() {
  console.log('--- TESTING FIBRE, PROTEIN, AND SALT EXTRACTION & MODAL DISPLAY ---');

  const engine = new Liquid({
    root: path.resolve(__dirname, '../views'),
    extname: '.liquid'
  });

  const addons = await menuService.getAddons();
  const meals = await menuService.getWeeklyMenu();

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

  // 1. Verify Biscoff Oats DOM card attributes match store reality exactly
  assert(rendered.includes('data-fibre="8.8g"'), 'Biscoff data-fibre must be 8.8g');
  assert(rendered.includes('data-salt="0.76g"'), 'Biscoff data-salt must be 0.76g');
  assert(rendered.includes('data-prot="39.0g"') || rendered.includes('data-prot="39g"'), 'Biscoff data-prot must be 39.0g or 39g');
  console.log('✓ Biscoff Oats: fibre (8.8g), protein (39.0g), salt (0.76g) verified in DOM card');

  // 1b. Verify Raspberry Oats DOM card attributes match Shopify Admin Metaobject reality exactly
  assert(rendered.includes('data-fibre="11.1g"'), 'Raspberry Oats data-fibre must be 11.1g');
  assert(rendered.includes('data-salt="0.63g"'), 'Raspberry Oats data-salt must be 0.63g');
  assert(rendered.includes('data-prot="40.0g"') || rendered.includes('data-prot="40g"'), 'Raspberry Oats data-prot must be 40.0g or 40g');
  console.log('✓ Raspberry Oats: fibre (11.1g), protein (40.0g), salt (0.63g) verified in DOM card');

  // 1c. Verify Blueberry Oats DOM card attributes match Shopify Admin Metaobject reality exactly
  assert(rendered.includes('data-fibre="9.9g"'), 'Blueberry Oats data-fibre must be 9.9g');
  assert(rendered.includes('data-salt="0.62g"'), 'Blueberry Oats data-salt must be 0.62g');
  assert(rendered.includes('data-prot="39.0g"') || rendered.includes('data-prot="39g"'), 'Blueberry Oats data-prot must be 39.0g or 39g');
  console.log('✓ Blueberry Oats: fibre (9.9g), protein (39.0g), salt (0.62g) verified in DOM card');

  // 2. Verify no corrupted blank attributes exist like data-fibre="g" or data-salt="g" or data-prot="g Protein"
  assert(!rendered.includes('data-fibre="g"'), 'Must never render data-fibre="g"');
  assert(!rendered.includes('data-salt="g"'), 'Must never render data-salt="g"');
  assert(!rendered.includes('data-prot="g Protein"'), 'Must never render data-prot="g Protein"');
  console.log('✓ No corrupted blank units (data-fibre="g", data-salt="g", data-prot="g Protein") exist');

  // 3. Verify Creamy White Wine Chicken fallback definition in Liquid and JS
  const liquidPath = path.join(__dirname, '..', 'views', 'choose-meals.liquid');
  const liquid = fs.readFileSync(liquidPath, 'utf8');

  assert(liquid.includes("down_t contains 'white wine'"), 'Liquid must handle white wine title match');
  assert(liquid.includes("shop.metaobjects.meal['creamy-white-wine-chicken']"), 'Liquid must resolve creamy-white-wine-chicken metaobject handle');
  assert(liquid.includes("titleLower.includes('white wine')"), 'Client JS openModal must handle white wine fallback');
  assert(liquid.includes("fibre: '5.0g'"), 'White wine fibre must be 5.0g');
  assert(liquid.includes("salt: '1.20g'"), 'White wine salt must be 1.20g');
  console.log('✓ Creamy White Wine Chicken: Liquid handle, fallback cascade, and JS fallback verified');

  // 4. Verify JS openModal cardVal sanitization logic
  assert(liquid.includes("v.trim().toLowerCase() === 'g'"), 'cardVal must reject bare "g"');
  assert(liquid.includes("v.trim().toLowerCase() === 'g protein'"), 'cardVal must reject bare "g protein"');
  console.log('✓ JS cardVal sanitization verified');

  // 5. Verify direct metaobject drop fields iterator handles fibre, fiber, protein, salt
  assert(liquid.includes("field.key == 'fibre' or field.key == 'fiber'"), 'Fields iterator must match fibre and fiber');
  assert(liquid.includes("field.key == 'salt' or field.key == 'sodium'"), 'Fields iterator must match salt and sodium');
  assert(liquid.includes("field.key == 'protein' or field.key == 'proteins'"), 'Fields iterator must match protein and proteins');
  assert(liquid.includes("direct_meal.fields"), 'Must check direct_meal.fields');
  assert(liquid.includes("m_prod.metafields.custom.protein"), 'Must inspect product custom metafields for protein');
  assert(liquid.includes("m_prod.metafields.custom.fibre"), 'Must inspect product custom metafields for fibre');
  assert(liquid.includes("m_prod.metafields.custom.salt"), 'Must inspect product custom metafields for salt');
  console.log('✓ Metafield and metaobject fields extraction logic for protein, fibre, and salt verified');

  console.log('\n🎉 ALL NUTRITION FIBRE, PROTEIN, AND SALT TESTS PASSED PERFECTLY!');
}

runNutritionTest().catch(err => {
  console.error(err);
  process.exit(1);
});
