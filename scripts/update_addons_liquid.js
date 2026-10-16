const fs = require('fs');
const path = require('path');

const liquidPath = path.resolve(__dirname, '../views/choose-meals.liquid');
let content = fs.readFileSync(liquidPath, 'utf8');

// 1. Update active_meta_addons extraction in Header
const oldExtraction = `        {% assign active_meta_addons = next_week_menu.addon_products.value | default: next_week_menu.addon_products | default: next_week_menu.addons.value | default: next_week_menu.addons | default: next_week_menu.add_ons.value | default: next_week_menu.add_ons | default: next_week_menu.featured_addons.value | default: next_week_menu.featured_addons | default: next_week_menu.addon_meals.value | default: next_week_menu.addon_meals | default: next_week_menu.addon_product.value | default: next_week_menu.addon_product | default: next_week_menu.extra_products.value | default: next_week_menu.extra_products %}
        {% if active_meta_addons == blank or active_meta_addons.size == 0 %}
          {% assign active_meta_addons = shop.metaobjects.addon_product.values | default: shop.metaobjects.addon.values | default: shop.metaobjects.addons.values %}
        {% endif %}`;

const newExtraction = `        {% assign active_meta_addons = next_week_menu.addon_products.value | default: next_week_menu.addon_products | default: next_week_menu.addons.value | default: next_week_menu.addons | default: next_week_menu.add_ons.value | default: next_week_menu.add_ons | default: next_week_menu.featured_addons.value | default: next_week_menu.featured_addons | default: next_week_menu.featured_add_ons.value | default: next_week_menu.featured_add_ons | default: next_week_menu.addon_items.value | default: next_week_menu.addon_items | default: next_week_menu.addon_meals.value | default: next_week_menu.addon_meals | default: next_week_menu.addon_product.value | default: next_week_menu.addon_product | default: next_week_menu.extra_products.value | default: next_week_menu.extra_products | default: next_week_menu.extras.value | default: next_week_menu.extras | default: next_week_menu.step_3_products.value | default: next_week_menu.step_3_products %}
        {% if active_meta_addons == blank or active_meta_addons.size == 0 %}
          {% if next_week_menu.fields %}
            {% for f in next_week_menu.fields %}
              {% assign f_key = f.key | downcase %}
              {% if f_key contains 'addon' or f_key contains 'add_on' or f_key contains 'extra' %}
                {% if f.value != blank %}
                  {% assign active_meta_addons = f.value %}
                  {% break %}
                {% endif %}
              {% endif %}
            {% endfor %}
          {% endif %}
        {% endif %}
        {% if active_meta_addons == blank or active_meta_addons.size == 0 %}
          {% assign active_meta_addons = shop.metaobjects.addon_product.values | default: shop.metaobjects.addon.values | default: shop.metaobjects.addons.values | default: shop.metaobjects.featured_addons.values | default: shop.metaobjects.featured_add_ons.values %}
        {% endif %}`;

// Normalize line breaks for replacement
const normalize = s => s.replace(/\r\n/g, '\n');
const denormalize = (s, useCrlf) => useCrlf ? s.replace(/\n/g, '\r\n') : s;

const isCrlf = content.includes('\r\n');
let normContent = normalize(content);

if (normContent.includes(normalize(oldExtraction))) {
  normContent = normContent.replace(normalize(oldExtraction), normalize(newExtraction));
  console.log('✓ Updated active_meta_addons dynamic discovery');
} else {
  console.warn('⚠️ Could not find oldExtraction target');
}

