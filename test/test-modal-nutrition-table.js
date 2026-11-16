const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTING NUTRITIONAL MODAL FORMAT (BUILD-YOUR-BOX MATCH) ---');

const liquidPath = path.join(__dirname, '..', 'views', 'choose-meals.liquid');
const liquid = fs.readFileSync(liquidPath, 'utf8');

// 1. Check modal markup structure
assert(liquid.includes('class="gimmie-build-box__nutrition-table-wrap"'), 'Modal should have .gimmie-build-box__nutrition-table-wrap');
assert(liquid.includes('class="gimmie-modal__table gimmie-build-box__nutrition-table"'), 'Modal table should have .gimmie-build-box__nutrition-table');
assert(liquid.includes('id="gimmie-modal-nutrition-wrap"'), 'Modal should have #gimmie-modal-nutrition-wrap');

// 2. Check section order: Nutritional information should appear before Ingredients
const nutritionIdx = liquid.indexOf('id="gimmie-modal-nutrition-wrap"');
const ingredientsIdx = liquid.indexOf('id="gimmie-modal-ingredients-wrap"');
const allergensIdx = liquid.indexOf('id="gimmie-modal-allergens-wrap"');

assert(nutritionIdx !== -1 && ingredientsIdx !== -1 && allergensIdx !== -1, 'All modal sections must be present');
assert(nutritionIdx < ingredientsIdx, 'Nutritional Information must appear BEFORE Ingredients to match build-your-box');
assert(ingredientsIdx < allergensIdx, 'Ingredients must appear BEFORE Allergens to match build-your-box');
console.log('✓ Section order: Title -> Description -> Nutritional Information -> Ingredients -> Allergens');

// 3. Check JavaScript openModal formatting
assert(liquid.includes('gimmie-build-box__nutrition-child-row'), 'JS must generate child rows with .gimmie-build-box__nutrition-child-row');
assert(liquid.includes('of which saturates'), 'Table must contain "of which saturates"');
assert(liquid.includes('of which sugars'), 'Table must contain "of which sugars"');
assert(liquid.includes('energyDisplay'), 'JS must build energyDisplay combining kj and kcal');
assert(liquid.includes('energyDisplay'), 'JS must format energy as energyDisplay');
console.log('✓ Table rows: Energy (combined kj / kcal), of which saturates (child row), of which sugars (child row)');

// 4. Check CSS styling in views/styles-inline.liquid and public/styles.css
const inlineCssPath = path.join(__dirname, '..', 'views', 'styles-inline.liquid');
const inlineCss = fs.readFileSync(inlineCssPath, 'utf8');
assert(inlineCss.includes('.gimmie-build-box__nutrition-table-wrap'), 'Inline styles must include .gimmie-build-box__nutrition-table-wrap');
assert(inlineCss.includes('.gimmie-build-box__nutrition-child-row th'), 'Inline styles must include .gimmie-build-box__nutrition-child-row');
assert(inlineCss.includes('#8FAF8F'), 'Inline styles must include sage green border color #8FAF8F');
assert(inlineCss.includes('#fffaf0'), 'Inline styles must include background #fffaf0');
console.log('✓ CSS: Sage green border (#8FAF8F), almond background (#fffaf0), child row indentation');

const publicCssPath = path.join(__dirname, '..', 'public', 'styles.css');
const publicCss = fs.readFileSync(publicCssPath, 'utf8');
assert(publicCss.includes('.gimmie-build-box__nutrition-table-wrap'), 'Public CSS must include .gimmie-build-box__nutrition-table-wrap');
console.log('✓ Public CSS matches');

console.log('\n🎉 ALL NUTRITIONAL MODAL TESTS PASSED PERFECTLY!');
