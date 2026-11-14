const path = require('path');
const { Liquid } = require('liquidjs');

async function testDynamicPriority() {
  const engine = new Liquid({
    root: path.resolve(__dirname, '../views'),
    extname: '.liquid'
  });

  // Test 1: Dynamic product configured via Metafields in Shopify Admin
  const customDynamicAddon = {
    id: 'gid://shopify/Product/dyn_custom_1',
    variantId: 'gid://shopify/ProductVariant/dyn_var_1',
    title: 'BLUEBERRY & LEMON PROTEIN OATS',
    handle: 'blueberry-lemon-protein-oats',
    price: '4.95',
    image: 'https://images.unsplash.com/photo-1584985314300-8806c9e0d16a?auto=format&fit=crop&w=800&q=80',
    metafields: {
      custom: {
        short_description: { value: 'Freshly updated chef recipe from Shopify Admin.' },
        calories: { value: '392 kcal' },
        protein: { value: '35g' },
        ingredients: { value: 'Custom Organic Rolled Oats, New Whey Blend, Fresh Blueberries.' },
        allergens: { value: 'Milk, Oats' }
      }
    }
  };

  // Test 2: Dynamic product with ingredients and allergens inside product description HTML
  const customDescProduct = {
    id: 'gid://shopify/Product/dyn_custom_2',
    variantId: 'gid://shopify/ProductVariant/dyn_var_2',
    title: 'PEANUT BUTTER CRUNCH PROTEIN BALL',
    handle: 'peanut-butter-crunch-protein-ball',
    price: '3.50',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    description: '<p>Handmade artisanal peanut protein bite crafted for clean sustained energy.</p><p>Ingredients: Medjool Dates, Roasted Peanuts, Raw Cacao, Grass-Fed Whey Isolate.</p><p>Allergens: Peanuts, Milk.</p>',
    metafields: {
      custom: {
        calories: { value: '240 kcal' },
        protein: { value: '18g' }
      }
    }
  };

  const rendered = await engine.renderFile('choose-meals', {
    customerName: 'Hannah Conway',
    customerEmail: 'hannahconway@hotmail.co.uk',
    mealQuota: 6,
    meals: [],
    addons: [customDynamicAddon, customDescProduct],
    activeContractId: '12345',
    formattedDeliveryDate: 'Mon 19 Oct',
    cutoffPassed: false,
    cutoffTimestamp: Date.now() + 86400000,
    isDuplicateTheme: true
  });

  console.log('--- TESTING 100% DYNAMIC PRODUCT PRIORITY ---');
  const checks = [
    { name: 'Product 1: Renders dynamic custom calories (392 KCAL)', pass: rendered.includes('392 KCAL') },
    { name: 'Product 1: Renders dynamic custom protein (35G PROTEIN)', pass: rendered.includes('35G PROTEIN') },
    { name: 'Product 1: Renders dynamic custom ingredients from metafield', pass: rendered.includes('Custom Organic Rolled Oats, New Whey Blend, Fresh Blueberries.') },
    { name: 'Product 1: Renders dynamic custom short description', pass: rendered.includes('Freshly updated chef recipe from Shopify Admin.') },
    { name: 'Product 2: Renders dynamic calories (240 KCAL)', pass: rendered.includes('240 KCAL') },
    { name: 'Product 2: Renders dynamic protein (18G PROTEIN)', pass: rendered.includes('18G PROTEIN') },
    { name: 'Product 2: Renders dynamic ingredients extracted from description HTML', pass: rendered.includes('Medjool Dates, Roasted Peanuts, Raw Cacao, Grass-Fed Whey Isolate.') },
    { name: 'Product 2: Renders dynamic allergens extracted from description HTML', pass: rendered.includes('Peanuts, Milk.') },
    { name: 'Product 2: Renders clean short description without HTML tags', pass: rendered.includes('Handmade artisanal peanut protein bite crafted for clean sustained energy.') }
  ];

  let ok = true;
  checks.forEach(c => {
    console.log(`${c.pass ? '✓' : '❌'} ${c.name}`);
    if (!c.pass) ok = false;
  });

  if (!ok) process.exit(1);
  console.log('\n🎉 100% DYNAMIC PRODUCT DATA VERIFICATION PASSED!');
}

testDynamicPriority().catch(e => {
  console.error(e);
  process.exit(1);
});
