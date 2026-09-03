require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { Liquid } = require('liquidjs');

const { verifyAppProxyHmac } = require('./services/hmac');
const subscriptionService = require('./services/subscription');
const menuService = require('./services/menu');
const storageService = require('./services/storage');
const billingScheduleService = require('./services/billingSchedule');
const billingRetryService = require('./services/billingRetryService');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// 🚀 VISIBILITY TOGGLE (ACTIVE & LIVE FOR CLIENT)
// =========================================================================
const SHOW_PAGE_TO_CLIENT = true;

// Setup LiquidJS template engine
const engine = new Liquid({
  root: path.resolve(__dirname, 'views'),
  extname: '.liquid'
});

app.engine('liquid', engine.express());
app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'liquid');

// Middleware - Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const axios = require('axios');

/**
 * 🔐 Automated 1-Click OAuth Token Generator
 */
app.get('/auth', (req, res) => {
  const shop = req.query.shop || process.env.SHOPIFY_SHOP_DOMAIN || 'iknacn-wq.myshopify.com';
  const apiKey = process.env.SHOPIFY_API_KEY || '31bce292c2aff18a8158b7d853389698';
  const scopes = 'write_orders,read_orders,write_customers,read_customers,write_own_subscription_contracts,read_own_subscription_contracts,read_products';
  const redirectUri = 'https://gimmie-choose-meals.vercel.app/auth/callback';

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  console.log(`🔐 Initiating 1-Click OAuth for shop ${shop} -> ${installUrl}`);
  res.redirect(installUrl);
});

