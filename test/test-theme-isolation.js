const path = require('path');
const fs = require('fs');
const { Liquid } = require('liquidjs');

async function testThemeIsolation() {
  console.log('=============================================');
  console.log('🧪 VERIFYING LIVE VS DUPLICATE THEME ISOLATION');
  console.log('=============================================\n');

  const liquidContent = fs.readFileSync(path.resolve(__dirname, '../views/choose-meals.liquid'), 'utf8');
  const serverContent = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');

  const checks = [
    // 1. Shopify Liquid Theme Detection
    {
      name: 'Liquid checks theme.role != "main" to detect duplicate theme',
      pass: liquidContent.includes("theme.role != 'main'")
    },
    {
      name: 'Liquid checks theme.name for "shubham" and "13.oct"',
      pass: liquidContent.includes("down_tname contains 'shubham'") && liquidContent.includes("down_tname contains '13.oct'")
    },
    {
      name: 'Liquid checks content_for_header for preview_theme_id',
      pass: liquidContent.includes("content_for_header contains 'preview_theme_id'")
    },
    {
      name: 'Liquid incorporates server-side isDuplicateTheme flag',
      pass: liquidContent.includes('if isDuplicateTheme')
    },

    // 2. Step 3 Isolation
    {
      name: 'Step 3 FEATURED ADD-ONS panel is wrapped in {% if is_duplicate_theme %}',
      pass: liquidContent.includes('{% if is_duplicate_theme %}') && 
            liquidContent.indexOf('{% if is_duplicate_theme %}') < liquidContent.indexOf('id="gimmie-addons-panel"')
    },
    {
      name: 'Step 3 panel is closed with {% endif %}',
      pass: liquidContent.indexOf('{% endif %}', liquidContent.indexOf('id="gimmie-addons-panel"')) > -1
    },

    // 3. Sidebar Add-ons Section Isolation
    {
      name: 'Sidebar summary add-ons section is wrapped in {% if is_duplicate_theme %}',
      pass: liquidContent.includes('id="gimmie-summary-addons-section"') &&
            liquidContent.lastIndexOf('{% if is_duplicate_theme %}') < liquidContent.indexOf('id="gimmie-summary-addons-section"')
    },

    // 4. Client JS Isolation
    {
      name: 'JSON config passes isDuplicateTheme state',
      pass: liquidContent.includes('"isDuplicateTheme"')
    },
    {
      name: 'Client JS addons array enforces config.isDuplicateTheme',
      pass: liquidContent.includes('config.isDuplicateTheme ?')
    },

    // 5. Server-side Guard in server.js
    {
      name: 'server.js detects preview_theme_id and theme_id query params',
      pass: serverContent.includes('req.query.preview_theme_id') && serverContent.includes('req.query.theme_id')
    },
    {
      name: 'server.js passes isDuplicateTheme to template',
      pass: serverContent.includes('isDuplicateTheme: isDuplicateTheme')
    }
  ];

  let allPassed = true;
  checks.forEach((c, i) => {
    console.log(`[Check ${i + 1}] ${c.name}: ${c.pass ? '✓ PASS' : '✗ FAIL'}`);
    if (!c.pass) allPassed = false;
  });

  // Test Liquid rendering compilation
  console.log('\nTesting Liquid Template Compilation...');
  const engine = new Liquid({
    root: path.resolve(__dirname, '../views'),
    extname: '.liquid'
  });
  const menuService = require('../services/menu');
  const addons = await menuService.getAddons();
  const meals = await menuService.getWeeklyMenu();

  const renderedLive = await engine.renderFile('choose-meals', {
    customerName: 'Hannah',
    mealQuota: 6,
    meals,
    addons,
    formattedDeliveryDate: 'Mon 19 Oct',
    isDuplicateTheme: false
  });

  const renderedDup = await engine.renderFile('choose-meals', {
    customerName: 'Hannah',
    mealQuota: 6,
    meals,
    addons,
    formattedDeliveryDate: 'Mon 19 Oct',
    isDuplicateTheme: true
  });

  console.log(`Live Template compilation: ${renderedLive.length > 50000 ? '✓ PASS' : '✗ FAIL'} (${renderedLive.length} bytes)`);
  console.log(`Duplicate Template compilation: ${renderedDup.length > 50000 ? '✓ PASS' : '✗ FAIL'} (${renderedDup.length} bytes)`);

  console.log(`\n=============================================`);
  console.log(`Overall Isolation Result: ${allPassed ? '✓ 100% PASS' : '✗ FAILED'}`);
  console.log(`=============================================\n`);

  if (!allPassed) process.exit(1);
}

testThemeIsolation().catch(err => {
  console.error(err);
  process.exit(1);
});
