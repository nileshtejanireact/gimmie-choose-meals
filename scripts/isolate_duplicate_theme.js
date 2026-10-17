const fs = require('fs');
const path = require('path');

// =========================================================================
// 1. Update server.js
// =========================================================================
const serverPath = path.resolve(__dirname, '../server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

const oldServerSnippet = `    // 🔒 HIDE FROM CLIENT: If disabled and not in private test mode (?preview=true)
    if (!SHOW_PAGE_TO_CLIENT && req.query.preview !== 'true' && req.query.test !== 'true') {
      console.log('🔒 Page hidden from client. Rendering coming-soon placeholder.');
      return res.render('coming-soon');
    }`;

const newServerSnippet = `    // Detect whether request is targeting the duplicate / preview theme
    const isDuplicateTheme = !!(
      req.query.preview_theme_id ||
      req.query.theme_id ||
      req.query.preview === 'true' ||
      req.query.test === 'true' ||
      (req.headers.referer && req.headers.referer.includes('preview_theme_id')) ||
      (req.headers.cookie && req.headers.cookie.includes('preview_theme'))
    );

    // 🔒 HIDE FROM CLIENT: If disabled and not in preview/duplicate mode
    if (!SHOW_PAGE_TO_CLIENT && !isDuplicateTheme) {
      console.log('🔒 Page hidden on live theme. Rendering coming-soon placeholder.');
      return res.render('coming-soon');
    }`;

if (serverContent.includes(oldServerSnippet)) {
  serverContent = serverContent.replace(oldServerSnippet, newServerSnippet);
  console.log('✓ Updated server.js theme detection and guard');
} else {
  console.warn('⚠️ Could not find oldServerSnippet in server.js');
}

// Pass isDuplicateTheme to res.render in server.js
const oldRenderSnippet = `    res.render('choose-meals', {
      customer: customerObj,
      customerName: customerName,
      customerEmail: customerEmail,
      mealQuota: subscription.mealQuota || 6,
      contractId: subscription.contractId || subscription.id,
      formattedDeliveryDate: subscription.formattedDeliveryDate || 'Tue 1 Sept',
      currentLines: subscription.currentLines || [],
      meals: meals,
      addons: addons
    });`;

const newRenderSnippet = `    res.render('choose-meals', {
      customer: customerObj,
      customerName: customerName,
      customerEmail: customerEmail,
      mealQuota: subscription.mealQuota || 6,
      contractId: subscription.contractId || subscription.id,
      formattedDeliveryDate: subscription.formattedDeliveryDate || 'Tue 1 Sept',
      currentLines: subscription.currentLines || [],
      meals: meals,
      addons: addons,
      isDuplicateTheme: isDuplicateTheme
    });`;

if (serverContent.includes(oldRenderSnippet)) {
  serverContent = serverContent.replace(oldRenderSnippet, newRenderSnippet);
  console.log('✓ Passed isDuplicateTheme to choose-meals.liquid in server.js');
} else {
  console.warn('⚠️ Could not find oldRenderSnippet in server.js');
}

fs.writeFileSync(serverPath, serverContent, 'utf8');

// =========================================================================
// 2. Update views/choose-meals.liquid
// =========================================================================
const liquidPath = path.resolve(__dirname, '../views/choose-meals.liquid');
let liquidContent = fs.readFileSync(liquidPath, 'utf8');
const isCrlf = liquidContent.includes('\r\n');
const normalize = s => s.replace(/\r\n/g, '\n');
const denormalize = (s, crlf) => crlf ? s.replace(/\n/g, '\r\n') : s;

let normLiquid = normalize(liquidContent);

// A. Insert is_duplicate_theme detection in Liquid header
const targetAfterMetaAddons = `        {% if active_meta_addons == blank or active_meta_addons.size == 0 %}
          {% assign active_meta_addons = shop.metaobjects.addon_product.values | default: shop.metaobjects.addon.values | default: shop.metaobjects.addons.values | default: shop.metaobjects.featured_addons.values | default: shop.metaobjects.featured_add_ons.values %}
        {% endif %}
      {% endif %}
{% endraw %}`;

const replacementWithThemeDetection = `        {% if active_meta_addons == blank or active_meta_addons.size == 0 %}
          {% assign active_meta_addons = shop.metaobjects.addon_product.values | default: shop.metaobjects.addon.values | default: shop.metaobjects.addons.values | default: shop.metaobjects.featured_addons.values | default: shop.metaobjects.featured_add_ons.values %}
        {% endif %}
      {% endif %}

      {% comment %} 🛡️ Live vs Duplicate Theme Isolation (Shapes - Shubham 13.Oct) {% endcomment %}
      {% assign is_duplicate_theme = false %}
      {% if theme.role != 'main' %}
        {% assign is_duplicate_theme = true %}
      {% endif %}
      {% assign down_tname = theme.name | downcase %}
      {% if down_tname contains 'shubham' or down_tname contains '13.oct' or down_tname contains 'duplicate' or down_tname contains 'copy' or down_tname contains 'draft' %}
        {% assign is_duplicate_theme = true %}
      {% endif %}
      {% if content_for_header contains 'preview_theme_id' or canonical_url contains 'preview_theme_id' %}
        {% assign is_duplicate_theme = true %}
      {% endif %}
{% endraw %}
      {% if isDuplicateTheme %}
        {% assign is_duplicate_theme = true %}
      {% endif %}`;

if (normLiquid.includes(normalize(targetAfterMetaAddons))) {
  normLiquid = normLiquid.replace(normalize(targetAfterMetaAddons), normalize(replacementWithThemeDetection));
  console.log('✓ Added is_duplicate_theme Liquid detection logic');
} else {
  console.warn('⚠️ Could not find targetAfterMetaAddons');
}

// B. Wrap Step 3: FEATURED ADD-ONS panel with {% if is_duplicate_theme %}
const oldStep3Start = `          <!-- Step 3: FEATURED ADD-ONS Panel (Matching Build Your Box) -->
          <div class="gimmie-build-box__panel gimmie-build-box__panel--addons" id="gimmie-addons-panel">`;

const newStep3Start = `          {% raw %}{% if is_duplicate_theme %}{% endraw %}
          <!-- Step 3: FEATURED ADD-ONS Panel (Active ONLY on Duplicate Theme: Shapes - Shubham 13.Oct) -->
          <div class="gimmie-build-box__panel gimmie-build-box__panel--addons" id="gimmie-addons-panel">`;

if (normLiquid.includes(normalize(oldStep3Start))) {
  normLiquid = normLiquid.replace(normalize(oldStep3Start), normalize(newStep3Start));
  console.log('✓ Added opening is_duplicate_theme check around Step 3 panel');
} else {
  console.warn('⚠️ Could not find oldStep3Start');
}

const oldStep3End = `              </div>

            </div>
          </div>

        </div>

        <!-- Right Column: Sticky Summary & Save Button -->`;

const newStep3End = `              </div>

            </div>
          </div>
          {% raw %}{% endif %}{% endraw %}

        </div>

        <!-- Right Column: Sticky Summary & Save Button -->`;

if (normLiquid.includes(normalize(oldStep3End))) {
  normLiquid = normLiquid.replace(normalize(oldStep3End), normalize(newStep3End));
  console.log('✓ Added closing is_duplicate_theme check around Step 3 panel');
} else {
  console.warn('⚠️ Could not find oldStep3End');
}

// C. Wrap Sidebar Summary Add-ons section with {% if is_duplicate_theme %}
const oldSidebarAddons = `            <!-- Add-ons Summary Breakdown in Sidebar -->
            <div id="gimmie-summary-addons-section" style="margin-top: 14px; padding-top: 12px; border-top: 1.5px dashed #ECEAE4;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <strong style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gimmie-muted);">
                  Featured Add-ons
                </strong>
                <span id="gimmie-summary-addons-total" style="font-size: 0.88rem; font-weight: 800; color: var(--gimmie-text);">
                  £0.00
                </span>
              </div>
              <div id="gimmie-selected-addons-list" style="font-size: 0.88rem; color: var(--gimmie-text);">
                <p style="color: var(--gimmie-muted); font-size: 0.85rem; margin: 0;">No add-ons added (Optional).</p>
              </div>
            </div>`;

const newSidebarAddons = `            {% raw %}{% if is_duplicate_theme %}{% endraw %}
            <!-- Add-ons Summary Breakdown in Sidebar (Active ONLY on Duplicate Theme) -->
            <div id="gimmie-summary-addons-section" style="margin-top: 14px; padding-top: 12px; border-top: 1.5px dashed #ECEAE4;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <strong style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gimmie-muted);">
                  Featured Add-ons
                </strong>
                <span id="gimmie-summary-addons-total" style="font-size: 0.88rem; font-weight: 800; color: var(--gimmie-text);">
                  £0.00
                </span>
              </div>
              <div id="gimmie-selected-addons-list" style="font-size: 0.88rem; color: var(--gimmie-text);">
                <p style="color: var(--gimmie-muted); font-size: 0.85rem; margin: 0;">No add-ons added (Optional).</p>
              </div>
            </div>
            {% raw %}{% endif %}{% endraw %}`;

if (normLiquid.includes(normalize(oldSidebarAddons))) {
  normLiquid = normLiquid.replace(normalize(oldSidebarAddons), normalize(newSidebarAddons));
  console.log('✓ Added is_duplicate_theme check around sidebar add-ons section');
} else {
  console.warn('⚠️ Could not find oldSidebarAddons');
}

// D. Add isDuplicateTheme to JSON config
const oldConfigJson = `      "meals": {{ meals | json }},
      "addons": {{ addons | default: '[]' | json }}
    }`;

const newConfigJson = `      "meals": {{ meals | json }},
      "addons": {{ addons | default: '[]' | json }},
      "isDuplicateTheme": {% raw %}{{ is_duplicate_theme | default: false | json }}{% endraw %}
    }`;

if (normLiquid.includes(normalize(oldConfigJson))) {
  normLiquid = normLiquid.replace(normalize(oldConfigJson), normalize(newConfigJson));
  console.log('✓ Added isDuplicateTheme to JSON config block');
} else {
  console.warn('⚠️ Could not find oldConfigJson');
}

// E. Update Client JS: Only initialize addons if config.isDuplicateTheme is true
const oldJsAddonsInit = `    const addons = activeAddonList.length > 0 ? activeAddonList : (config.addons || []);`;

const newJsAddonsInit = `    const addons = config.isDuplicateTheme ? (activeAddonList.length > 0 ? activeAddonList : (config.addons || [])) : [];`;

if (normLiquid.includes(normalize(oldJsAddonsInit))) {
  normLiquid = normLiquid.replace(normalize(oldJsAddonsInit), normalize(newJsAddonsInit));
  console.log('✓ Updated JS addons array to enforce duplicate theme isolation');
} else {
  console.warn('⚠️ Could not find oldJsAddonsInit');
}

fs.writeFileSync(liquidPath, denormalize(normLiquid, isCrlf), 'utf8');
console.log('🎉 Isolation update complete!');
