const path = require('path');
const fs = require('fs');
const { Liquid } = require('liquidjs');

async function testLiveTheme() {
  console.log('=============================================');
  console.log('🧪 VERIFYING LIVE THEME STOREFRONT ROLLOUT');
  console.log('=============================================\n');

  const liquidContent = fs.readFileSync(path.resolve(__dirname, '../views/choose-meals.liquid'), 'utf8');
  const stylesContent = fs.readFileSync(path.resolve(__dirname, '../views/styles-inline.liquid'), 'utf8');
  const serverContent = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');

  const engine = new Liquid({
    root: path.resolve(__dirname, '../views'),
    extname: '.liquid'
  });

  const menuService = require('../services/menu');
  const addons = await menuService.getAddons();
  const meals = await menuService.getWeeklyMenu();

  // Simulate rendering on Shopify LIVE Theme
  const renderedLive = await engine.renderFile('choose-meals', {
    customerName: 'Hannah',
    mealQuota: 6,
    meals,
    addons,
    formattedDeliveryDate: 'Mon 19 Oct',
    isDuplicateTheme: true
  });

  console.log(`Live Template Render Size: ${renderedLive.length} bytes\n`);

  const checks = [
    {
      name: 'views/choose-meals.liquid sets is_duplicate_theme = true for live storefront rollout',
      pass: liquidContent.includes('{% assign is_duplicate_theme = true %}')
    },
    {
      name: 'Step 3: Add-ons Panel (#gimmie-addons-panel) is rendered in live storefront output',
      pass: renderedLive.includes('id="gimmie-addons-panel"')
    },
    {
      name: 'Sidebar Add-ons Summary section (#gimmie-summary-addons-section) is rendered in live storefront output',
      pass: renderedLive.includes('id="gimmie-summary-addons-section"')
    },
    {
      name: 'server.js passes isDuplicateTheme: true to live template rendering',
      pass: serverContent.includes('isDuplicateTheme: true,')
    },
    {
      name: 'Nutritional Information table Protein rounding (e.g. 39g or 40g instead of 39.0g) is active in choose-meals.liquid',
      pass: liquidContent.includes('formatGramVal') && liquidContent.includes("isProtein")
    },
    {
      name: 'Modal scrolling enabled with custom sage green scrollbar in styles-inline.liquid',
      pass: stylesContent.includes('overflow-y: auto !important') && stylesContent.includes('scrollbar-color: #8FAF8F transparent')
    },
    {
      name: 'Modal image container has flat cream background (#F6F1E7) and black border (#102B10) with 4px black shadow',
      pass: stylesContent.includes('background-color: #F6F1E7 !important') && 
            stylesContent.includes('border: 2px solid #102B10 !important') &&
            stylesContent.includes('box-shadow: 4px 4px 0 #102B10 !important')
    },
    {
      name: 'Modal backdrop has rgba(0, 0, 0, 0.6) dark overlay in styles-inline.liquid',
      pass: stylesContent.includes('background: rgba(0, 0, 0, 0.6) !important')
    },
    {
      name: 'Modal close button is clean single button without duplicate icons',
      pass: liquidContent.includes('gimmie-modal-close-icon') && stylesContent.includes('#gimmie-modal-close::before,')
    },
    {
      name: 'Config JSON passes isDuplicateTheme state to client JS',
      pass: liquidContent.includes('"isDuplicateTheme":')
    }
  ];

  let allPassed = true;
  checks.forEach((c, i) => {
    console.log(`[Check ${i + 1}] ${c.name}: ${c.pass ? '✓ PASS' : '✗ FAIL'}`);
    if (!c.pass) allPassed = false;
  });

  console.log(`\n=============================================`);
  console.log(`Live Theme Verification Result: ${allPassed ? '✓ 100% PASS' : '✗ FAILED'}`);
  console.log(`=============================================\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

testLiveTheme().catch(err => {
  console.error(err);
  process.exit(1);
});
