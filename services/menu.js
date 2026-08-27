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

      if (products.length === 0) {
        return this.getFallbackMenu();
      }

      return products.map(p => this.formatProduct(p));
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
}

module.exports = new MenuService();