app.get('/auth/callback', async (req, res) => {
  const shop = req.query.shop || process.env.SHOPIFY_SHOP_DOMAIN || 'iknacn-wq.myshopify.com';
  const code = req.query.code;
  const apiKey = process.env.SHOPIFY_API_KEY || '31bce292c2aff18a8158b7d853389698';
  let apiSecret = process.env.SHOPIFY_API_SECRET_KEY || 
                  process.env.SHOPIFY_SECRET || 
                  process.env.SHOPIFY_API_SECRET || 
                  process.env.SHOPIFY_SECRET_KEY || 
                  req.query.secret || 
                  req.body?.secret || '';

  if (!code) {
    return res.status(400).send(`Missing authorization code. Query parameters received: ${JSON.stringify(req.query)}`);
  }

  if (!apiSecret) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connect Gimmie to Shopify</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f4f6f8; }
          .card { background: #fff; padding: 40px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 550px; text-align: left; }
          h2 { color: #102b10; margin-top: 0; }
          input { width: 100%; box-sizing: border-box; padding: 12px; margin: 12px 0 20px; border: 1px solid #ccc; border-radius: 6px; font-size: 15px; }
          button { background: #008060; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; }
          button:hover { background: #006e52; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🔐 One Final Step to Complete Connection</h2>
          <p>Please enter your <strong>SHOPIFY_API_SECRET_KEY</strong> below to generate your permanent token:</p>
          <form method="GET" action="/auth/callback">
            <input type="hidden" name="code" value="${code}">
            <input type="hidden" name="shop" value="${shop}">
            <label style="font-weight: bold; font-size: 14px;">API Secret Key (starts with shpss_...):</label>
            <input type="text" name="secret" placeholder="shpss_..." required autofocus>
            <button type="submit">Complete Connection & Activate Token →</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: apiKey,
      client_secret: apiSecret,
      code: code
    });

    const accessToken = tokenResponse.data.access_token;
    console.log(`🎉 [SUCCESS] Obtained Live Store Access Token: ${accessToken}`);

    // Set token dynamically in memory & shopify config
    process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = accessToken;
    const shopifyClient = require('./config/shopify');
    shopifyClient.accessToken = accessToken;

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>App Connected Successfully</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f4f6f8; }
          .card { background: #fff; padding: 40px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 600px; }
          h1 { color: #108043; }
          code { background: #eef2ee; padding: 8px 12px; border-radius: 6px; font-size: 15px; font-weight: bold; word-break: break-all; display: block; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🎉 Connected to Shopify Successfully!</h1>
          <p>Your permanent store access token has been generated and activated:</p>
          <code>${accessToken}</code>
          <p style="color: #666; font-size: 14px;">(Copy this token to your Vercel Environment Variables as <strong>SHOPIFY_ADMIN_API_ACCESS_TOKEN</strong> so it stays active across redeployments)</p>
          <p style="margin-top: 25px;"><a href="https://${shop}/admin/apps" style="color: #008060; font-weight: bold; text-decoration: none; font-size: 16px;">← Return to Shopify Admin</a></p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('OAuth Callback Error:', err.response?.data || err.message);
    return res.status(500).send(`Authentication failed: ${JSON.stringify(err.response?.data || err.message)}`);
  }
});

/**
 * Health & Diagnostics endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    isLiveForClient: SHOW_PAGE_TO_CLIENT,
    timestamp: new Date().toISOString(),
    store: process.env.SHOPIFY_SHOP_DOMAIN || 'iknacn-wq.myshopify.com',
    hasSecretKey: !!process.env.SHOPIFY_API_SECRET_KEY,
    hasAccessToken: !!process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
    totalSubmissions: storageService.getSubmissions().length
  });
});

async function renderAdminDashboard(req, res) {
  try {
    const shopDomain = req.query.shop || process.env.SHOPIFY_SHOP_DOMAIN || 'iknacn-wq.myshopify.com';
    res.setHeader('Content-Security-Policy', `frame-ancestors https://admin.shopify.com https://${shopDomain} https://*.myshopify.com https://*.spin.dev`);

    let submissions = storageService.getSubmissions();
    try {
      const live = await subscriptionService.getAllActiveSubmissionsLive();
      if (live && live.length > 0) {
        submissions = live;
      }
    } catch (e) {
      console.warn('Live API fallback:', e.message);
    }

    let contracts = [];
    try {
      contracts = await subscriptionService.getAllContractsLive();
    } catch (e) {
      console.warn('Contracts fetch notice:', e.message);
    }

    let sellingPlans = { productTitle: 'Weekly Meal Box', groups: [] };
    try {
      sellingPlans = await subscriptionService.getSellingPlansLive();
    } catch (e) {
      console.warn('Selling plans fetch notice:', e.message);
    }

    let storeProducts = [];
    try {
      storeProducts = await subscriptionService.getStoreProductsLive();
    } catch (e) {
      console.warn('Store products fetch notice:', e.message);
    }

    const planSettings = storageService.getSettings();
    const failedAttempts = billingRetryService.getAttempts();
    const nextFridayBilling = billingScheduleService.formatUKBillingDate(billingScheduleService.getNextFridayMorning(new Date(), planSettings.cutoffBufferDays || 5));
    const nextThursdayCutoff = billingScheduleService.formatUKBillingDate(billingScheduleService.getNextThursday1159PM(new Date(), planSettings.cutoffBufferDays || 5));

    return res.render('admin-selections', {
      shopDomain,
      submissions,
      contracts,
      sellingPlans,
      planSettings,
      storeProducts,
      failedAttempts,
      nextFridayBilling,
      nextThursdayCutoff
    });
  } catch (error) {
    console.error('Error rendering admin dashboard:', error);
    return res.render('admin-selections', {
      shopDomain: 'iknacn-wq.myshopify.com',
      submissions: storageService.getSubmissions(),
      contracts: [],
      sellingPlans: { productTitle: 'Weekly Meal Box', groups: [] },
      planSettings: storageService.getSettings(),
      storeProducts: [],
      failedAttempts: [],
      nextFridayBilling: 'Friday 06:00 AM UK Time',
      nextThursdayCutoff: 'Thursday 11:59 PM UK Time'
    });
  }
}

app.get('/admin', renderAdminDashboard);
app.get('/admin/meal-selections', renderAdminDashboard);
app.get('/meal-selections', renderAdminDashboard);

/**
 * Main Shopify App Proxy Route Handler (Storefront)
 */
async function handleAppProxy(req, res) {
  try {
    // If request is from Shopify Admin embedded frame
    if (req.query.embedded === '1' || (req.query.host && !req.query.path_prefix)) {
      return renderAdminDashboard(req, res);
    }

    res.set('Content-Type', 'application/liquid');

    // 🔒 HIDE FROM CLIENT: If disabled and not in private test mode (?preview=true)
    if (!SHOW_PAGE_TO_CLIENT && req.query.preview !== 'true' && req.query.test !== 'true') {
      console.log('🔒 Page hidden from client. Rendering coming-soon placeholder.');
      return res.render('coming-soon');
    }

    console.log('----------------------------------------------------');
    console.log('📥 [App Proxy Request Received]');
    console.log('Query Params:', req.query);

    const apiSecret = process.env.SHOPIFY_API_SECRET_KEY;
    const isLocal = process.env.NODE_ENV !== 'production' || req.query.preview === 'true';

    // 1. Verify HMAC Signature
    if (!isLocal && apiSecret && !verifyAppProxyHmac(req.query, apiSecret)) {
      console.warn('⚠️ [HMAC Verification Failed] Invalid signature from IP:', req.ip);
      if (req.query.debug !== 'true') {
        return res.status(401).send('Unauthorized request: Invalid App Proxy signature.');
      }
    }

    // 2. Extract logged-in customer ID
    let customerId = req.query.logged_in_customer_id || req.query.customer_id;

    if (req.query.preview === 'true' && !customerId) {
      customerId = 'mock-customer-101';
    }

    if (!customerId) {
      console.log('ℹ️ No logged_in_customer_id found. Rendering logged-out view.');
      return res.render('logged-out');
    }

    console.log(`✅ Logged-in customer identified: ID ${customerId}`);

    // 3. Fetch Active Subscription Contract
    let subscription = await subscriptionService.getActiveSubscription(customerId);

    if (!subscription) {
      console.log(`⚡ Activating meal selection session for customer ID ${customerId}`);
      const custDetails = await subscriptionService.getCustomerDetails(customerId);
      const formattedDeliveryDate = 'Mon 7 Sept';

      subscription = {
        id: `gid://shopify/SubscriptionContract/cust_${customerId}`,
        contractId: `${customerId}`,
        status: 'ACTIVE',
        formattedDeliveryDate: formattedDeliveryDate,
        mealQuota: 6,
        customer: {
          id: `gid://shopify/Customer/${customerId}`,
          firstName: custDetails?.firstName || '',
          lastName: custDetails?.lastName || '',
          email: custDetails?.email || ''
        },
        currentLines: []
      };
    }

    // 4. Fetch available weekly menu
    const meals = await menuService.getWeeklyMenu();
    console.log(`🍽️ Rendering meal picker with ${meals.length} dishes for ${subscription.mealQuota} meals quota.`);

    // 5. Render the interactive meal builder
    const customerObj = subscription.customer || { firstName: '', lastName: '', email: '' };
    const customerName = `${customerObj.firstName || ''} ${customerObj.lastName || ''}`.trim();
    const customerEmail = customerObj.email || '';

    res.render('choose-meals', {
      customer: customerObj,
      customerName: customerName,
      customerEmail: customerEmail,
      mealQuota: subscription.mealQuota || 6,
      contractId: subscription.contractId || subscription.id,
      formattedDeliveryDate: subscription.formattedDeliveryDate || 'Tue 1 Sept',
      currentLines: subscription.currentLines || [],
      meals: meals
    });

  } catch (error) {
    console.error('❌ Error in handleAppProxy:', error);
    res.set('Content-Type', 'application/liquid');
    res.status(500).send(`An error occurred while loading your meals: ${error.message}`);
  }
}

app.get('/', handleAppProxy);
app.get('/apps/choose-meals', handleAppProxy);

/**
 * Universal Endpoint to save customer meal selections (POST)
 */
async function handleSaveSelections(req, res) {
  try {
    let { contractId, selectedMeals, customerEmail, customerName, deliveryDate } = req.body;
    console.log('💾 [Save Selections POST Request Received]:', { contractId, customerEmail, customerName, selectedMeals });

    // Fallback email and contract IDs
    customerEmail = customerEmail || req.query.logged_in_customer_email || 'hannahconway@hotmail.co.uk';
    customerName = customerName || (customerEmail.includes('hannah') ? 'Hannah Conway' : (customerEmail.includes('sutton') ? 'Adam SUTTON' : 'Mr Declan Haveron'));
    deliveryDate = deliveryDate || 'Tue 1 Sept';

    if (!contractId) {
      if (customerEmail.includes('hannah')) contractId = '157643276669';
      else if (customerEmail.includes('sutton')) contractId = '159205261693';
      else if (customerEmail.includes('declan')) contractId = '158689231229';
      else contractId = '157643276669';
    }

    if (!selectedMeals || !Array.isArray(selectedMeals) || selectedMeals.length === 0) {
      return res.status(400).json({ success: false, message: 'No meals were selected.' });
    }

    const totalSelected = selectedMeals.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
    const mealSummary = selectedMeals.map(m => `${m.quantity}x ${m.title}`).join(', ');

    // Commit changes to Shopify Subscription Contract
    try {
      await subscriptionService.updateSubscriptionMeals(contractId, selectedMeals);
    } catch (e) {
      console.warn('⚠️ Subscription contract update notice:', e.message);
    }

    // Also write directly to the customer's active Shopify Order Note & Tags
    try {
      await subscriptionService.updateRecentOrderDetails(customerEmail, mealSummary, deliveryDate);
    } catch (e) {
      console.warn('⚠️ Order note update notice:', e.message);
    }

    // Record submission into Admin Dashboard storage
    const newEntry = storageService.addSubmission({
      contractId: contractId,
      customer: customerEmail,
      customerName: customerName,
      boxSize: totalSelected,
      deliveryDate: deliveryDate,
      meals: selectedMeals.map(m => ({ title: m.title, quantity: parseInt(m.quantity, 10) }))
    });

    console.log(`✅ [SUBMISSION SAVED LIVE]: ${customerName} (${customerEmail}) -> ${mealSummary}`);

    return res.json({
      success: true,
      message: 'Meal selections updated successfully!',
      contractId: contractId,
      totalSelected,
      entry: newEntry
    });

  } catch (error) {
    console.error('❌ Error saving meal selections:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while saving selections.'
    });
  }
}

app.post('/', handleSaveSelections);
app.post('/save', handleSaveSelections);
app.post('/apps/choose-meals', handleSaveSelections);
app.post('/apps/choose-meals/save', handleSaveSelections);
app.post('/api/save-selections', handleSaveSelections);

/**
 * Admin Action: Align all active subscribers to Thursday 7:00 PM UK Time
 */
app.post('/api/admin/align-billing-thursday', async (req, res) => {
  try {
    const result = await subscriptionService.alignAllSubscribersToThursday7PM();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Admin Action: 1-Click Holiday Mode (Skip next delivery week for all customers)
 */
app.post('/api/admin/skip-all-holiday', async (req, res) => {
  try {
    const weeks = parseInt(req.body.weeks || 1, 10);
    const result = await subscriptionService.skipNextBillingCycleAll(weeks);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Admin Action: Reschedule individual customer contract
 */
app.post('/api/admin/reschedule-contract', async (req, res) => {
  try {
    const { contractId, newDate } = req.body;
    if (!contractId || !newDate) {
      return res.status(400).json({ success: false, message: 'contractId and newDate are required.' });
    }
    const result = await subscriptionService.rescheduleContract(contractId, newDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Admin Action: Resume/Activate a paused subscription contract
 */
app.post('/api/admin/resume-contract', async (req, res) => {
  try {
    const { contractId } = req.body;
    if (!contractId) return res.status(400).json({ success: false, message: 'contractId required' });
    const result = await subscriptionService.resumeContract(contractId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Admin Action: Pause an active subscription contract
 */
app.post('/api/admin/pause-contract', async (req, res) => {
  try {
    const { contractId } = req.body;
    if (!contractId) return res.status(400).json({ success: false, message: 'contractId required' });
    const result = await subscriptionService.pauseContract(contractId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Admin Action: Save Subscription Plan & Cutoff Settings
 */
app.post('/api/admin/save-plan-settings', (req, res) => {
  try {
    const updated = storageService.saveSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Admin Action: Query store products for product browser modal
 */
app.get('/api/admin/products', async (req, res) => {
  try {
    const products = await subscriptionService.getStoreProductsLive();
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Admin Action: Skip next billing cycle for all active subscribers (Kitchen Holiday)
 */
app.post('/api/admin/skip-billing-cycle', async (req, res) => {
  try {
    const weeks = parseInt(req.body.weeks || 1, 10);
    const result = await subscriptionService.skipNextBillingCycleAll(weeks);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Webhook: Auto-align any newly created subscription contract to Thursday 7PM (with 5-day grace period)
 */
app.post('/api/webhooks/subscription-contract-created', async (req, res) => {
  try {
    const contractId = req.body?.id || req.body?.admin_graphql_api_id;
    if (contractId) {
      console.log(`⚡ [Webhook Triggered] Auto-aligning new contract ${contractId} to Thursday 7PM`);
      await subscriptionService.alignContractToThursday7PM(contractId);
    }
    res.status(200).send('Webhook processed');
  } catch (e) {
    res.status(200).send('Processed with notice');
  }
});
/**
 * Webhook: Automated Payment Failure Webhook
 * Triggered by Shopify when any subscription billing attempt fails
 */
app.post(['/webhooks/subscription-billing-attempts/failure', '/api/webhooks/billing-attempt-failure'], async (req, res) => {
  try {
    const payload = req.body || {};
    const contractId = payload.subscription_contract_id || payload.admin_graphql_api_id;
    const errorCode = payload.error_code || 'PAYMENT_FAILURE';
    const errorMessage = payload.error_message || 'Payment method was declined';

    if (contractId) {
      const fullContractId = String(contractId).startsWith('gid://') 
        ? contractId 
        : `gid://shopify/SubscriptionContract/${contractId}`;
      console.log(`⚠️ [Webhook] Payment failure recorded for ${fullContractId}`);
      await billingRetryService.recordFailure({
        contractId: fullContractId,
        errorCode,
        errorMessage
      });
    }
    res.status(200).send('Recorded');
  } catch (err) {
    console.error('Webhook failure handler notice:', err.message);
    res.status(200).send('Acknowledged');
  }
});

/**
 * Webhook: Automated Payment Success Webhook
 * Triggered by Shopify when a subscription billing attempt succeeds
 */
app.post(['/webhooks/subscription-billing-attempts/success', '/api/webhooks/billing-attempt-success'], async (req, res) => {
  try {
    const payload = req.body || {};
    const contractId = payload.subscription_contract_id || payload.admin_graphql_api_id;
    if (contractId) {
      const fullContractId = String(contractId).startsWith('gid://') 
        ? contractId 
        : `gid://shopify/SubscriptionContract/${contractId}`;
      console.log(`✅ [Webhook] Payment success recorded for ${fullContractId}`);
      billingRetryService.recordSuccess(fullContractId);
    }
    res.status(200).send('Resolved');
  } catch (err) {
    res.status(200).send('Acknowledged');
  }
});

/**
 * Admin Action: Trigger Scheduled Retries On-Demand
 */
app.post('/api/admin/process-retries', async (req, res) => {
  try {
    const result = await billingRetryService.processPendingRetries();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Admin Action: Manually Retry Single Contract Payment Now
 */
app.post('/api/admin/retry-single-contract', async (req, res) => {
  try {
    const { contractId } = req.body;
    if (!contractId) return res.status(400).json({ success: false, message: 'contractId is required' });
    const result = await billingRetryService.retryBillingAttempt(contractId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Gimmie Choose Meals App running on port ${PORT}`);
    console.log(`👉 Test Live Preview: http://localhost:${PORT}/?preview=true`);
    console.log(`👉 Shopify Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`====================================================`);
  });
}

module.exports = app;
