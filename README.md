# Gimmie "Choose Your Meals" Shopify Subscription App

Complete full-stack Shopify App Proxy backend and interactive meal selector for **Gimmie Meal Prep**.

---

## 🌟 Features

* **Reliable Customer Recognition:** Automatically identifies logged-in Shopify customers via App Proxy HMAC authentication.
* **Active Subscription Quota Tracking:** Fetches the customer's active subscription contract (e.g. 6, 8, 10, or 12 meals) using Shopify Admin GraphQL API.
* **Smart Menu Rotation:** Dynamically pulls the upcoming week's meal collection and parses nutritional macros, ingredients, and allergen warnings.
* **Multi-Quantity Meal Selector:** Allows customers to select multiple quantities of their favourite dishes (e.g. 2× Chicken, 2× Beef, 2× Salmon).
* **Live Box Progress & Sticky Summary:** Real-time counter and progress bar, preventing submission until the exact quota is filled.
* **Automated Order Line Updates:** Creates and commits a `subscriptionContractUpdate` draft so fulfillment receives the exact meals chosen.
* **100% Matching Gimmie Branding:** Retro drop-shadows, Prompt typography, brand color scheme (`#f6f1e7`, `#102b10`, `#8faf8f`), and responsive mobile design.

---

## 📁 Project Structure

```
gimmie-choose-meals/
├── server.js               # Main Express app & Shopify App Proxy routing
├── config/
│   └── shopify.js          # Shopify Admin GraphQL client
├── services/
│   ├── hmac.js             # Shopify App Proxy HMAC-SHA256 signature verification
│   ├── subscription.js     # Subscription contract fetching & line item update engine
│   └── menu.js             # Weekly menu resolver with nutrition & macros parser
├── views/
│   ├── choose-meals.liquid # Main interactive meal selector UI
│   ├── logged-out.liquid   # Login prompt state
│   └── no-subscription.liquid # No active subscription state
├── public/
│   ├── styles.css          # Gimmie brand stylesheet & responsive rules
│   └── app.js              # Client-side reactivity, counter logic & AJAX save
├── test/
│   └── test-mock.js        # Automated test suite
├── vercel.json             # 1-Click Serverless deployment configuration
├── package.json            # Node.js dependencies
└── .env.example            # Environment variables template
```

---

## 🚀 Quick Start (Local Testing)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your Shopify details:
```env
SHOPIFY_SHOP_DOMAIN=iknacn-wq.myshopify.com
SHOPIFY_ADMIN_API_ACCESS_TOKEN=shpat_your_token_here
SHOPIFY_API_SECRET_KEY=your_api_secret_key_here
```

### 3. Start Local Server
```bash
npm start
```
Open **[http://localhost:3000/?preview=true](http://localhost:3000/?preview=true)** in your browser to test the interactive meal builder immediately with full Gimmie mock data!

---

## ☁️ Deployment (Vercel / Render)

### Option A: Deploy to Vercel (Recommended - 2 Minutes)
1. Push this folder to a GitHub repository.
2. Go to [Vercel](https://vercel.com) and click **Add New Project** → Import the repository.
3. Under **Environment Variables**, add:
   * `SHOPIFY_SHOP_DOMAIN`
   * `SHOPIFY_ADMIN_API_ACCESS_TOKEN`
   * `SHOPIFY_API_SECRET_KEY`
4. Click **Deploy**. Vercel will give you a live URL (e.g. `https://gimmie-choose-meals.vercel.app`).

---

## ⚙️ Shopify Admin Configuration

Once your backend is deployed:

1. In Shopify Admin, navigate to **Settings → Apps and sales channels → Develop apps**.
2. Select your Custom App (e.g., *Gimmie Meal Selector*).
3. Under **Configuration → Admin API integration**, ensure the following scopes are enabled:
   * `read_customers`
   * `read_own_subscription_contracts` & `write_own_subscription_contracts`
   * `read_products`
   * `read_orders`
4. Under **App Setup → App Proxy**:
   * **Subpath prefix:** `apps`
   * **Subpath:** `choose-meals`
   * **Proxy URL:** `https://your-deployed-backend-url.vercel.app`
5. Click **Save**.

Your customers can now visit **`https://www.gimmie.co.uk/apps/choose-meals`** to choose their meals seamlessly!