// 2. Enhance Step 3 Addon Product loop unpacking
const oldLoopStart = `                      {% for addon_raw in active_meta_addons %}
                        {% assign addon_obj = addon_raw.product | default: addon_raw %}
                        {% assign a_title = addon_obj.title.value | default: addon_obj.title | default: addon_raw.title | default: addon_raw.name.value | default: addon_raw.name %}
                        
                        {% assign a_img = nil %}
                        {% if addon_obj.image.value %}
                          {% assign a_img = addon_obj.image.value | image_url: width: 800 %}
                        {% elsif addon_obj.image %}
                          {% assign a_img = addon_obj.image | image_url: width: 800 %}
                        {% elsif addon_obj.featured_image.value %}
                          {% assign a_img = addon_obj.featured_image.value | image_url: width: 800 %}
                        {% elsif addon_obj.featured_image %}
                          {% assign a_img = addon_obj.featured_image | image_url: width: 800 %}
                        {% elsif addon_obj.photo.value %}
                          {% assign a_img = addon_obj.photo.value | image_url: width: 800 %}
                        {% elsif addon_obj.photo %}
                          {% assign a_img = addon_obj.photo | image_url: width: 800 %}
                        {% endif %}`;

const newLoopStart = `                      {% for addon_raw in active_meta_addons %}
                        {% assign addon_obj = addon_raw.product.value | default: addon_raw.product | default: addon_raw %}
                        {% assign a_title = addon_obj.title.value | default: addon_obj.title | default: addon_raw.title | default: addon_raw.name.value | default: addon_raw.name %}
                        
                        {% assign a_img = nil %}
                        {% if addon_obj.featured_image %}
                          {% assign a_img = addon_obj.featured_image | image_url: width: 800 %}
                        {% elsif addon_obj.featured_media %}
                          {% assign a_img = addon_obj.featured_media | image_url: width: 800 %}
                        {% elsif addon_obj.image.value %}
                          {% assign a_img = addon_obj.image.value | image_url: width: 800 %}
                        {% elsif addon_obj.image %}
                          {% assign a_img = addon_obj.image | image_url: width: 800 %}
                        {% elsif addon_obj.featured_image.value %}
                          {% assign a_img = addon_obj.featured_image.value | image_url: width: 800 %}
                        {% elsif addon_obj.photo.value %}
                          {% assign a_img = addon_obj.photo.value | image_url: width: 800 %}
                        {% elsif addon_obj.photo %}
                          {% assign a_img = addon_obj.photo | image_url: width: 800 %}
                        {% endif %}`;

if (normContent.includes(normalize(oldLoopStart))) {
  normContent = normContent.replace(normalize(oldLoopStart), normalize(newLoopStart));
  console.log('✓ Updated addon image & object extraction');
} else {
  console.warn('⚠️ Could not find oldLoopStart target');
}

// 3. Enhance Price and Nutrient extraction for Shopify Product drops & Metaobjects
const oldPriceAndNutrients = `                        {% assign a_price = addon_obj.price | default: addon_obj.variants.first.price | default: addon_raw.price | default: '3.50' %}
                        {% assign a_variant_id = addon_obj.variants.first.id | default: addon_obj.system.id | default: addon_obj.id | default: addon_raw.id %}
                        {% if a_variant_id == blank or a_variant_id == '' %}
                          {% assign a_variant_id = 'addon_' | append: forloop.index %}
                        {% endif %}

                        {% assign a_desc = addon_obj.description.value | default: addon_obj.description | default: addon_raw.description.value | default: addon_raw.description | default: addon_raw.summary | default: 'Freshly prepared delicious gourmet add-on to elevate your daily routine.' %}
                        {% if a_desc contains 'root' or a_desc contains 'children' %}
                          {% assign meta_desc_tag = addon_raw.description | metafield_tag | strip_html | strip %}
                          {% if meta_desc_tag != blank %}{% assign a_desc = meta_desc_tag %}{% endif %}
                        {% endif %}

                        {% assign a_cals = addon_obj.calories.value | default: addon_obj.calories | default: addon_raw.calories | default: '320 kcal' %}
                        {% assign a_prot = addon_obj.protein.value | default: addon_obj.protein | default: addon_raw.protein | default: '14g' %}
                        {% assign a_fat = addon_obj.fat.value | default: addon_obj.fat | default: addon_raw.fat | default: '10g' %}
                        {% assign a_sat = addon_obj.of_which_saturates.value | default: addon_obj.saturates | default: '2.5g' %}
                        {% assign a_carbs = addon_obj.carbohydrates.value | default: addon_obj.carbs | default: '35g' %}
                        {% assign a_sug = addon_obj.of_which_sugars.value | default: addon_obj.sugars | default: '8g' %}
                        {% assign a_fib = addon_obj.fibre.value | default: addon_obj.fiber | default: '5g' %}
                        {% assign a_salt = addon_obj.salt.value | default: addon_obj.salt | default: '0.2g' %}
                        {% assign a_serv = addon_obj.serving_size.value | default: 'Per Serving' %}
                        {% assign a_kj = addon_obj.energy.value | default: '1340 kJ' %}
                        {% assign a_ingr = addon_obj.ingredients.value | default: addon_raw.ingredients | default: 'Premium wholesome natural ingredients.' %}
                        {% assign a_aller = addon_obj.allergens.value | default: addon_raw.allergens | default: 'None' %}`;

