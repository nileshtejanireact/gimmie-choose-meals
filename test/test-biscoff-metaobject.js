const assert = require('assert');
const path = require('path');
const { Liquid } = require('liquidjs');
const menuService = require('../services/menu');

async function testBiscoffMetaobject() {
  console.log('--- TESTING EXACT BISCOFF METAOBJECT ALIGNMENT ---');

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

  // Verify Biscoff Oats DOM card attributes
  assert(rendered.includes('BISCOFF BISCUIT PROTEIN OATS'), 'Must render Biscoff Biscuit Protein Oats');
  assert(rendered.includes('data-cals="493 kcal"'), 'Biscoff data-cals must be 493 kcal');
  assert(rendered.includes('data-kj="2062 kJ"'), 'Biscoff data-kj must be 2062 kJ');
  assert(rendered.includes('data-fat="15.3g"'), 'Biscoff data-fat must be 15.3g');
  assert(rendered.includes('data-saturates="4.2g"'), 'Biscoff data-saturates must be 4.2g');
  assert(rendered.includes('data-carbs="46.4g"'), 'Biscoff data-carbs must be 46.4g');
  assert(rendered.includes('data-sugars="20.7g"'), 'Biscoff data-sugars must be 20.7g');
  assert(rendered.includes('data-fibre="8.8g"'), 'Biscoff data-fibre must be 8.8g');
  assert(rendered.includes('data-salt="0.76g"'), 'Biscoff data-salt must be 0.76g');
  assert(rendered.includes('data-prot="39.0g"') || rendered.includes('data-prot="39g"'), 'Biscoff data-prot must be 39.0g or 39g');
  assert(rendered.includes('data-allergens="Oats, Milk, Soya, Wheat"'), 'Biscoff data-allergens must include Wheat');
  assert(rendered.includes('Lotus Biscoff Biscuit &amp; Spread') || rendered.includes('Lotus Biscoff Biscuit & Spread'), 'Biscoff ingredients must include Lotus Biscoff');
  console.log('✓ Biscoff Oats Card DOM attributes match Shopify Admin Metaobject 100%');

  // Verify Blueberry Oats DOM card attributes
  assert(rendered.includes('BLUEBERRY & LEMON PROTEIN OATS'), 'Must render Blueberry & Lemon Protein Oats');
  assert(rendered.includes('data-cals="426 kcal"'), 'Blueberry data-cals must be 426 kcal');
  assert(rendered.includes('data-kj="1782 kJ"'), 'Blueberry data-kj must be 1782 kJ');
  assert(rendered.includes('data-fat="10.6g"'), 'Blueberry data-fat must be 10.6g');
  assert(rendered.includes('data-saturates="2.8g"'), 'Blueberry data-saturates must be 2.8g');
  assert(rendered.includes('data-carbs="40.7g"'), 'Blueberry data-carbs must be 40.7g');
  assert(rendered.includes('data-sugars="20.7g"'), 'Blueberry data-sugars must be 20.7g');
  assert(rendered.includes('data-fibre="9.9g"'), 'Blueberry data-fibre must be 9.9g');
  assert(rendered.includes('data-prot="39.0g"') || rendered.includes('data-prot="39g"'), 'Blueberry data-prot must be 39.0g or 39g');
  assert(rendered.includes('data-salt="0.62g"'), 'Blueberry data-salt must be 0.62g');
  console.log('✓ Blueberry Oats Card DOM attributes match store reality 100%');

  // Verify JS openModal extraction logic
  const fs = require('fs');
  const liquidPath = path.join(__dirname, '..', 'views', 'choose-meals.liquid');
  const liquid = fs.readFileSync(liquidPath, 'utf8');

  // Ensure Blueberry values are NEVER hardcoded as global fallback for all dishes
  assert(!liquid.includes("cleanFat = formatVal(n.fat, '10.6g'"), 'Blueberry fat 10.6g must NOT be global fallback');
  assert(!liquid.includes("cleanSat = formatVal(n.saturates, '2.8g'"), 'Blueberry sat 2.8g must NOT be global fallback');
  assert(!liquid.includes("cleanCarbs = formatVal(n.carbs, '40.7g'"), 'Blueberry carbs 40.7g must NOT be global fallback');
  console.log('✓ No hardcoded Blueberry Oats constants used as global fallbacks in openModal');

  // Verify Biscoff fallback entry in client JS
  assert(liquid.includes("titleLower.includes('biscoff')"), 'Client JS must handle biscoff title match');
  assert(liquid.includes("energyKcal: '493 kcal'"), 'Biscoff JS fallback energyKcal must be 493 kcal');
  assert(liquid.includes("energyKj: '2062 kJ'"), 'Biscoff JS fallback energyKj must be 2062 kJ');
  assert(liquid.includes("fat: '15.3g'"), 'Biscoff JS fallback fat must be 15.3g');
  assert(liquid.includes("saturates: '4.2g'"), 'Biscoff JS fallback saturates must be 4.2g');
  assert(liquid.includes("carbs: '46.4g'"), 'Biscoff JS fallback carbs must be 46.4g');
  assert(liquid.includes("sugars: '20.7g'"), 'Biscoff JS fallback sugars must be 20.7g');
  assert(liquid.includes("fibre: '8.8g'"), 'Biscoff JS fallback fibre must be 8.8g');
  assert(liquid.includes("protein: '39.0g'"), 'Biscoff JS fallback protein must be 39.0g');
  assert(liquid.includes("salt: '0.76g'"), 'Biscoff JS fallback salt must be 0.76g');
  assert(liquid.includes("allergens: 'Oats, Milk, Soya, Wheat'"), 'Biscoff JS fallback allergens must be Oats, Milk, Soya, Wheat');
  console.log('✓ Client JS openModal Biscoff definition matches Shopify Admin Metaobject 100%');

  console.log('\n🎉 ALL BISCOFF METAOBJECT ALIGNMENT TESTS PASSED PERFECTLY!');
}

testBiscoffMetaobject().catch(err => {
  console.error(err);
  process.exit(1);
});
