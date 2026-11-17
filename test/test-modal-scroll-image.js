const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTING MODAL IMAGE DISPLAY & SCROLLABILITY ---');

const liquidPath = path.join(__dirname, '..', 'views', 'choose-meals.liquid');
const liquid = fs.readFileSync(liquidPath, 'utf8');

const stylesPath = path.join(__dirname, '..', 'views', 'styles-inline.liquid');
const styles = fs.readFileSync(stylesPath, 'utf8');

// 1. Check Modal 2-column Grid & Surface Structure
assert(liquid.includes('class="gimmie-build-box__meal-modal-grid"'), 'Modal must include 2-column grid .gimmie-build-box__meal-modal-grid');
assert(liquid.includes('class="gimmie-build-box__meal-modal-surface"'), 'Modal must include surface container .gimmie-build-box__meal-modal-surface');
assert(liquid.includes('class="gimmie-build-box__meal-modal-content"'), 'Modal must include content container .gimmie-build-box__meal-modal-content');
console.log('✓ Modal structure: 2-column grid layout matching build-your-box');

// 2. Check Image Container & Fallbacks
assert(liquid.includes('id="gimmie-modal-image-wrap" class="gimmie-build-box__meal-modal-image-wrap"'), 'Modal must have image wrap with exact class');
assert(liquid.includes('id="gimmie-modal-image" src="" alt="" class="gimmie-build-box__meal-modal-image"'), 'Modal image must have exact class');
assert(liquid.includes('onerror="if(!this.dataset.errored){this.dataset.errored=true;this.src='), 'Modal image must have safety fallback on error');
console.log('✓ Modal image container and onerror fallback present');

// 3. Check JavaScript Image Resolution in openModal
assert(liquid.includes('card.querySelector(\'.gimmie-build-box__meal-image, img\')'), 'JS must inspect card image element if data-image is missing');
assert(liquid.includes('modalImg.src = rawImage'), 'JS must set modalImg.src');
assert(liquid.includes('modalImgWrap.style.display = \'block\''), 'JS must ensure modalImgWrap is visible');
assert(liquid.includes('scrollSurface.scrollTop = 0'), 'JS must reset scroll position to top when opened');
console.log('✓ JS openModal image resolution & scroll reset logic verified');

// 4. Check CSS Overflow & Scrolling Capabilities (Hide inner duplicate scrollbar, lock page scroll)
assert(styles.includes('overflow-y: auto !important'), 'Modal dialog must have overflow-y: auto !important for full scrolling');
assert(styles.includes('-webkit-overflow-scrolling: touch !important'), 'Modal must support smooth iOS touch momentum scrolling');
assert(styles.includes('.gimmie-build-box__meal-modal-dialog::-webkit-scrollbar'), 'Custom sleek scrollbar selector must be configured');
assert(styles.includes('scrollbar-width: none !important'), 'Inner scrollbar must be hidden via scrollbar-width: none');
assert(styles.includes('body.gimmie-build-box-modal-open'), 'Body modal open locking rule must exist');
console.log('✓ CSS: overflow-y: auto !important, touch scrolling, inner scrollbar hidden, and body scroll lock verified');

// 5. Check Green Border Styling on Modal & Image Wrap (Sage green #8FAF8F, never black #102B10)
assert(styles.includes('border: 2px solid #8FAF8F !important'), 'Modal dialog and image wrap must have green border #8FAF8F');
assert(!styles.includes('.gimmie-build-box__meal-modal-dialog,\n.gimmie-modal__content {\n  position: relative !important;\n  z-index: 2 !important;\n  width: 100% !important;\n  max-width: 960px !important;\n  max-height: 90vh !important;\n  background: #FFFDF9 !important;\n  border: 2px solid #102B10'), 'Modal dialog must NOT have black border');
console.log('✓ Modal styling: Sage green border (#8FAF8F) verified, black borders removed');

console.log('\n🎉 ALL MODAL SCROLL & IMAGE TESTS PASSED PERFECTLY!');
