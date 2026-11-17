const path = require('path');
const { Liquid } = require('liquidjs');

async function testDynamicWeeklyRotation() {
  console.log('--- TESTING 100% DYNAMIC WEEKLY PRODUCT ROTATION ---');

  const engine = new Liquid({
    root: path.resolve(__dirname, '../views'),
    extname: '.liquid'
  });

  // Simulation of a brand new weekly product rotation in Shopify
  // A new meal product with full nutritional metafields
  const newRotationMeal = {
    id: 'gid://shopify/Product/dyn_week_meal_99',
    variantId: 'gid://shopify/ProductVariant/dyn_week_var_99',
    title: 'MEDITERRANEAN LEMON HERB CHICKEN',
    handle: 'mediterranean-lemon-herb-chicken',
    image: 'https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=800&q=80',
    description: 'Tender marinated chicken breast with roasted Mediterranean vegetables and oregano-infused brown rice.',
    macros: {
      calories: '475 kcal',
      protein: '48.5g Protein',
      carbs: '38.0g Carbs',
      fat: '11.5g Fat'
    },
    nutrition: {
      serving: 'Per Serving (450g)',
      energyKj: '1987 kJ',
      energyKcal: '475 kcal',
      fat: '11.5g',
      saturates: '2.8g',
      carbs: '38.0g',
      sugars: '5.2g',
      fibre: '7.4g',
      protein: '48.5g',
      salt: '0.85g'
    },
    ingredients: 'Chicken Breast (42%), Brown Rice (30%), Courgette, Red Pepper, Red Onion, Extra Virgin Olive Oil, Lemon Juice, Garlic, Oregano, Sea Salt, Black Pepper.',
    allergens: 'None',
    metafields: {
      custom: {
        energy: { value: '1987 kJ / 475 kcal' },
        protein: { value: '48.5g' },
        fat: { value: '11.5g' },
        saturates: { value: '2.8g' },
        carbohydrates: { value: '38.0g' },
        sugars: { value: '5.2g' },
        fibre: { value: '7.4g' },
        salt: { value: '0.85g' },
        serving_size: { value: 'Per Serving (450g)' },
        ingredients: { value: 'Chicken Breast (42%), Brown Rice (30%), Courgette, Red Pepper, Red Onion, Extra Virgin Olive Oil, Lemon Juice, Garlic, Oregano, Sea Salt, Black Pepper.' },
        allergens: { value: 'None' },
        short_description: { value: 'Tender marinated chicken breast with roasted Mediterranean vegetables.' }
      }
    }
  };

  // A new add-on with rich text ingredients and description HTML
  const newRotationAddon = {
    id: 'gid://shopify/Product/dyn_week_addon_88',
    variantId: 'gid://shopify/ProductVariant/dyn_week_var_88',
    title: 'SALTED CARAMEL PROTEIN OATS',
    handle: 'salted-caramel-protein-oats',
    price: '4.95',
    image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=800&q=80',
    description: '<p>Velvety overnight oats with sea salt caramel and whey protein.</p><p>Ingredients: Porridge <strong>Oats</strong> (Gluten), Whey Protein (<strong>Milk</strong>, <strong>Soya</strong>), Sea Salt Caramel Swirl.</p><p>Allergens: Oats, Milk, Soya.</p>',
    macros: {
      calories: '450 kcal',
      protein: '36.0g Protein',
      carbs: '52.0g Carbs',
      fat: '9.0g Fat'
    },
    nutrition: {
      serving: 'Per Pot (300g)',
      energyKj: '1883 kJ',
      energyKcal: '450 kcal',
      fat: '9.0g',
      saturates: '2.1g',
      carbs: '52.0g',
      sugars: '14.0g',
      fibre: '6.5g',
      protein: '36.0g',
      salt: '0.65g'
    },
    ingredients: 'Porridge <strong>Oats</strong> (Gluten), Whey Protein (<strong>Milk</strong>, <strong>Soya</strong>), Sea Salt Caramel Swirl.',
    allergens: 'Oats, Milk, Soya',
    metafields: {
      custom: {
        energy: { value: '1883 kJ / 450 kcal' },
        protein: { value: '36.0g' },
        fat: { value: '9.0g' },
        saturates: { value: '2.1g' },
        carbohydrates: { value: '52.0g' },
        sugars: { value: '14.0g' },
        fibre: { value: '6.5g' },
        salt: { value: '0.65g' },
        serving_size: { value: 'Per Pot (300g)' }
      }
    }
  };

  // A direct Shopify Metaobject Drop simulation (no .fields property, pure direct keys from Shopify Admin)
  const metaobjectRotationMeal = {
    id: 'gid://shopify/Metaobject/616841281917',
    name: { value: 'Biscoff Biscuit Protein Oats' },
    meal_image: { value: 'https://cdn.shopify.com/s/files/1/02._Final_Biscoff.png' },
    description: { value: 'Creamy overnight oats blended with premium whey protein, Greek yoghurt and chia seeds. Topped with a drizzle of Biscoff spread and biscuit crumb.' },
    ingredients: { value: 'Porridge Oats, Whey Protein (Milk, Soya), 0% Fat Greek Yoghurt (Milk), Semi Skimmed Milk, Chia Seeds, Lotus Biscoff Biscuit & Spread [Wheat Flour, Sugar, Vegetable Oils (Palm Oil, Rapeseed Oil), Soya Flour, Emulsifier (Soya Lecithin), Salt, Cinnamon].' },
    allergens: { value: 'Oats, Milk, Soya, Wheat' },
    energy: { value: '2062 kj / 493 kcal' },
    fat: { value: '15.3' },
    of_which_saturates: { value: '4.2' },
    carbohydrates: { value: '46.4' },
    of_which_sugars: { value: '20.7' },
    fibre: { value: '8.8' },
    protein: { value: '39.0' },
    salt: { value: '0.76' }
  };

  const rendered = await engine.renderFile('choose-meals', {
    customerName: 'Hannah Conway',
    customerEmail: 'hannahconway@hotmail.co.uk',
    mealQuota: 6,
    meals: [newRotationMeal, metaobjectRotationMeal],
    addons: [newRotationAddon],
    activeContractId: 'sub_12345',
    formattedDeliveryDate: 'Mon 26 Oct',
    cutoffPassed: false,
    cutoffTimestamp: Date.now() + 86400000,
    isDuplicateTheme: true
  });

  const checks = [
    { name: 'Weekly Meal: Dynamic title rendered', pass: rendered.includes('MEDITERRANEAN LEMON HERB CHICKEN') },
    { name: 'Weekly Meal: Dynamic calories attribute (475 kcal)', pass: rendered.includes('data-cals="475 kcal"') },
    { name: 'Weekly Meal: Dynamic protein attribute (48.5g)', pass: rendered.includes('data-prot="48.5g"') },
    { name: 'Weekly Meal: Dynamic fibre attribute (7.4g)', pass: rendered.includes('data-fibre="7.4g"') },
    { name: 'Weekly Meal: Dynamic salt attribute (0.85g)', pass: rendered.includes('data-salt="0.85g"') },
    { name: 'Weekly Meal: Dynamic saturates attribute (2.8g)', pass: rendered.includes('data-saturates="2.8g"') },
    { name: 'Weekly Meal: Dynamic carbs attribute (38.0g)', pass: rendered.includes('data-carbs="38.0g"') },
    { name: 'Weekly Meal: Dynamic fat attribute (11.5g)', pass: rendered.includes('data-fat="11.5g"') },
    { name: 'Weekly Meal: Dynamic serving size attribute (Per Serving (450g))', pass: rendered.includes('data-serving="Per Serving (450g)"') },
    { name: 'Weekly Meal: Dynamic ingredients attribute matches metafield', pass: rendered.includes('Chicken Breast (42%), Brown Rice (30%), Courgette, Red Pepper') },
    { name: 'Metaobject Drop: Direct Fibre extraction (8.8g) without .fields', pass: rendered.includes('data-fibre="8.8g"') },
    { name: 'Metaobject Drop: Direct Protein extraction (39.0g) without .fields', pass: rendered.includes('data-prot="39.0g Protein"') || rendered.includes('data-prot="39.0g"') },
    { name: 'Metaobject Drop: Direct Salt extraction (0.76g) without .fields', pass: rendered.includes('data-salt="0.76g"') },
    { name: 'Metaobject Drop: Direct Fat extraction (15.3g) without .fields', pass: rendered.includes('data-fat="15.3g"') },
    { name: 'Metaobject Drop: Direct Carbs extraction (46.4g) without .fields', pass: rendered.includes('data-carbs="46.4g"') },
    { name: 'Weekly Add-on: Dynamic title rendered', pass: rendered.includes('SALTED CARAMEL PROTEIN OATS') },
    { name: 'Weekly Add-on: Dynamic calories attribute (450 kcal)', pass: rendered.includes('data-cals="450 kcal"') },
    { name: 'Weekly Add-on: Dynamic protein attribute (36.0g)', pass: rendered.includes('data-prot="36.0g"') },
    { name: 'Weekly Add-on: Dynamic fibre attribute (6.5g)', pass: rendered.includes('data-fibre="6.5g"') },
    { name: 'Weekly Add-on: Dynamic salt attribute (0.65g)', pass: rendered.includes('data-salt="0.65g"') },
    { name: 'Weekly Add-on: Dynamic ingredients with rich text/strong tags preserved', pass: rendered.includes('Porridge &lt;strong&gt;Oats&lt;/strong&gt;') || rendered.includes('Porridge <strong>Oats</strong>') }
  ];

  let allPass = true;
  checks.forEach(c => {
    console.log(`${c.pass ? '✓' : '❌'} ${c.name}`);
    if (!c.pass) allPass = false;
  });

  if (!allPass) {
    console.error('❌ Some dynamic weekly rotation checks failed!');
    process.exit(1);
  }

  console.log('\n🎉 ALL 100% DYNAMIC WEEKLY ROTATION TESTS PASSED!');
}

testDynamicWeeklyRotation().catch(err => {
  console.error(err);
  process.exit(1);
});
