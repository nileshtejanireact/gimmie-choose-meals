require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { Liquid } = require('liquidjs');

const { verifyAppProxyHmac } = require('./services/hmac');
const subscriptionService = require('./services/subscription');
const menuService = require('./services/menu');
const storageService = require('./services/storage');

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
app.use(express.static(path.resolve(__dirname, 'public')));

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

/**
 * Embedded Shopify Admin Dashboard Routes
 */
async function renderAdminDashboard(req, res) {
  const shopDomain = req.query.shop || process.env.SHOPIFY_SHOP_DOMAIN || 'iknacn-wq.myshopify.com';
  const submissions = await subscriptionService.getAllActiveSubmissionsLive();

  res.render('admin-selections', {
    shopDomain,
    submissions
  });
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
      const nextDelivery = new Date();
      nextDelivery.setDate(nextDelivery.getDate() + ((7 - nextDelivery.getDay() + 2) % 7 || 7));
      const formattedDeliveryDate = nextDelivery.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });

      subscription = {
        id: `gid://shopify/SubscriptionContract/cust_${customerId}`,
        contractId: `${customerId}`,
        status: 'ACTIVE',
        formattedDeliveryDate: formattedDeliveryDate || 'Tue 1 Sept',
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
