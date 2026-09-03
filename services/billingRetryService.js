/**
 * Billing Retry & Failure Management Service
 * Automates retry attempts for failed subscription payments and executes
 * configured failure actions (Cancel/Pause/Skip) based on merchant settings.
 */

const fs = require('fs');
const path = require('path');
const shopifyClient = require('../config/shopify');
const storageService = require('./storage');

const dataDir = path.resolve(__dirname, '..', 'data');
const attemptsFile = path.resolve(dataDir, 'billing-attempts.json');

class BillingRetryService {
  constructor() {
    this._ensureFile();
  }

  _ensureFile() {
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {}
    }
    if (!fs.existsSync(attemptsFile)) {
      try {
        fs.writeFileSync(attemptsFile, JSON.stringify([], null, 2), 'utf8');
      } catch (e) {}
    }
  }

  /**
   * Get all tracked billing retry attempts
   */
  getAttempts() {
    try {
      this._ensureFile();
      const content = fs.readFileSync(attemptsFile, 'utf8');
      return JSON.parse(content || '[]');
    } catch (e) {
      console.error('Error reading billing attempts:', e.message);
      return [];
    }
  }

  /**
   * Save tracked billing retry attempts
   */
  saveAttempts(attempts) {
    try {
      this._ensureFile();
      fs.writeFileSync(attemptsFile, JSON.stringify(attempts, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Error saving billing attempts:', e.message);
      return false;
    }
  }

  /**
   * Record a payment failure for a subscription contract
   */
  async recordFailure({ contractId, customerName, errorCode, errorMessage }) {
    const settings = storageService.getSettings();
    const maxRetries = parseInt(settings.retryAttemptsPayment ?? 3, 10);
    const daysBetween = parseInt(settings.retryDaysPayment ?? 7, 10);
    const failureAction = settings.failureActionPayment || 'Cancel subscription and send notification';

    const attempts = this.getAttempts();
    let record = attempts.find(a => a.contractId === contractId && a.status === 'RETRY_PENDING');

    const errorStr = errorMessage || errorCode || 'Payment method declined';
    const nowIso = new Date().toISOString();

    if (!record) {
      record = {
        id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        contractId,
        customerName: customerName || 'Subscriber',
        attemptCount: 1,
        maxRetries,
        daysBetween,
        firstFailedAt: nowIso,
        lastAttemptAt: nowIso,
        nextRetryDate: new Date(Date.now() + daysBetween * 86400000).toISOString(),
        status: maxRetries <= 1 ? 'FAILED_FINAL' : 'RETRY_PENDING',
        lastError: errorStr,
        failureAction,
        history: [{ attempt: 1, date: nowIso, error: errorStr }]
      };
      attempts.unshift(record);

      if (maxRetries <= 1) {
        await this.executeFailureAction(contractId, failureAction);
      }
    } else {
      record.attemptCount += 1;
      record.lastAttemptAt = nowIso;
      record.lastError = errorStr;
      record.history.push({ attempt: record.attemptCount, date: nowIso, error: errorStr });

      if (record.attemptCount >= maxRetries) {
        record.status = 'FAILED_FINAL';
        record.finalActionExecutedAt = nowIso;
        await this.executeFailureAction(contractId, failureAction);
      } else {
        record.nextRetryDate = new Date(Date.now() + daysBetween * 86400000).toISOString();
      }
    }

    this.saveAttempts(attempts);
    return record;
  }

  /**
   * Mark a contract as resolved after a successful payment
   */
  recordSuccess(contractId) {
    const attempts = this.getAttempts();
    let updated = false;
    attempts.forEach(a => {
      if (a.contractId === contractId && a.status === 'RETRY_PENDING') {
        a.status = 'RESOLVED';
        a.resolvedAt = new Date().toISOString();
        updated = true;
      }
    });
    if (updated) {
      this.saveAttempts(attempts);
    }
    return updated;
  }

  /**
   * Execute the configured final failure action on Shopify
   */
  async executeFailureAction(contractId, action) {
    console.log(`Executing failure action "${action}" on contract ${contractId}...`);

    if (action.includes('Cancel')) {
      const mutation = `
        mutation cancelContract($subscriptionContractId: ID!) {
          subscriptionContractCancel(subscriptionContractId: $subscriptionContractId) {
            contract {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      try {
        const res = await shopifyClient.graphql(mutation, { subscriptionContractId: contractId });
        console.log('Contract cancelled successfully on Shopify:', res);
        return { success: true, action: 'CANCELLED', result: res };
      } catch (e) {
        console.error('Failed to cancel contract on Shopify:', e.message);
        return { success: false, error: e.message };
      }
    } else if (action.includes('Pause')) {
      const mutation = `
        mutation pauseContract($subscriptionContractId: ID!) {
          subscriptionContractPause(subscriptionContractId: $subscriptionContractId) {
            contract {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      try {
        const res = await shopifyClient.graphql(mutation, { subscriptionContractId: contractId });
        console.log('Contract paused successfully on Shopify:', res);
        return { success: true, action: 'PAUSED', result: res };
      } catch (e) {
        console.error('Failed to pause contract on Shopify:', e.message);
        return { success: false, error: e.message };
      }
    } else {
      return { success: true, action: 'SKIPPED' };
    }
  }

  /**
   * Trigger a billing attempt retry via Shopify GraphQL
   */
  async retryBillingAttempt(contractId) {
    console.log(`[RetryEngine] Attempting billing retry for contract ${contractId}...`);
    const cleanId = contractId.replace(/\D/g, '');
    const idempotencyKey = `retry_${cleanId}_${Date.now()}`;

    const mutation = `
      mutation retryBilling($subscriptionContractId: ID!, $input: SubscriptionBillingAttemptInput!) {
        subscriptionBillingAttemptCreate(
          subscriptionContractId: $subscriptionContractId,
          subscriptionBillingAttemptInput: $input
        ) {
          subscriptionBillingAttempt {
            id
            ready
            errorCode
            errorMessage
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const res = await shopifyClient.graphql(mutation, {
        subscriptionContractId: contractId,
        input: {
          idempotencyKey,
          originTime: new Date().toISOString()
        }
      });

      const attempt = res?.subscriptionBillingAttemptCreate?.subscriptionBillingAttempt;
      const userErrors = res?.subscriptionBillingAttemptCreate?.userErrors || [];

      if (userErrors.length > 0) {
        const errMsg = userErrors.map(e => e.message).join(', ');
        await this.recordFailure({ contractId, errorCode: 'USER_ERROR', errorMessage: errMsg });
        return { success: false, message: errMsg };
      }

      if (attempt?.errorCode) {
        await this.recordFailure({ contractId, errorCode: attempt.errorCode, errorMessage: attempt.errorMessage });
        return { success: false, message: attempt.errorMessage || attempt.errorCode };
      }

      this.recordSuccess(contractId);
      return { success: true, attemptId: attempt?.id, message: 'Billing retry processed successfully.' };
    } catch (e) {
      await this.recordFailure({ contractId, errorCode: 'EXCEPTION', errorMessage: e.message });
      return { success: false, message: e.message };
    }
  }

  /**
   * Process all pending retries where current time >= nextRetryDate
   */
  async processPendingRetries() {
    const attempts = this.getAttempts();
    const now = new Date();
    const dueAttempts = attempts.filter(a => a.status === 'RETRY_PENDING' && new Date(a.nextRetryDate) <= now);

    console.log(`[RetryEngine] Found ${dueAttempts.length} due retries to process.`);
    const results = [];

    for (const item of dueAttempts) {
      const res = await this.retryBillingAttempt(item.contractId);
      results.push({ contractId: item.contractId, customerName: item.customerName, result: res });
    }

    return {
      processedCount: dueAttempts.length,
      results
    };
  }
}

module.exports = new BillingRetryService();
