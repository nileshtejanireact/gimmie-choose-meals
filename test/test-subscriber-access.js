require('dotenv').config();
const shopifyClient = require('../config/shopify');

async function testMetaobjects() {
  const typesToTry = ['weekly_menu', 'weekly_menus', 'menu', 'weeklymenu', 'meals', 'weekly_meal', 'delivery_schedule'];
  
  for (const t of typesToTry) {
    console.log(`\n🔍 Checking metaobject type: "${t}"...`);
    const q = `
      query getMetaobjects($type: String!) {
        metaobjects(type: $type, first: 10) {
          edges {
            node {
              id
              handle
              type
              updatedAt
              fields {
                key
                value
                jsonValue
              }
            }
          }
        }
      }
    `;
    try {
      const data = await shopifyClient.graphql(q, { type: t });
      const items = data?.metaobjects?.edges?.map(e => e.node) || [];
      console.log(`Found ${items.length} items for "${t}":`);
      if (items.length > 0) {
        console.log(JSON.stringify(items, null, 2));
      }
    } catch (e) {
      console.log(`Error on "${t}":`, e.message);
    }
  }
}

testMetaobjects();