const newPriceAndNutrients = `                        {% assign raw_p = addon_obj.price_min | default: addon_obj.price | default: addon_obj.variants.first.price | default: addon_raw.price | default: '3.50' %}
                        {% assign raw_p_str = raw_p | append: '' %}
                        {% if raw_p_str contains '.' %}
                          {% assign a_price = raw_p | replace: '£', '' | strip %}
                        {% else %}
                          {% assign raw_p_num = raw_p | plus: 0 %}
                          {% if raw_p_num >= 100 %}
                            {% assign a_price = raw_p_num | divided_by: 100.0 | round: 2 %}
                          {% else %}
                            {% assign a_price = raw_p | replace: '£', '' | strip %}
                          {% endif %}
                        {% endif %}

                        {% assign a_variant_id = addon_obj.selected_or_first_available_variant.id | default: addon_obj.variants.first.id | default: addon_raw.variants.first.id | default: addon_obj.system.id | default: addon_obj.id | default: addon_raw.id %}
                        {% if a_variant_id == blank or a_variant_id == '' %}
                          {% assign a_variant_id = 'addon_' | append: forloop.index %}
                        {% endif %}

                        {% assign a_desc = addon_obj.metafields.custom.description.value | default: addon_obj.description.value | default: addon_obj.description | default: addon_obj.content | default: addon_raw.description.value | default: addon_raw.description | default: addon_raw.summary | default: 'Freshly prepared delicious gourmet add-on to elevate your daily routine.' %}
                        {% if a_desc contains 'root' or a_desc contains 'children' %}
                          {% assign meta_desc_tag = addon_raw.description | metafield_tag | strip_html | strip %}
                          {% if meta_desc_tag != blank %}{% assign a_desc = meta_desc_tag %}{% endif %}
                        {% endif %}

                        {% assign a_cals = addon_obj.metafields.custom.calories.value | default: addon_obj.calories.value | default: addon_obj.calories | default: addon_raw.calories | default: '320 kcal' %}
                        {% assign a_prot = addon_obj.metafields.custom.protein.value | default: addon_obj.protein.value | default: addon_obj.protein | default: addon_raw.protein | default: '14g' %}
                        {% assign a_fat = addon_obj.metafields.custom.fat.value | default: addon_obj.fat.value | default: addon_obj.fat | default: addon_raw.fat | default: '10g' %}
                        {% assign a_sat = addon_obj.metafields.custom.of_which_saturates.value | default: addon_obj.metafields.custom.saturates.value | default: addon_obj.of_which_saturates.value | default: addon_obj.saturates | default: '2.5g' %}
                        {% assign a_carbs = addon_obj.metafields.custom.carbohydrates.value | default: addon_obj.metafields.custom.carbs.value | default: addon_obj.carbohydrates.value | default: addon_obj.carbs | default: '35g' %}
                        {% assign a_sug = addon_obj.metafields.custom.of_which_sugars.value | default: addon_obj.metafields.custom.sugars.value | default: addon_obj.of_which_sugars.value | default: addon_obj.sugars | default: '8g' %}
                        {% assign a_fib = addon_obj.metafields.custom.fibre.value | default: addon_obj.metafields.custom.fiber.value | default: addon_obj.fibre.value | default: addon_obj.fiber | default: '5g' %}
                        {% assign a_salt = addon_obj.metafields.custom.salt.value | default: addon_obj.salt.value | default: addon_obj.salt | default: '0.2g' %}
                        {% assign a_serv = addon_obj.metafields.custom.serving_size.value | default: addon_obj.serving_size.value | default: 'Per Serving' %}
                        {% assign a_kj = addon_obj.metafields.custom.energy.value | default: addon_obj.energy.value | default: '1340 kJ' %}
                        {% assign a_ingr = addon_obj.metafields.custom.ingredients.value | default: addon_obj.ingredients.value | default: addon_raw.ingredients | default: 'Premium wholesome natural ingredients.' %}
                        {% assign a_aller = addon_obj.metafields.custom.allergens.value | default: addon_obj.allergens.value | default: addon_raw.allergens | default: 'None' %}

                        {% if addon_raw.fields %}
                          {% for field in addon_raw.fields %}
                            {% if field.key == 'calories' and field.value != blank %}{% assign a_cals = field.value %}{% endif %}
                            {% if field.key == 'protein' and field.value != blank %}{% assign a_prot = field.value %}{% endif %}
                            {% if field.key == 'energy' and field.value != blank %}{% assign a_kj = field.value %}{% endif %}
                            {% if field.key == 'fat' and field.value != blank %}{% assign a_fat = field.value %}{% endif %}
                            {% if field.key == 'of_which_saturates' or field.key == 'saturates' and field.value != blank %}{% assign a_sat = field.value %}{% endif %}
                            {% if field.key == 'carbohydrates' or field.key == 'carbs' and field.value != blank %}{% assign a_carbs = field.value %}{% endif %}
                            {% if field.key == 'of_which_sugars' or field.key == 'sugars' and field.value != blank %}{% assign a_sug = field.value %}{% endif %}
                            {% if field.key == 'fibre' or field.key == 'fiber' and field.value != blank %}{% assign a_fib = field.value %}{% endif %}
                            {% if field.key == 'salt' and field.value != blank %}{% assign a_salt = field.value %}{% endif %}
                            {% if field.key == 'serving_size' and field.value != blank %}{% assign a_serv = field.value %}{% endif %}
                            {% if field.key == 'allergens' and field.value != blank %}{% assign a_aller = field.value %}{% endif %}
                            {% if field.key == 'ingredients' and field.value != blank %}{% assign a_ingr = field.value %}{% endif %}
                            {% if field.key == 'description' and field.value != blank %}{% assign a_desc = field.value %}{% endif %}
                          {% endfor %}
                        {% endif %}`;

if (normContent.includes(normalize(oldPriceAndNutrients))) {
  normContent = normContent.replace(normalize(oldPriceAndNutrients), normalize(newPriceAndNutrients));
  console.log('✓ Updated Price (pence/pounds) and nutrients extraction');
} else {
  console.warn('⚠️ Could not find oldPriceAndNutrients target');
}

// 4. Update JS price normalization
const oldJsPrice = `      const rawPrice = card.getAttribute('data-price') || '3.50';
      const cleanPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 3.50;`;

const newJsPrice = `      const rawPrice = card.getAttribute('data-price') || '3.50';
      let cleanPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 3.50;
      if (cleanPrice >= 100 && !rawPrice.includes('.')) {
        cleanPrice = cleanPrice / 100;
      }`;

if (normContent.includes(normalize(oldJsPrice))) {
  normContent = normContent.replace(normalize(oldJsPrice), normalize(newJsPrice));
  console.log('✓ Updated JS price parsing with pence safety');
} else {
  console.warn('⚠️ Could not find oldJsPrice target');
}

fs.writeFileSync(liquidPath, denormalize(normContent, isCrlf), 'utf8');
console.log('🎉 choose-meals.liquid successfully updated!');
