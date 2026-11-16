const shopifyClient = require('../config/shopify');

/**
 * Service to fetch and format weekly menu items from Shopify
 */
class MenuService {
  /**
   * Fetch available meals for the upcoming delivery rotation
   */
  async getWeeklyMenu() {
    const collectionHandle = process.env.MENU_COLLECTION_HANDLE || 'meals';
    const tagFilter = process.env.MENU_TAG_FILTER || '';

    const query = `
      query getMenuProducts($query: String!) {
        products(first: 50, query: $query) {
          edges {
            node {
              id
              title
              handle
              descriptionHtml
              description
              tags
              featuredImage {
                url
                altText
              }
              variants(first: 5) {
                edges {
                  node {
                    id
                    title
                    price
                    availableForSale
                  }
                }
              }
              metafields(first: 20) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Construct search query
    let searchQuery = 'status:ACTIVE';
    if (tagFilter) {
      searchQuery += ` AND tag:${tagFilter}`;
    }

    try {
      const data = await shopifyClient.graphql(query, { query: searchQuery });
      const products = data?.products?.edges?.map(e => e.node) || [];

      // Filter out non-meal items (test snowboards, box container)
      const mealProducts = products.filter(p => {
        const title = (p.title || '').toLowerCase();
        const type = (p.productType || '').toLowerCase();
        return !title.includes('snowboard') && 
               !title.includes('weekly meal box') && 
               !title.includes('box') &&
               (type === 'meal' || p.tags?.includes('meal') || p.tags?.includes('dish'));
      });

      if (mealProducts.length >= 3) {
        return mealProducts.map(p => this.formatProduct(p));
      }

      return this.getFallbackMenu();
    } catch (error) {
      console.warn('⚠️ Could not fetch live menu from Shopify API, using default Gimmie menu:', error.message);
      return this.getFallbackMenu();
    }
  }

  /**
   * Format Shopify product into clean meal item
   */
  formatProduct(product) {
    const defaultVariant = product.variants?.edges?.[0]?.node;
    const metafields = (product.metafields?.edges || []).reduce((acc, edge) => {
      acc[`${edge.node.namespace}.${edge.node.key}`] = edge.node.value;
      acc[edge.node.key] = edge.node.value;
      return acc;
    }, {});

    // Badges from tags
    const badges = (product.tags || [])
      .filter(tag => ['High Protein', 'Gluten Free', 'Dairy Free', 'Low Carb', 'Keto', 'Vegan', 'Halal', 'Chef Special'].includes(tag))
      .slice(0, 3);

    if (badges.length === 0 && (product.tags || []).length > 0) {
      badges.push(product.tags[0]);
    }

    // Extract macros from metafields or description
    const calories = metafields['calories'] || metafields['custom.calories'] || this.extractRegex(product.description, /(\d+)\s*kcal/i, '520 kcal');
    const protein = metafields['protein'] || metafields['custom.protein'] || this.extractRegex(product.description, /(\d+g?)\s*protein/i, '42g');
    const carbs = metafields['carbs'] || metafields['custom.carbs'] || this.extractRegex(product.description, /(\d+g?)\s*carbs/i, '38g');
    const fat = metafields['fat'] || metafields['custom.fat'] || this.extractRegex(product.description, /(\d+g?)\s*fat/i, '14g');

    const allergens = metafields['allergens'] || metafields['custom.allergens'] || 'None';
    const ingredients = metafields['ingredients'] || metafields['custom.ingredients'] || product.description;

    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      variantId: defaultVariant?.id,
      image: product.featuredImage?.url || 'https://via.placeholder.com/600x450?text=Gimmie+Meal',
      description: product.description || 'Delicious, chef-prepared meal balanced for peak performance.',
      badges: badges.length > 0 ? badges : ['CHEF PICK'],
      macros: {
        calories: calories.includes('kcal') ? calories : `${calories} kcal`,
        protein: protein.endsWith('g') ? protein : `${protein}g Protein`,
        carbs: carbs.endsWith('g') ? carbs : `${carbs}g Carbs`,
        fat: fat.endsWith('g') ? fat : `${fat}g Fat`
      },
      nutrition: {
        serving: 'Per Serving (450g)',
        energyKj: metafields['energy_kj'] || '2180 kJ',
        energyKcal: calories,
        fat: fat,
        saturates: metafields['saturates'] || '3.5g',
        carbs: carbs,
        sugars: metafields['sugars'] || '4.2g',
        fibre: metafields['fibre'] || '6.8g',
        protein: protein,
        salt: metafields['salt'] || '1.1g'
      },
      allergens: allergens,
      ingredients: ingredients
    };
  }

  extractRegex(text, regex, defaultValue) {
    if (!text) return defaultValue;
    const match = text.match(regex);
    return match ? match[1] : defaultValue;
  }

  /**
   * Default high quality Gimmie fallback meals for development/preview
   */
  getFallbackMenu() {
    return [
      {
        id: 'gid://shopify/Product/live_thai_red_curry',
        variantId: 'gid://shopify/ProductVariant/live_var_thai_red_curry',
        title: 'THAI RED CHICKEN CURRY',
        handle: 'thai-red-chicken-curry',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        description: 'Aromatic Thai red coconut chicken curry with fresh red peppers and mangetout. Served alongside fluffy jasmine rice.',
        badges: ['HIGH PROTEIN', 'GLUTEN FREE'],
        macros: {
          calories: '598 kcal',
          protein: '60.0g Protein',
          carbs: '53.3g Carbs',
          fat: '17.8g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2502 kJ',
          energyKcal: '598 kcal',
          fat: '17.8g',
          saturates: '11.7g',
          carbs: '53.3g',
          sugars: '8.7g',
          fibre: '3.3g',
          protein: '60.0g',
          salt: '1.67g'
        },
        allergens: 'Crustaceans',
        ingredients: 'Chicken Breast, Jasmine Rice, Reduced Fat Coconut Milk, Mangetout, Red Pepper, Onion, Red Curry Paste (Dried Red Chilli, Garlic, Shrimp Paste (Crustaceans), Galangal, Lemongrass, Shallot, Lime), Olive Oil, Fresh Coriander, Salt, Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/live_sausage_ragu',
        variantId: 'gid://shopify/ProductVariant/live_var_sausage_ragu',
        title: 'SAUSAGE RAGU RIGATONI',
        handle: 'sausage-ragu-rigatoni',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        description: 'Slow-cooked sausage ragu in a rich tomato sauce, infused with rosemary and thyme. Served with rigatoni, fresh basil and a dusting of parmesan.',
        badges: ['HIGH PROTEIN', 'CHEF PICK'],
        macros: {
          calories: '609 kcal',
          protein: '28.0g Protein',
          carbs: '60.9g Carbs',
          fat: '27.3g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2548 kJ',
          energyKcal: '609 kcal',
          fat: '27.3g',
          saturates: '9.1g',
          carbs: '60.9g',
          sugars: '10.2g',
          fibre: '5.0g',
          protein: '28.0g',
          salt: '2.01g'
        },
        allergens: 'Wheat, Milk, Celery, Sulphites',
        ingredients: 'Rigatoni Pasta (Wheat), Lincolnshire Sausage (Sulphites), Chopped Tomatoes, Tomato Purée, Beef Stock (Celery), Onions, Garlic, Extra Virgin Olive Oil, Fresh Rosemary, Fresh Thyme, Fresh Basil, Parmesan Cheese (Milk), Sea Salt, Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/live_tarragon_chicken',
        variantId: 'gid://shopify/ProductVariant/live_var_tarragon_chicken',
        title: 'TARRAGON CHICKEN',
        handle: 'tarragon-chicken',
        image: 'https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=800&q=80',
        description: 'Oven-roasted tarragon chicken breast with crispy Hasselback baby potatoes and tender asparagus, served in a creamy garlic mushroom sauce.',
        badges: ['HIGH PROTEIN', 'LOW CARB'],
        macros: {
          calories: '414 kcal',
          protein: '56.0g Protein',
          carbs: '31.3g Carbs',
          fat: '8.0g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '1732 kJ',
          energyKcal: '414 kcal',
          fat: '8.0g',
          saturates: '1.7g',
          carbs: '31.3g',
          sugars: '4.9g',
          fibre: '4.8g',
          protein: '56.0g',
          salt: '0.81g'
        },
        allergens: 'Milk, Mustard, Sulphites',
        ingredients: 'Chicken Breast, Baby Potato, White Mushroom, Asparagus, Shallot, Light Creme Fraiche (Milk), Wholegrain Mustard (Mustard), White Wine Reduction (Sulphites), Fresh Tarragon, Garlic, Olive Oil, Sea Salt, Cracked Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/live_hoisin_beef_bowl',
        variantId: 'gid://shopify/ProductVariant/live_var_hoisin_beef',
        title: 'HOISIN BEEF BOWL',
        handle: 'hoisin-beef-bowl',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        description: 'Sticky beef in a hoisin-soy glaze over fluffy basmati rice with a side of fresh cucumber ribbons. Finished with red chillies, spring onion and sesame seeds.',
        badges: ['HIGH PROTEIN', 'CHEF PICK'],
        macros: {
          calories: '416 kcal',
          protein: '42.0g Protein',
          carbs: '42.8g Carbs',
          fat: '10.4g Fat'
        },
        nutrition: {
          serving: 'Per Serving (430g)',
          energyKj: '1740 kJ',
          energyKcal: '416 kcal',
          fat: '10.4g',
          saturates: '3.8g',
          carbs: '42.8g',
          sugars: '6.9g',
          fibre: '1.5g',
          protein: '42.0g',
          salt: '3.23g'
        },
        allergens: 'Soya, Sesame, Wheat',
        ingredients: 'Lean Beef Mince (5% fat), Basmati Rice, Cucumber, Spring Onion, Red Chilli Pepper, Hoisin Sauce (Soya, Sesame, Wheat), Tamari Soy Sauce (Soya), Sesame Seeds, Garlic, Ginger, Pure Honey, Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/live_bolognese_gnocchi',
        variantId: 'gid://shopify/ProductVariant/live_var_bolognese_gnocchi',
        title: 'BOLOGNESE GNOCCHI',
        handle: 'bolognese-gnocchi',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        description: 'Fluffy potato gnocchi tossed in a rich, slow-simmered beef Bolognese sauce, topped with parmesan and fresh parsley.',
        badges: ['HIGH PROTEIN', 'COMFORT FOOD'],
        macros: {
          calories: '389 kcal',
          protein: '36.0g Protein',
          carbs: '36.5g Carbs',
          fat: '10.2g Fat'
        },
        nutrition: {
          serving: 'Per Serving (420g)',
          energyKj: '1627 kJ',
          energyKcal: '389 kcal',
          fat: '10.2g',
          saturates: '4.1g',
          carbs: '36.5g',
          sugars: '11.1g',
          fibre: '5.4g',
          protein: '36.0g',
          salt: '2.01g'
        },
        allergens: 'Wheat, Milk, Celery, Fish, Barley',
        ingredients: 'Lean Beef Mince (5% fat), Gnocchi (Fresh Potatoes, Wheat Flour, Salt, Sunflower Oil), Chopped Tomatoes, Onion, Parmesan Cheese (Milk), Beef Stock (Celery), Tomato Purée, Worcestershire Sauce (Fish, Barley), Garlic, Olive Oil, Fresh Parsley, Oregano, Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/live_chicken_fajita_bowl',
        variantId: 'gid://shopify/ProductVariant/live_var_chicken_fajita',
        title: 'CHICKEN FAJITA BOWL',
        handle: 'chicken-fajita-bowl',
        image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
        description: 'Juicy chicken breast, mixed peppers and onions tossed in smoky Mexican spices. Served over zesty coriander and lime rice and a side of slow-simmered black beans.',
        badges: ['HIGH PROTEIN', 'MEXICAN SPICE'],
        macros: {
          calories: '417 kcal',
          protein: '46.0g Protein',
          carbs: '45.5g Carbs',
          fat: '6.6g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '1744 kJ',
          energyKcal: '417 kcal',
          fat: '6.6g',
          saturates: '1.4g',
          carbs: '45.5g',
          sugars: '7.4g',
          fibre: '4.6g',
          protein: '46.0g',
          salt: '0.33g'
        },
        allergens: 'None',
        ingredients: 'Chicken Breast, Basmati Rice, Pepper, Onion, Black Beans, Chopped Tomatoes, Lime, Olive Oil, Fresh Coriander, Sea Salt, Fajita Seasoning.'
      },

      {
        id: 'gid://shopify/Product/101',
        variantId: 'gid://shopify/ProductVariant/201',
        title: 'LEMON & HERB CHICKEN',
        handle: 'lemon-herb-chicken',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        description: 'Tender grilled British chicken breast marinated in fresh lemon and thyme, served with roasted sweet potato wedges and steamed tenderstem broccoli.',
        badges: ['HIGH PROTEIN', 'GLUTEN FREE'],
        macros: {
          calories: '520 kcal',
          protein: '48g Protein',
          carbs: '38g Carbs',
          fat: '12g Fat'
        },
        nutrition: {
          serving: 'Per Serving (420g)',
          energyKj: '2175 kJ',
          energyKcal: '520 kcal',
          fat: '12g',
          saturates: '2.4g',
          carbs: '38g',
          sugars: '5.1g',
          fibre: '6.2g',
          protein: '48g',
          salt: '1.2g'
        },
        allergens: 'None',
        ingredients: 'British Chicken Breast (45%), Sweet Potato (30%), Tenderstem Broccoli (20%), Olive Oil, Fresh Lemon Juice, Thyme, Sea Salt, Cracked Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/102',
        variantId: 'gid://shopify/ProductVariant/202',
        title: 'GRASS-FED BEEF BOLOGNESE',
        handle: 'grass-fed-beef-bolognese',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        description: 'Slow-simmered prime lean minced beef in a rich San Marzano tomato and basil ragu, served with gluten-free pea-protein penne pasta.',
        badges: ['HIGH PROTEIN', 'RICH IRON'],
        macros: {
          calories: '580 kcal',
          protein: '44g Protein',
          carbs: '52g Carbs',
          fat: '15g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2430 kJ',
          energyKcal: '580 kcal',
          fat: '15g',
          saturates: '4.8g',
          carbs: '52g',
          sugars: '6.4g',
          fibre: '8.1g',
          protein: '44g',
          salt: '1.4g'
        },
        allergens: 'Celery',
        ingredients: 'Minced Beef (40%), San Marzano Tomatoes, Gluten-Free Penne (Pea & Rice Flour), Red Onion, Carrots, Celery, Garlic, Extra Virgin Olive Oil, Fresh Basil.'
      },
      {
        id: 'gid://shopify/Product/103',
        variantId: 'gid://shopify/ProductVariant/203',
        title: 'TERIYAKI SALMON & JASMINE RICE',
        handle: 'teriyaki-salmon-jasmine-rice',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80',
        description: 'Pan-seared Atlantic salmon fillet glazed with tamari-teriyaki sauce, served on fragrant jasmine rice with sesame-tossed edamame and mangetout.',
        badges: ['OMEGA-3', 'DAIRY FREE'],
        macros: {
          calories: '610 kcal',
          protein: '42g Protein',
          carbs: '46g Carbs',
          fat: '22g Fat'
        },
        nutrition: {
          serving: 'Per Serving (430g)',
          energyKj: '2550 kJ',
          energyKcal: '610 kcal',
          fat: '22g',
          saturates: '3.9g',
          carbs: '46g',
          sugars: '7.2g',
          fibre: '5.0g',
          protein: '42g',
          salt: '1.5g'
        },
        allergens: 'Fish, Soya, Sesame',
        ingredients: 'Atlantic Salmon Fillet (Fish) (40%), Steamed Jasmine Rice (35%), Edamame Beans (Soya), Mangetout, Tamari Soy Sauce (Soya), Mirin, Ginger, Toasted Sesame Seeds.'
      },
      {
        id: 'gid://shopify/Product/104',
        variantId: 'gid://shopify/ProductVariant/204',
        title: 'CHIPOTLE CHICKEN BURRITO BOWL',
        handle: 'chipotle-chicken-burrito-bowl',
        image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
        description: 'Smoky chipotle marinated chicken thigh with black beans, sweet corn salsa, brown rice, and a zesty lime coriander dressing.',
        badges: ['HIGH PROTEIN', 'HIGH FIBRE'],
        macros: {
          calories: '540 kcal',
          protein: '45g Protein',
          carbs: '48g Carbs',
          fat: '14g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2260 kJ',
          energyKcal: '540 kcal',
          fat: '14g',
          saturates: '3.1g',
          carbs: '48g',
          sugars: '4.8g',
          fibre: '9.5g',
          protein: '45g',
          salt: '1.3g'
        },
        allergens: 'None',
        ingredients: 'Chicken Thigh (38%), Wholegrain Brown Rice (30%), Black Beans (15%), Sweetcorn, Red Peppers, Chipotle Paste, Fresh Coriander, Lime Juice.'
      },
      {
        id: 'gid://shopify/Product/105',
        variantId: 'gid://shopify/ProductVariant/205',
        title: 'CREAMY TUSCAN GARLIC CHICKEN',
        handle: 'creamy-tuscan-garlic-chicken',
        image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
        description: 'Sliced succulent chicken breast in a creamy sun-dried tomato, spinach, and garlic sauce, served alongside crushed baby new potatoes.',
        badges: ['HIGH PROTEIN', 'LOW CARB'],
        macros: {
          calories: '560 kcal',
          protein: '46g Protein',
          carbs: '28g Carbs',
          fat: '18g Fat'
        },
        nutrition: {
          serving: 'Per Serving (440g)',
          energyKj: '2345 kJ',
          energyKcal: '560 kcal',
          fat: '18g',
          saturates: '5.2g',
          carbs: '28g',
          sugars: '3.9g',
          fibre: '4.8g',
          protein: '46g',
          salt: '1.2g'
        },
        allergens: 'Milk',
        ingredients: 'Chicken Breast (42%), Baby Potatoes (30%), Spinach, Sun-Dried Tomatoes, Double Cream (Milk), Garlic, Parmesan (Milk), Oregano, Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/106',
        variantId: 'gid://shopify/ProductVariant/206',
        title: 'PLANT-BASED SWEET POTATO & CHICKPEA CURRY',
        handle: 'sweet-potato-chickpea-curry',
        image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        description: 'Roasted sweet potato cubes and chickpeas gently simmered in a fragrant coconut, spinach, and turmeric curry with spiced basmati rice.',
        badges: ['100% VEGAN', 'DAIRY FREE'],
        macros: {
          calories: '490 kcal',
          protein: '22g Protein',
          carbs: '64g Carbs',
          fat: '12g Fat'
        },
        nutrition: {
          serving: 'Per Serving (460g)',
          energyKj: '2050 kJ',
          energyKcal: '490 kcal',
          fat: '12g',
          saturates: '4.5g',
          carbs: '64g',
          sugars: '8.2g',
          fibre: '11.0g',
          protein: '22g',
          salt: '0.9g'
        },
        allergens: 'None',
        ingredients: 'Chickpeas (30%), Sweet Potato (25%), Coconut Milk, Spiced Basmati Rice (25%), Baby Spinach, Turmeric, Cumin, Ginger, Fresh Coriander.'
      }
    ];
  }

  /**
   * Fetch available add-ons for the upcoming delivery rotation
   */
  async getAddons() {
    return this.getFallbackAddons();
  }

  /**
   * Default high quality Gimmie fallback add-on products
   */
  getFallbackAddons() {
    return [
      {
        id: 'gid://shopify/Product/addon_blueberry_lemon_oats',
        variantId: 'gid://shopify/ProductVariant/addon_var_blueberry_oats',
        title: 'BLUEBERRY & LEMON PROTEIN OATS',
        handle: 'blueberry-lemon-protein-oats',
        price: '4.95',
        image: 'https://images.unsplash.com/photo-1584985314300-8806c9e0d16a?auto=format&fit=crop&w=800&q=80',
        description: 'Creamy overnight oats blended with premium whey protein, Greek yoghurt and chia seeds. Loaded with blueberries and lemon zest.',
        badges: ['ADD-ON', 'PROTEIN BREAKFAST'],
        macros: {
          calories: '426 kcal',
          protein: '32g Protein',
          carbs: '40.7g Carbs',
          fat: '10.6g Fat'
        },
        nutrition: {
          serving: 'Per Pot (300g)',
          energyKj: '1782 kJ',
          energyKcal: '426 kcal',
          fat: '10.6g',
          saturates: '2.8g',
          carbs: '40.7g',
          sugars: '20.7g',
          fibre: '5.5g',
          protein: '32g',
          salt: '0.30g'
        },
        allergens: 'Oats, Milk, Soya',
        ingredients: 'Porridge <strong>Oats</strong>, Whey Protein (<strong>Milk, Soya</strong>), 0% Fat Greek Yoghurt (<strong>Milk</strong>), Semi Skimmed <strong>Milk</strong>, Chia Seeds, Blueberries, Lemon Zest.<br><br>May contain: <strong>Peanuts, Nuts, Sesame</strong>.'
      },
      {
        id: 'gid://shopify/Product/addon_biscoff_biscuit_oats',
        variantId: 'gid://shopify/ProductVariant/addon_var_biscoff_oats',
        title: 'BISCOFF BISCUIT PROTEIN OATS',
        handle: 'biscoff-protein-oats',
        price: '4.95',
        image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=800&q=80',
        description: 'Creamy overnight oats blended with premium whey protein, Greek yoghurt and chia seeds. Topped with a drizzle of Biscoff spread and biscuit crumb.',
        badges: ['ADD-ON', 'HIGH PROTEIN'],
        macros: {
          calories: '493 kcal',
          protein: '39g Protein',
          carbs: '46.4g Carbs',
          fat: '15.3g Fat'
        },
        nutrition: {
          serving: 'Per Pot (300g)',
          energyKj: '2062 kJ',
          energyKcal: '493 kcal',
          fat: '15.3g',
          saturates: '4.2g',
          carbs: '46.4g',
          sugars: '20.7g',
          fibre: '8.8g',
          protein: '39.0g',
          salt: '0.76g'
        },
        allergens: 'Oats, Milk, Soya, Wheat',
        ingredients: 'Porridge Oats, Whey Protein (Milk, Soya), 0% Fat Greek Yoghurt (Milk), Semi Skimmed Milk, Chia Seeds, Lotus Biscoff Biscuit & Spread [Wheat Flour, Sugar, Vegetable Oils (Palm Oil, Rapeseed Oil), Soya Flour, Emulsifier (Soya Lecithin), Salt, Cinnamon], Chia Seeds.'
      },
      {
        id: 'gid://shopify/Product/addon_raspberry_white_choc_oats',
        variantId: 'gid://shopify/ProductVariant/addon_var_raspberry_oats',
        title: 'RASPBERRY & WHITE CHOC PROTEIN OATS',
        handle: 'raspberry-white-choc-protein-oats',
        price: '4.95',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        description: 'Creamy protein overnight oats folded with juicy tart raspberries, vanilla whey protein, and delicate Belgian white chocolate curls.',
        badges: ['ADD-ON', 'SWEET & HEALTHY'],
        macros: {
          calories: '410 kcal',
          protein: '32g Protein',
          carbs: '52g Carbs',
          fat: '8.8g Fat'
        },
        nutrition: {
          serving: 'Per Pot (300g)',
          energyKj: '1725 kJ',
          energyKcal: '410 kcal',
          fat: '8.8g',
          saturates: '3.0g',
          carbs: '52.0g',
          sugars: '13.0g',
          fibre: '6.2g',
          protein: '32g',
          salt: '0.28g'
        },
        allergens: 'Milk, Gluten (Oats), Soya',
        ingredients: 'Rolled Oats (Gluten) (40%), Skimmed Milk (24%), Greek Style Yoghurt (Milk) (14%), Whey Protein Concentrate (Milk, Soy Lecithin) (10%), Fresh Raspberries (7%), White Chocolate Curls (Milk, Soya, Sugar, Cocoa Butter, Whole Milk Powder) (3%), Chia Seeds (2%).'
      },
      {
        id: 'gid://shopify/Product/addon_sweet_potato_cottage_pie',
        variantId: 'gid://shopify/ProductVariant/addon_var_cottage_pie',
        title: 'SWEET POTATO COTTAGE PIE',
        handle: 'sweet-potato-cottage-pie',
        price: '4.95',
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        description: 'Slow-simmered lean British minced beef and sweet garden carrots in a rich, herbed red wine and beef gravy, topped with velvety sweet potato mash.',
        badges: ['ADD-ON', 'HIGH PROTEIN'],
        macros: {
          calories: '567 kcal',
          protein: '46g Protein',
          carbs: '54g Carbs',
          fat: '14.5g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2372 kJ',
          energyKcal: '567 kcal',
          fat: '14.5g',
          saturates: '4.8g',
          carbs: '54.0g',
          sugars: '9.2g',
          fibre: '6.0g',
          protein: '46g',
          salt: '1.20g'
        },
        allergens: 'Milk, Celery, Fish, Barley',
        ingredients: 'British Minced Beef (38%), Sweet Potato Mash (35%) (Sweet Potato, Unsalted Butter (Milk), Salt, White Pepper), Diced Carrots (12%), Chopped Tomatoes, Beef Stock (Celery), Onions, Tomato Purée, Worcestershire Sauce (Fish, Barley), Garlic, Fresh Thyme, Sea Salt, Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/addon_cajun_chicken_penne',
        variantId: 'gid://shopify/ProductVariant/addon_var_cajun',
        title: 'CAJUN CHICKEN PENNE',
        handle: 'cajun-chicken-penne',
        price: '8.00',
        image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281745?auto=format&fit=crop&w=800&q=80',
        description: 'Spicy Cajun chicken and chorizo penne, tossed in a creamy sauce with mushrooms and garden peas. Finished with fresh parsley and parmesan.',
        badges: ['ADD-ON', 'POPULAR'],
        macros: {
          calories: '567 kcal',
          protein: '46g Protein',
          carbs: '54g Carbs',
          fat: '18g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2370 kJ',
          energyKcal: '567 kcal',
          fat: '18.0g',
          saturates: '5.2g',
          carbs: '54.0g',
          sugars: '4.8g',
          fibre: '6.5g',
          protein: '46g',
          salt: '1.25g'
        },
        allergens: 'Wheat, Milk, Celery, Mustard',
        ingredients: 'Chicken Breast (35%), Penne Pasta (Durum Wheat Semolina), Double Cream (Milk), Chorizo (Pork, Paprika, Salt, Garlic), Mushrooms, Peas, Parmesan (Milk), Cajun Seasoning, Celery Salt, Mustard Seed.'
      },
      {
        id: 'gid://shopify/Product/addon_ginger_basil_beef',
        variantId: 'gid://shopify/ProductVariant/addon_var_ginger_beef',
        title: 'GINGER & BASIL BEEF',
        handle: 'ginger-basil-beef',
        price: '8.00',
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        description: 'Tender sliced British beef tossed with fragrant Thai basil, ginger, mangetout, and sweet peppers in a savoury tamari garlic glaze, served with fragrant jasmine rice.',
        badges: ['ADD-ON', 'HIGH PROTEIN'],
        macros: {
          calories: '520 kcal',
          protein: '42g Protein',
          carbs: '48g Carbs',
          fat: '14g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2180 kJ',
          energyKcal: '520 kcal',
          fat: '14.0g',
          saturates: '3.6g',
          carbs: '48.0g',
          sugars: '5.2g',
          fibre: '5.8g',
          protein: '42g',
          salt: '1.10g'
        },
        allergens: 'Soya, Sesame, Wheat',
        ingredients: 'British Grass-Fed Beef (38%), Steamed Jasmine Rice (32%), Thai Holy Basil, Ginger Root, Mangetout, Red Peppers, Tamari Soy Sauce (Soya), Toasted Sesame Oil, Garlic.'
      },
      {
        id: 'gid://shopify/Product/addon_korean_beef_noodles',
        variantId: 'gid://shopify/ProductVariant/addon_var_korean_noodles',
        title: 'KOREAN BEEF NOODLES',
        handle: 'korean-beef-noodles',
        price: '8.00',
        image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
        description: 'A sweet and spicy balance of beef, wok-fired egg noodles and crunchy beansprouts. Tossed in a sticky gochujang glaze with vibrant peppers, fresh spring onions and sesame seeds.',
        badges: ['ADD-ON', 'CHEF PICK'],
        macros: {
          calories: '540 kcal',
          protein: '44g Protein',
          carbs: '52g Carbs',
          fat: '15g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2260 kJ',
          energyKcal: '540 kcal',
          fat: '15.0g',
          saturates: '3.9g',
          carbs: '52.0g',
          sugars: '7.5g',
          fibre: '4.8g',
          protein: '44g',
          salt: '1.40g'
        },
        allergens: 'Egg, Wheat, Soya, Sesame',
        ingredients: 'Egg Noodles (Wheat, Egg), British Minced Beef (35%), Gochujang Chili Paste, Soya Sauce, Beansprouts, Red Bell Peppers, Spring Onions, Sesame Seeds.'
      },
      {
        id: 'gid://shopify/Product/addon_creamy_tuscan_chicken',
        variantId: 'gid://shopify/ProductVariant/addon_var_tuscan_chicken',
        title: 'CREAMY TUSCAN GARLIC CHICKEN',
        handle: 'creamy-tuscan-garlic-chicken-addon',
        price: '8.00',
        image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
        description: 'Succulent sliced chicken breast in a creamy sun-dried tomato, spinach, and garlic sauce, served alongside crushed baby new potatoes.',
        badges: ['ADD-ON', 'LOW CARB'],
        macros: {
          calories: '560 kcal',
          protein: '46g Protein',
          carbs: '28g Carbs',
          fat: '18g Fat'
        },
        nutrition: {
          serving: 'Per Serving (440g)',
          energyKj: '2345 kJ',
          energyKcal: '560 kcal',
          fat: '18.0g',
          saturates: '5.2g',
          carbs: '28.0g',
          sugars: '3.9g',
          fibre: '4.8g',
          protein: '46g',
          salt: '1.20g'
        },
        allergens: 'Milk',
        ingredients: 'Chicken Breast (42%), Baby Potatoes (30%), Spinach, Sun-Dried Tomatoes, Double Cream (Milk), Garlic, Parmesan (Milk), Oregano, Black Pepper.'
      },
      {
        id: 'gid://shopify/Product/addon_lemon_herb_chicken',
        variantId: 'gid://shopify/ProductVariant/addon_var_lemon_chicken',
        title: 'LEMON & HERB CHICKEN',
        handle: 'lemon-herb-chicken-addon',
        price: '8.00',
        image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
        description: 'Tender marinated chargrilled chicken breast in lemon zest and Mediterranean garden herbs, served with roasted garlic baby potatoes and steamed green beans.',
        badges: ['ADD-ON', 'LEAN & CLEAN'],
        macros: {
          calories: '510 kcal',
          protein: '48g Protein',
          carbs: '34g Carbs',
          fat: '12g Fat'
        },
        nutrition: {
          serving: 'Per Serving (450g)',
          energyKj: '2130 kJ',
          energyKcal: '510 kcal',
          fat: '12.0g',
          saturates: '2.5g',
          carbs: '34.0g',
          sugars: '3.1g',
          fibre: '6.2g',
          protein: '48g',
          salt: '1.15g'
        },
        allergens: 'None',
        ingredients: 'Chicken Breast (40%), Roasted Baby Potatoes (32%), Fine Green Beans (20%), Lemon Juice & Zest, Olive Oil, Oregano, Thyme, Garlic, Sea Salt.'
      }
    ];
  }}

module.exports = new MenuService();
