const fs = require('fs');
const path = require('path');
const { Liquid } = require('liquidjs');

console.log('--- TESTING SHOPIFY LIQUID SYNTAX & TAG BALANCING ---');

const filePath = path.join(__dirname, '..', 'views', 'choose-meals.liquid');
const content = fs.readFileSync(filePath, 'utf8');

// 1. Tag hierarchy balance check on raw view
const lines = content.split('\n');
const stack = [];
let hasError = false;

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  const tagRegex = /{%\s*(if|unless|for|case|tablerow|endif|endunless|endfor|endcase|endtablerow)\b[^%]*%}/g;
  let m;
  while ((m = tagRegex.exec(line)) !== null) {
    const tag = m[1];
    if (['if', 'unless', 'for', 'case', 'tablerow'].includes(tag)) {
      stack.push({ tag: tag, line: lineNum, text: m[0] });
    } else if (tag.startsWith('end')) {
      const top = stack.length > 0 ? stack[stack.length - 1] : null;
      const expected = top ? 'end' + top.tag : 'none';
      if (tag !== expected) {
        console.error(`MISMATCH at line ${lineNum}: got {% ${tag} %}, expected {% ${expected} %} (opened ${top ? top.text : 'none'} at line ${top ? top.line : 'none'})`);
        hasError = true;
      } else {
        stack.pop();
      }
    }
  }
});

if (stack.length > 0) {
  console.error('Unclosed tags remaining in views/choose-meals.liquid:', stack);
  hasError = true;
}

if (!hasError) {
  console.log('✓ views/choose-meals.liquid: All Liquid block tags (if/endif, for/endfor, unless/endunless) are 100% matched and balanced!');
} else {
  process.exit(1);
}

// 2. LiquidJS Engine Full Parse Check (stripping raw wrapper)
const engine = new Liquid();
try {
  const rawStripped = content.replace(/{%\s*raw\s*%}/g, '').replace(/{%\s*endraw\s*%}/g, '');
  engine.parse(rawStripped);
  console.log('✓ views/choose-meals.liquid: Full Liquid compilation check passed with ZERO syntax errors!');
} catch (err) {
  console.error('❌ Liquid parse error in views/choose-meals.liquid:', err.message);
  process.exit(1);
}

// 3. Node Express Server Rendering Simulation
const serverEngine = new Liquid({
  root: path.resolve(__dirname, '..', 'views'),
  extname: '.liquid'
});

let rendered = '';
try {
  rendered = serverEngine.renderFileSync('choose-meals', {
    mealQuota: 6,
    contractId: 'gid://shopify/SubscriptionContract/12345678',
    activeDeliveryDate: 'Mon 20 Nov',
    activeCutoffDate: 'Thu 16 Nov @ 11:59 PM UK',
    isCutoffPassed: false
  });
  console.log('✓ Express server renderFileSync rendered cleanly (' + rendered.length + ' bytes)');
} catch (err) {
  console.error('❌ Express server render error:', err.message);
  process.exit(1);
}

// 4. Validate Rendered Output Sent to Shopify Storefront App Proxy
const renderedLines = rendered.split('\n');
const renderedStack = [];
let renderedError = false;

renderedLines.forEach((line, idx) => {
  const lineNum = idx + 1;
  const tagRegex = /{%\s*(if|unless|for|case|tablerow|endif|endunless|endfor|endcase|endtablerow)\b[^%]*%}/g;
  let m;
  while ((m = tagRegex.exec(line)) !== null) {
    const tag = m[1];
    if (['if', 'unless', 'for', 'case', 'tablerow'].includes(tag)) {
      renderedStack.push({ tag: tag, line: lineNum, text: m[0] });
    } else if (tag.startsWith('end')) {
      const top = renderedStack.length > 0 ? renderedStack[renderedStack.length - 1] : null;
      const expected = top ? 'end' + top.tag : 'none';
      if (tag !== expected) {
        console.error(`MISMATCH in App Proxy rendered output at line ${lineNum}: got {% ${tag} %}, expected {% ${expected} %}`);
        renderedError = true;
      } else {
        renderedStack.pop();
      }
    }
  }
});

if (renderedStack.length > 0) {
  console.error('Unclosed tags remaining in rendered output:', renderedStack);
  renderedError = true;
}

if (!renderedError) {
  console.log('✓ App Proxy Rendered Output: All Liquid tags sent to Shopify storefront are 100% matched and balanced!');
} else {
  process.exit(1);
}

// 5. Shopify Storefront Liquid Engine Simulation
try {
  engine.parse(rendered);
  console.log('✓ Shopify Storefront Liquid Engine simulation parsed with ZERO syntax errors!');
} catch (err) {
  console.error('❌ Shopify Storefront Liquid parse error:', err.message);
  process.exit(1);
}

console.log('\n🎉 ALL LIQUID SYNTAX TESTS PASSED PERFECTLY WITH ZERO ERRORS!');
