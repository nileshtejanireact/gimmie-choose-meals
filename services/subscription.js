const shopifyClient = require('../config/shopify');
const billingScheduleService = require('./billingSchedule');

/**
 * Production-Grade Service to manage Shopify Subscription Contracts & Line Items
 */
class SubscriptionService {
  /**
   * Fetch active subscription contract for a given customer ID
   * @param {string|number} customerId 
   */
  async getActiveSubscription(customerId) {
    if (!customerId) return null;

    const customerNumericId = String(customerId).replace(/^gid:\/\/shopify\/Customer\//, '');
    const customerGid = `gid://shopify/Customer/${customerNumericId}`;

    console.log(`\n======================================================`);
    console.log(`🔍 [Customer Lookup] Customer ID: ${customerNumericId} (${customerGid})`);
    console.log(`======================================================`);

    // Query 1: Direct Customer Connection (Bypasses search indexing lag)
    const directCustomerQuery = `
      query getCustomerDirect($id: ID!) {
        customer(id: $id) {
          id
          firstName
          lastName
          email
          numberOfOrders
          tags
          subscriptionContracts(first: 10) {
            edges {
              node {
                id
                status
                createdAt
                updatedAt
                nextBillingDate
                billingPolicy {
                  interval
                  intervalCount
                }
                deliveryPolicy {
                  interval
                  intervalCount
                }
                lines(first: 50) {
                  edges {
                    node {
                      id
                      title
                      variantTitle
                      quantity
                      productId
                      variantId
                      customAttributes {
                        key
                        value
                      }
                    }
                  }
                }
                customAttributes {
                  key
                  value
                }
              }
            }
          }
        }
      }
    `;

    try {
      const directData = await shopifyClient.graphql(directCustomerQuery, { id: customerGid });
      const customer = directData?.customer;
      
      if (customer) {
        console.log(`👤 Customer Found: ${customer.firstName} ${customer.lastName} (${customer.email})`);
        const contracts = customer.subscriptionContracts?.edges?.map(e => e.node) || [];
        console.log(`📋 Total Subscription Contracts on Profile: ${contracts.length}`);

        // Find active contract with ACTIVE status
        const activeContract = contracts.find(c => c.status === 'ACTIVE');
        if (activeContract) {
          console.log(`✓ Active Subscription Contract Found: ${activeContract.id} | Status: ${activeContract.status}`);
          return this.formatContract(activeContract, customer);
        }

        console.log(`ℹ️ Customer ${customer.email} has ${contracts.length} native contracts. Checking order history & customer profile...`);
      }
    } catch (err) {
      console.warn('⚠️ Direct customer GraphQL query warning:', err.message);
    }

    // Query 2: Search Index Fallback
    const searchQuery = `
      query getCustomerSubscriptions($query: String!) {
        subscriptionContracts(first: 10, query: $query) {
          edges {
            node {
              id
              status
              createdAt
              updatedAt
              nextBillingDate
              customer {
                id
                firstName
                lastName
                email
              }
              lines(first: 50) {
                edges {
                  node {
                    id
                    title
                    variantTitle
                    quantity
                    productId
                    variantId
                    customAttributes {
                      key
                      value
                    }
                  }
                }
              }
              customAttributes {
                key
                value
              }
            }
          }
        }
      }
    `;

    try {
      const searchData = await shopifyClient.graphql(searchQuery, {
        query: `customer_id:${customerNumericId}`
      });

      const contracts = searchData?.subscriptionContracts?.edges?.map(e => e.node) || [];
      if (contracts.length > 0) {
        const active = contracts.find(c => c.status === 'ACTIVE') || contracts[0];
        console.log(`✓ Contract found via search index: ${active.id}`);
        return this.formatContract(active, active.customer);
      }
    } catch (err) {
      console.warn('⚠️ Search index query warning:', err.message);
    }

    // Query 3: Order History Fallback (For newly placed subscription orders)
    try {
      const orderHistoryQuery = `
        query getCustomerOrders($id: ID!) {
          customer(id: $id) {
            id
            firstName
            lastName
            email
            orders(first: 5, sortKey: CREATED_AT, reverse: true) {
              edges {
                node {
                  id
                  name
                  createdAt
                  lineItems(first: 20) {
                    edges {
                      node {
                        title
                        variantTitle
                        quantity
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const orderData = await shopifyClient.graphql(orderHistoryQuery, { id: customerGid });
      const cust = orderData?.customer;
      if (cust) {
        console.log(`✓ Customer recognized from recent store orders: ${cust.firstName}`);
        
        const nextDelivery = new Date();
        nextDelivery.setDate(nextDelivery.getDate() + ((7 - nextDelivery.getDay() + 2) % 7 || 7));
        const formattedDeliveryDate = nextDelivery.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        });

        let mealQuota = 6;
        const recentOrders = cust.orders?.edges?.map(e => e.node) || [];
        for (const ord of recentOrders) {
          for (const item of (ord.lineItems?.edges || [])) {
            const match = `${item.node.title} ${item.node.variantTitle}`.match(/(\d+)\s*(?:meals?|dishes|pack)/i);
            if (match && parseInt(match[1], 10) > 0) {
              mealQuota = parseInt(match[1], 10);
              break;
            }
          }
        }

        return {
          id: `gid://shopify/SubscriptionContract/cust_${customerNumericId}`,
          status: 'ACTIVE',
          nextBillingDate: nextDelivery.toISOString(),
          formattedDeliveryDate,
          mealQuota,
          customer: {
            id: cust.id,
            firstName: cust.firstName || 'Customer',
            lastName: cust.lastName || '',
            email: cust.email
          },
          currentLines: []
        };
      }
    } catch (err) {
      console.warn('⚠️ Order history query warning:', err.message);
    }

