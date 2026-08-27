const axios = require('axios');

/**
 * Shopify Admin GraphQL API Client
 */
class ShopifyClient {
  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || 'iknacn-wq.myshopify.com';
    this.accessToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || '';
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-07';
  }

  get endpoint() {
    const cleanDomain = this.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${cleanDomain}/admin/api/${this.apiVersion}/graphql.json`;
  }

  /**
   * Execute GraphQL Query/Mutation against Shopify Admin API
   */
  async graphql(query, variables = {}) {
    const cleanDomain = this.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || this.accessToken;

    if (!token) {
      console.warn('⚠️ [ShopifyClient] SHOPIFY_ADMIN_API_ACCESS_TOKEN is not set in environment variables.');
      throw new Error('MISSING_ACCESS_TOKEN: SHOPIFY_ADMIN_API_ACCESS_TOKEN is not configured.');
    }

    try {
      console.log(`📡 [GraphQL Request] Sending query to ${cleanDomain}...`);
      const response = await axios.post(
        `https://${cleanDomain}/admin/api/${this.apiVersion}/graphql.json`,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
          },
          timeout: 12000
        }
      );

      if (response.data.errors && response.data.errors.length > 0) {
        console.error('❌ GraphQL API Errors:', JSON.stringify(response.data.errors, null, 2));
        throw new Error(response.data.errors.map(e => e.message).join(' | '));
      }

      return response.data.data;
    } catch (error) {
      if (error.response) {
        console.error(`❌ Shopify API HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error('❌ Shopify Request Error:', error.message);
      }
      throw error;
    }
  }
}

module.exports = new ShopifyClient();
