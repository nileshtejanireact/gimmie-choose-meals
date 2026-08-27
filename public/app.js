/**
 * Gimmie "Choose Your Meals" Client-Side Controller
 */
(function () {
  'use strict';

  // Read config injected from server
  const configEl = document.getElementById('gimmie-config');
  if (!configEl) return;

  const config = JSON.parse(configEl.textContent || '{}');
  const mealQuota = parseInt(config.mealQuota || 6, 10);
  const contractId = config.contractId || '';
  const meals = config.meals || [];

  // State
  const state = {
    selections: {}, // { [variantId]: { quantity, title, id } }
    totalSelected: 0
  };

  // Prepopulate with any existing lines if available
  if (config.currentLines && Array.isArray(config.currentLines)) {
    config.currentLines.forEach(line => {
      if (line.variantId && line.quantity) {
        state.selections[line.variantId] = {
          quantity: line.quantity,
          title: line.title,
          id: line.productId
        };
      }
    });
  }

  // DOM Elements
  const counterBadge = document.getElementById('gimmie-counter-badge');
  const summarySelectedCount = document.getElementById('gimmie-summary-count');
  const summaryQuota = document.getElementById('gimmie-summary-quota');
  const progressBar = document.getElementById('gimmie-progress-fill');
  const selectedListEl = document.getElementById('gimmie-selected-meals-list');
  const saveButton = document.getElementById('gimmie-save-btn');
  const statusMessage = document.getElementById('gimmie-status-message');

  // Modal Elements
  const modalEl = document.getElementById('gimmie-nutrition-modal');
  const modalBackdrop = document.getElementById('gimmie-modal-backdrop');
  const modalCloseBtn = document.getElementById('gimmie-modal-close');
  const modalTitle = document.getElementById('gimmie-modal-title');
  const modalImage = document.getElementById('gimmie-modal-image');
  const modalDesc = document.getElementById('gimmie-modal-desc');
  const modalAllergens = document.getElementById('gimmie-modal-allergens');
  const modalTableBody = document.getElementById('gimmie-modal-table-body');
  const modalBadges = document.getElementById('gimmie-modal-badges');

  /**
   * Recalculate totals and update the UI
   */
  function updateUI() {
    let total = 0;
    Object.values(state.selections).forEach(item => {
      total += item.quantity || 0;
    });
    state.totalSelected = total;

    // Update Counter Text
    if (counterBadge) {
      counterBadge.textContent = `${total} of ${mealQuota} Selected`;
      if (total === mealQuota) {
        counterBadge.classList.add('is-complete');
      } else {
        counterBadge.classList.remove('is-complete');
      }
    }

    if (summarySelectedCount) {
      summarySelectedCount.textContent = total;
    }
    if (summaryQuota) {
      summaryQuota.textContent = mealQuota;
    }

    // Update Progress Bar
    if (progressBar) {
      const percentage = Math.min(100, Math.round((total / mealQuota) * 100));
      progressBar.style.width = `${percentage}%`;
    }

    // Update Meal Card Quantity Inputs & Plus Button States
    meals.forEach(meal => {
      const qtyEl = document.querySelector(`[data-meal-qty="${meal.variantId}"]`);
      const minusBtn = document.querySelector(`[data-action="minus"][data-variant-id="${meal.variantId}"]`);
      const plusBtn = document.querySelector(`[data-action="plus"][data-variant-id="${meal.variantId}"]`);

      const currentQty = state.selections[meal.variantId]?.quantity || 0;

      if (qtyEl) {
        qtyEl.textContent = currentQty;
      }
      if (minusBtn) {
        minusBtn.disabled = currentQty <= 0;
      }
      if (plusBtn) {
        plusBtn.disabled = total >= mealQuota;
      }
    });

    // Update Sticky Summary List
    renderSummaryList();

    // Enable / Disable Save Button
    if (saveButton) {
      if (total === mealQuota) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save My Meal Selection';
      } else if (total < mealQuota) {
        saveButton.disabled = true;
        saveButton.textContent = `Select ${mealQuota - total} More Meal${mealQuota - total > 1 ? 's' : ''}`;
      } else {
        saveButton.disabled = true;
        saveButton.textContent = `Remove ${total - mealQuota} Meal${total - mealQuota > 1 ? 's' : ''}`;
      }
    }
  }

  /**
   * Render the chosen items in the sidebar summary
   */
  function renderSummaryList() {
    if (!selectedListEl) return;

    const items = Object.entries(state.selections).filter(([_, item]) => item.quantity > 0);

    if (items.length === 0) {
      selectedListEl.innerHTML = '<p style="color: var(--gimmie-muted); font-size: 0.9rem; margin: 0;">No meals selected yet.</p>';
      return;
    }

    let html = '';
    items.forEach(([variantId, item]) => {
      html += `
        <div class="gimmie-build-box__selected-item">
          <span>${item.quantity} × ${item.title}</span>
          <span style="cursor: pointer; opacity: 0.7; font-size: 1.1rem;" data-remove-variant="${variantId}">&times;</span>
        </div>
      `;
    });

    selectedListEl.innerHTML = html;

    // Attach remove handlers
    selectedListEl.querySelectorAll('[data-remove-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        const vId = btn.getAttribute('data-remove-variant');
        if (state.selections[vId]) {
          delete state.selections[vId];
          updateUI();
        }
      });
    });
  }

  /**
   * Handle Quantity Plus / Minus Clicks
   */
  function handleQuantityChange(variantId, change) {
    const meal = meals.find(m => String(m.variantId) === String(variantId));
    if (!meal) return;

    if (!state.selections[variantId]) {
      state.selections[variantId] = {
        quantity: 0,
        title: meal.title,
        id: meal.id,
        variantId: meal.variantId
      };
    }

    const currentQty = state.selections[variantId].quantity;
    const newQty = Math.max(0, currentQty + change);

    // Box quota check
    if (change > 0 && state.totalSelected >= mealQuota) {
      return;
    }

    if (newQty === 0) {
      delete state.selections[variantId];
    } else {
      state.selections[variantId].quantity = newQty;
    }

    updateUI();
  }

  /**
   * Show Meal Nutrition Modal
   */
  function openModal(mealId) {
    const meal = meals.find(m => String(m.id) === String(mealId) || String(m.variantId) === String(mealId));
    if (!meal || !modalEl) return;

    modalTitle.textContent = meal.title;
    modalImage.src = meal.image;
    modalImage.alt = meal.title;
    modalDesc.textContent = meal.description;
    modalAllergens.textContent = `Allergens: ${meal.allergens || 'None'}`;

    // Render Badges
    if (modalBadges && meal.badges) {
      modalBadges.innerHTML = meal.badges.map(b => `<span class="gimmie-build-box__badge">${b}</span>`).join(' ');
    }

    // Render Table
    if (modalTableBody && meal.nutrition) {
      const n = meal.nutrition;
      modalTableBody.innerHTML = `
        <tr><th>Serving Size</th><td>${n.serving || 'Per Serving'}</td></tr>
        <tr><th>Energy (kJ)</th><td>${n.energyKj || '-'}</td></tr>
        <tr><th>Energy (kcal)</th><td>${n.energyKcal || '-'}</td></tr>
        <tr><th>Fat</th><td>${n.fat || '-'}</td></tr>
        <tr><th>- of which saturates</th><td>${n.saturates || '-'}</td></tr>
        <tr><th>Carbohydrate</th><td>${n.carbs || '-'}</td></tr>
        <tr><th>- of which sugars</th><td>${n.sugars || '-'}</td></tr>
        <tr><th>Fibre</th><td>${n.fibre || '-'}</td></tr>
        <tr><th>Protein</th><td>${n.protein || '-'}</td></tr>
        <tr><th>Salt</th><td>${n.salt || '-'}</td></tr>
      `;
    }

    modalEl.removeAttribute('hidden');
    document.body.classList.add('gimmie-build-box-modal-open');
  }

  function closeModal() {
    if (modalEl) {
      modalEl.setAttribute('hidden', '');
      document.body.classList.remove('gimmie-build-box-modal-open');
    }
  }

  /**
   * Save Selections to Shopify Subscription Contract
   */
  async function saveSelections() {
    if (state.totalSelected !== mealQuota) {
      showStatus(`Please select exactly ${mealQuota} meals before saving.`, true);
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Saving Your Selections...';
    showStatus('Updating your upcoming order...', false);

    const payload = {
      contractId,
      selectedMeals: Object.values(state.selections).filter(item => item.quantity > 0)
    };

    try {
      // Use current proxy path to post
      const endpoint = window.location.pathname.includes('/apps/choose-meals')
        ? '/apps/choose-meals/save'
        : '/api/save-selections';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        showStatus('✓ Meal selections saved successfully for your next delivery!', false, true);
        saveButton.textContent = '✓ Selections Saved!';
      } else {
        throw new Error(data.message || 'Could not update meal selections.');
      }
    } catch (error) {
      console.error('Error saving meals:', error);
      showStatus(`Error: ${error.message || 'Unable to save. Please try again.'}`, true);
      saveButton.disabled = false;
      saveButton.textContent = 'Save My Meal Selection';
    }
  }

  function showStatus(msg, isError = false, isSuccess = false) {
    if (!statusMessage) return;
    statusMessage.textContent = msg;
    statusMessage.className = 'gimmie-build-box__status';
    if (isError) statusMessage.classList.add('is-error');
    if (isSuccess) statusMessage.classList.add('is-success');
  }

  /**
   * Setup Event Listeners
   */
  function initListeners() {
    // Minus and Plus Buttons
    document.querySelectorAll('[data-action="minus"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const vId = btn.getAttribute('data-variant-id');
        handleQuantityChange(vId, -1);
      });
    });

    document.querySelectorAll('[data-action="plus"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const vId = btn.getAttribute('data-variant-id');
        handleQuantityChange(vId, 1);
      });
    });

    // Open Modal
    document.querySelectorAll('[data-open-modal]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-open-modal');
        openModal(id);
      });
    });

    // Close Modal
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Save Button
    if (saveButton) {
      saveButton.addEventListener('click', saveSelections);
    }
  }

  // Initialize on load
  document.addEventListener('DOMContentLoaded', () => {
    initListeners();
    updateUI();
  });
})();