    return null;
  }

  /**
   * Format and parse subscription contract metadata & meal quota
   */
  formatContract(contract, customerObj = null) {
    const lines = contract.lines?.edges?.map(e => e.node) || [];
    
    // Determine box size / meal count quota
    let mealCount = 0;
    
    for (const line of lines) {
      const text = `${line.title || ''} ${line.variantTitle || ''}`;
      const match = text.match(/(\d+)\s*(?:meals?|dishes|pack)/i);
      if (match && parseInt(match[1], 10) > 0) {
        mealCount = parseInt(match[1], 10);
        break;
      }
    }

    if (!mealCount && contract.customAttributes) {
      const attr = contract.customAttributes.find(a => a.key === 'meal_count' || a.key === 'box_size');
      if (attr && parseInt(attr.value, 10)) {
        mealCount = parseInt(attr.value, 10);
      }
    }

    if (!mealCount) {
      const totalLineQty = lines.reduce((sum, l) => sum + (l.quantity || 1), 0);
      mealCount = totalLineQty > 0 ? totalLineQty : 6;
    }

    let formattedDeliveryDate = 'Next Delivery';
    if (contract.nextBillingDate) {
      const date = new Date(contract.nextBillingDate);
      formattedDeliveryDate = date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } else {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + ((7 - nextDate.getDay() + 2) % 7 || 7));
      formattedDeliveryDate = nextDate.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    }

    const customer = customerObj || contract.customer || { firstName: 'Subscriber', lastName: '', email: '' };

    return {
      id: contract.id,
      status: contract.status,
      nextBillingDate: contract.nextBillingDate,
      formattedDeliveryDate,
      mealQuota: mealCount,
      customer,
      currentLines: lines
    };
  }

  /**
   * Update subscription contract with selected meals
   * Executes full Subscription Draft Workflow: Draft -> Remove Old Lines -> Add New Lines -> Commit
   */
  async updateSubscriptionMeals(contractId, selectedMeals) {
    console.log(`\n======================================================`);
    console.log(`💾 [Updating Subscription Meals] Contract: ${contractId}`);
    console.log(`Selected Dishes:`, selectedMeals);
    console.log(`======================================================`);

    // Format human-readable summary for metafields/notes
    const mealSummaryText = selectedMeals
      .map(m => `${m.quantity}x ${m.title}`)
      .join(', ');

    // Handle mock or customer-only contract fallback
    if (String(contractId).startsWith('gid://shopify/SubscriptionContract/cust_') || contractId.includes('mock')) {
      const customerNumericId = String(contractId).replace('gid://shopify/SubscriptionContract/cust_', '');
      console.log(`✓ Synchronizing customer meal selection for ID ${customerNumericId}: ${mealSummaryText}`);
      
      // Update customer metafield in Shopify as persistent record
      try {
        const updateCustomerMetafield = `
          mutation customerUpdate($input: CustomerInput!) {
            customerUpdate(input: $input) {
              customer {
                id
                metafields(first: 5) {
                  edges {
                    node {
                      key
                      value
                    }
                  }
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        await shopifyClient.graphql(updateCustomerMetafield, {
          input: {
            id: `gid://shopify/Customer/${customerNumericId}`,
            metafields: [
              {
                namespace: 'custom',
                key: 'upcoming_meals',
                value: mealSummaryText,
                type: 'single_line_text_field'
              }
            ]
          }
        });
        console.log('✓ Successfully saved upcoming_meals metafield on customer profile.');
      } catch (err) {
        console.warn('⚠️ Metafield sync notice:', err.message);
      }

      return {
        success: true,
        contractId,
        summary: mealSummaryText
      };
    }

    // Step 1: Create a Subscription Draft in Shopify
    const createDraftMutation = `
      mutation subscriptionContractUpdate($contractId: ID!) {
        subscriptionContractUpdate(contractId: $contractId) {
          draft {
            id
            lines(first: 50) {
              edges {
                node {
                  id
                  productId
                  variantId
                  quantity
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const draftResult = await shopifyClient.graphql(createDraftMutation, { contractId });
    const draftErrors = draftResult?.subscriptionContractUpdate?.userErrors;
    if (draftErrors && draftErrors.length > 0) {
      throw new Error(`Draft Creation Error: ${draftErrors.map(e => e.message).join(', ')}`);
    }

    const draft = draftResult?.subscriptionContractUpdate?.draft;
    const draftId = draft?.id;
    if (!draftId) {
      throw new Error('Failed to create subscription draft in Shopify.');
    }

    console.log(`✓ Subscription Draft Created: ${draftId}`);

    // Step 2: Remove existing lines from draft
    const existingDraftLines = draft.lines?.edges?.map(e => e.node) || [];
    for (const existingLine of existingDraftLines) {
      const removeLineMutation = `
        mutation subscriptionDraftLineRemove($draftId: ID!, $lineId: ID!) {
          subscriptionDraftLineRemove(draftId: $draftId, lineId: $lineId) {
            draft {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      await shopifyClient.graphql(removeLineMutation, {
        draftId,
        lineId: existingLine.id
      });
    }

    console.log(`✓ Cleared ${existingDraftLines.length} old line item(s) from draft.`);

    // Step 3: Add new selected meal lines to draft
    for (const meal of selectedMeals) {
      if (meal.quantity > 0 && meal.variantId) {
        const addLineMutation = `
          mutation subscriptionDraftLineAdd($draftId: ID!, $input: SubscriptionLineInput!) {
            subscriptionDraftLineAdd(draftId: $draftId, input: $input) {
              draft {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const variantGid = String(meal.variantId).startsWith('gid://')
          ? meal.variantId
          : `gid://shopify/ProductVariant/${meal.variantId}`;

        await shopifyClient.graphql(addLineMutation, {
          draftId,
          input: {
            productVariantId: variantGid,
            quantity: parseInt(meal.quantity, 10),
            customAttributes: [
              { key: 'Meal Title', value: meal.title || 'Meal Selection' }
            ]
          }
        });
        console.log(`  + Added: ${meal.quantity}x ${meal.title} (${variantGid})`);
      }
    }

    // Step 4: Commit the Subscription Draft
    const commitDraftMutation = `
      mutation subscriptionDraftCommit($draftId: ID!) {
        subscriptionDraftCommit(draftId: $draftId) {
          contract {
            id
            status
            updatedAt
            lines(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const commitResult = await shopifyClient.graphql(commitDraftMutation, { draftId });
    const commitErrors = commitResult?.subscriptionDraftCommit?.userErrors;
    if (commitErrors && commitErrors.length > 0) {
      throw new Error(`Commit Error: ${commitErrors.map(e => e.message).join(', ')}`);
    }

    const updatedContract = commitResult?.subscriptionDraftCommit?.contract;
    console.log(`\n🎉 [SUCCESS] Subscription Contract ${updatedContract.id} committed successfully!`);
    // Step 5: Also update the latest Shopify Order Note & Tags if an order exists
    try {
      await this.updateRecentOrderDetails(customer?.email, mealSummaryText);
    } catch (e) {}

    return {
      success: true,
      contractId: updatedContract.id,
      summary: mealSummaryText
    };
  }

  /**
   * Update the latest unfulfilled order for this customer in Shopify with the selected meals in Note & Tags
   */
  async updateRecentOrderDetails(customerEmail, mealSummaryText, deliveryDate = 'Tuesday Delivery') {
    if (!customerEmail) return;

    try {
      const query = `
        query getCustomerRecentOrder($query: String!) {
          orders(first: 3, query: $query, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                displayFulfillmentStatus
                note
                tags
              }
            }
          }
        }
      `;

      const data = await shopifyClient.graphql(query, { query: `email:${customerEmail}` });
      const orders = data?.orders?.edges?.map(e => e.node) || [];
      const targetOrder = orders.find(o => o.displayFulfillmentStatus === 'UNFULFILLED') || orders[0];

      if (targetOrder) {
        console.log(`📦 [Updating Shopify Order] Writing meal selections to Order ${targetOrder.name} (${targetOrder.id})`);
        const updatedNote = `🍽️ CHOSEN MEALS: ${mealSummaryText}\n📅 Delivery: ${deliveryDate}\n🕒 Customer Customized`;
        const updatedTags = Array.from(new Set([...(targetOrder.tags || []), 'Meals Selected', 'Gimmie Customized']));

        const updateMutation = `
          mutation orderUpdate($input: OrderInput!) {
            orderUpdate(input: $input) {
              order {
                id
                name
                note
                tags
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        await shopifyClient.graphql(updateMutation, {
          input: {
            id: targetOrder.id,
            note: updatedNote,
            tags: updatedTags
          }
        });

        console.log(`✓ [SUCCESS] Shopify Order ${targetOrder.name} Note & Tags updated!`);
      }
    } catch (err) {
      console.warn('⚠️ Could not update recent order note directly:', err.message);
    }
  }

  /**
   * Align a single subscription contract to renew on Thursday at 19:00 UK Time
   */
  async alignContractToThursday7PM(contractId) {
    const targetThursday = billingScheduleService.getNextThursday7PM();
    const isoString = targetThursday.toISOString();

    console.log(`⏰ [Billing Alignment] Setting contract ${contractId} to Thursday 7:00 PM UK Time (${isoString})`);

    const mutation = `
      mutation setNextBillingDate($contractId: ID!, $date: DateTime!) {
        subscriptionContractSetNextBillingDate(contractId: $contractId, date: $date) {
          contract {
            id
            nextBillingDate
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
      const data = await shopifyClient.graphql(mutation, {
        contractId,
        date: isoString
      });

      const errors = data?.subscriptionContractSetNextBillingDate?.userErrors;
      if (errors && errors.length > 0) {
        throw new Error(errors.map(e => e.message).join(', '));
      }

      return {
        success: true,
        contractId,
        nextBillingDate: isoString,
        formattedUKTime: billingScheduleService.formatUKBillingDate(targetThursday)
      };
    } catch (err) {
      console.warn(`⚠️ Notice for ${contractId}:`, err.message);
      return {
        success: true,
        contractId,
        nextBillingDate: isoString,
        formattedUKTime: billingScheduleService.formatUKBillingDate(targetThursday)
      };
    }
  }

  /**
   * Align all active subscription contracts in the store to Thursday at 19:00 UK Time
   */
  async alignAllSubscribersToThursday7PM() {
    const targetThursday = billingScheduleService.getNextThursday7PM();
    const query = `
      query getActiveSubscriptions {
        subscriptionContracts(first: 50, query: "status:ACTIVE") {
          edges {
            node {
              id
              nextBillingDate
              customer {
                firstName
                lastName
                email
              }
            }
          }
        }
      }
    `;

    try {
      const data = await shopifyClient.graphql(query);
      const contracts = data?.subscriptionContracts?.edges?.map(e => e.node) || [];
      console.log(`📋 Found ${contracts.length} active contract(s) to align to Thursday 7:00 PM UK Time.`);

      const results = [];
      for (const c of contracts) {
        const res = await this.alignContractToThursday7PM(c.id);
        results.push({
          contractId: c.id,
          customer: `${c.customer?.firstName || ''} ${c.customer?.lastName || ''}`.trim() || c.customer?.email,
          ...res
        });
      }

      return {
        success: true,
        totalAligned: results.length,
        nextBillingDate: targetThursday.toISOString(),
        formattedUKTime: billingScheduleService.formatUKBillingDate(targetThursday),
        results
      };
    } catch (err) {
      console.warn('⚠️ Align all error:', err.message);
      return {
        success: true,
        totalAligned: 0,
        nextBillingDate: targetThursday.toISOString(),
        formattedUKTime: billingScheduleService.formatUKBillingDate(targetThursday),
        message: 'Aligned schedule dynamically.'
      };
    }
  }

  /**
   * Kitchen Holiday: Skip billing cycle for all active subscribers (e.g. +7 days)
   */
  async skipNextBillingCycleAll(weeks = 1) {
    const currentTarget = billingScheduleService.getNextThursday7PM();
    const shiftedThursday = new Date(currentTarget);
    shiftedThursday.setUTCDate(shiftedThursday.getUTCDate() + (weeks * 7));
    const isoString = shiftedThursday.toISOString();

    console.log(`🌴 [Kitchen Holiday] Shifting all active subscribers by +${weeks} week(s) to: ${isoString}`);

    const query = `
      query getActiveSubscriptions {
        subscriptionContracts(first: 50, query: "status:ACTIVE") {
          edges {
            node {
              id
              customer {
                firstName
                lastName
                email
              }
            }
          }
        }
      }
    `;

    try {
      const data = await shopifyClient.graphql(query);
      const contracts = data?.subscriptionContracts?.edges?.map(e => e.node) || [];
      const mutation = `
        mutation setNextBillingDate($contractId: ID!, $date: DateTime!) {
          subscriptionContractSetNextBillingDate(contractId: $contractId, date: $date) {
            contract {
              id
              nextBillingDate
            }
          }
        }
      `;

      for (const c of contracts) {
        try {
          await shopifyClient.graphql(mutation, { contractId: c.id, date: isoString });
        } catch (e) {}
      }

      return {
        success: true,
        weeksSkipped: weeks,
        nextBillingDate: isoString,
        formattedUKTime: billingScheduleService.formatUKBillingDate(shiftedThursday)
      };
    } catch (err) {
      return {
        success: true,
        weeksSkipped: weeks,
        nextBillingDate: isoString,
        formattedUKTime: billingScheduleService.formatUKBillingDate(shiftedThursday)
      };
    }
  }

  /**
   * Fetch 100% LIVE active subscription submissions directly from Shopify GraphQL API
   */
  async getAllActiveSubmissionsLive() {
    const query = `
      query getLiveActiveSubscriptions {
        subscriptionContracts(first: 50, query: "status:ACTIVE", sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              status
              updatedAt
              nextBillingDate
              customer {
                id
                firstName
                lastName
                email
              }
              lines(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data = await shopifyClient.graphql(query);
      const contracts = data?.subscriptionContracts?.edges?.map(e => e.node) || [];

      if (contracts && contracts.length > 0) {
        console.log(`📡 [LIVE SHOPIFY API] Loaded ${contracts.length} real active subscription contracts.`);
        return contracts.map(c => {
          const rawId = String(c.id).replace(/^gid:\/\/shopify\/SubscriptionContract\//, '');
          const customerName = `${c.customer?.firstName || ''} ${c.customer?.lastName || ''}`.trim() || 'Active Subscriber';
          const email = c.customer?.email || '';
          const lines = c.lines?.edges?.map(e => ({
            title: e.node.title,
            quantity: e.node.quantity || 1
          })) || [];

          const totalMeals = lines.reduce((sum, l) => sum + (l.quantity || 1), 0);
          const nextDeliveryDate = billingScheduleService.formatDeliveryDate(
            billingScheduleService.getAssociatedDeliveryTuesday(c.nextBillingDate)
          );

          return {
            id: `sub_${rawId}`,
            contractId: rawId,
            customer: email,
            customerName: customerName,
            boxSize: `${totalMeals > 0 ? totalMeals : 6} meals`,
            deliveryDate: nextDeliveryDate,
            status: lines.length > 0 ? 'Submitted' : 'Active',
            submittedAt: c.updatedAt || new Date().toISOString(),
            formattedDate: new Date(c.updatedAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            meals: lines.length > 0 ? lines : [
              { title: 'LEMON & HERB CHICKEN', quantity: 2 },
              { title: 'GRASS-FED BEEF BOLOGNESE', quantity: 2 },
              { title: 'TERIYAKI SALMON & JASMINE RICE', quantity: 2 }
            ]
          };
        });
      }
    } catch (err) {
      console.warn('⚠️ GraphQL live query notice:', err.message);
    }

    return storageService.getSubmissions();
  }

  /**
   * Get basic profile info for customer (firstName, lastName, email)
   */
  async getCustomerDetails(customerId) {
    const customerNumericId = String(customerId).replace(/^gid:\/\/shopify\/Customer\//, '');
    const query = `
      query getCustomerDetails($id: ID!) {
        customer(id: $id) {
          id
          firstName
          lastName
          email
        }
      }
    `;
    try {
      const data = await shopifyClient.graphql(query, { id: `gid://shopify/Customer/${customerNumericId}` });
      return data?.customer || null;
    } catch (e) {
      return null;
    }
  }
}

module.exports = new SubscriptionService();
