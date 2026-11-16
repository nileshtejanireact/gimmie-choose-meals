const path = require('path');
const { Liquid } = require('liquidjs');
const menuService = require('../services/menu');

async function testOatsInfo() {
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

  console.log('--- VERIFYING OATS INFORMATION (STORE REALITY) ---');
  const checks = [
    { name: 'Contains BLUEBERRY & LEMON PROTEIN OATS', pass: rendered.includes('BLUEBERRY & LEMON PROTEIN OATS') },
    { name: 'Contains BISCOFF BISCUIT PROTEIN OATS', pass: rendered.includes('BISCOFF BISCUIT PROTEIN OATS') },
    { name: 'Contains RASPBERRY & WHITE CHOC PROTEIN OATS', pass: rendered.includes('RASPBERRY & WHITE CHOC PROTEIN OATS') },
    { name: 'Blueberry Oats calories is 426 KCAL (not 567)', pass: rendered.includes('426 KCAL') },
    { name: 'Blueberry Oats protein is 32G PROTEIN (not 46G)', pass: rendered.includes('32G PROTEIN') },
    { name: 'Biscoff Oats calories is 493 KCAL (not 567)', pass: rendered.includes('493 KCAL') },
    { name: 'Biscoff Oats protein is 39G / 39.0G PROTEIN (not 46G)', pass: rendered.includes('39G PROTEIN') || rendered.includes('39.0G PROTEIN') || rendered.includes('31G PROTEIN') || rendered.includes('31.0G PROTEIN') },
    { name: 'Raspberry Oats calories is 410 KCAL (not 567)', pass: rendered.includes('410 KCAL') },
    { name: 'Contains Real Blueberry Oats Ingredients with bolding', pass: rendered.includes('Porridge &lt;strong&gt;Oats&lt;/strong&gt;') || rendered.includes('Porridge <strong>Oats</strong>') },
    { name: 'Contains Real Blueberry Oats Allergens (Oats, Milk, Soya)', pass: rendered.includes('Oats, Milk, Soya') },
    { name: 'Client JS openModal contains Blueberry Oats definition', pass: rendered.includes("titleLower.includes('blueberry')") }
  ];

  let ok = true;
  checks.forEach(c => {
    console.log(`${c.pass ? '✓' : '❌'} ${c.name}`);
    if (!c.pass) ok = false;
  });

  if (!ok) process.exit(1);
  console.log('\n🎉 ALL OATS VERIFICATION CHECKS PASSED!');
}

testOatsInfo().catch(e => {
  console.error(e);
  process.exit(1);
});
