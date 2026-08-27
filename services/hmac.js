const crypto = require('crypto');

/**
 * Verify Shopify App Proxy HMAC Signature
 * @param {object} queryParams - Express req.query object
 * @param {string} apiSecret - Shopify App API Secret Key
 * @returns {boolean} true if valid, false otherwise
 */
function verifyAppProxyHmac(queryParams, apiSecret) {
  if (!apiSecret) {
    // In local development or if secret is not set, log warning and allow
    console.warn('⚠️ [HMAC] SHOPIFY_API_SECRET_KEY is empty. Skipping HMAC verification in development.');
    return true;
  }

  const { signature, ...rest } = queryParams;
  if (!signature) {
    return false;
  }

  // Sort query parameters alphabetically and format as key=valkey=val or key=val&key=val (Shopify app proxy uses standard sorted key=value join)
  const sortedParams = Object.keys(rest)
    .sort()
    .map(key => {
      const val = Array.isArray(rest[key]) ? rest[key].join(',') : rest[key];
      return `${key}=${val}`;
    })
    .join('');

  const calculatedHmac = crypto
    .createHmac('sha256', apiSecret)
    .update(sortedParams)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(calculatedHmac, 'utf8')
    );
  } catch (e) {
    return false;
  }
}

module.exports = {
  verifyAppProxyHmac
};
