document.addEventListener('DOMContentLoaded', () => {
  const ordersListContainer = document.getElementById('ordersList');
  let allProducts = []; // Cache for products to add

  // Loading spinner helper functions
  function showLoading(message = 'Loading...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p id="loading-message">${message}</p>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
      document.getElementById('loading-message').textContent = message;
    }
  }

  function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.animation = '';
      }, 300);
    }
  }

  // *** NEW HELPER FUNCTION ***
  // Helper to format dates without seconds
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    // This combines date + 12-hour time with AM/PM, no seconds
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  // *** END NEW HELPER FUNCTION ***

  // Celebration functions for delivered orders
  function createConfetti() {
    const colors = ['#00c853', '#00a854', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107'];
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    document.body.appendChild(confettiContainer);

    for (let i = 0; i < 150; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 3 + 's';
      confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';
      confettiContainer.appendChild(confetti);
    }

    return confettiContainer;
  }

  function showDeliveryPopup() {
    const popup = document.createElement('div');
    popup.className = 'delivery-celebration-popup';
    popup.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-icon">🎉</div>
        <h2>Order Delivered!</h2>
        <p>Thank you for your order</p>
        <div class="celebration-check">✓</div>
      </div>
    `;
    document.body.appendChild(popup);

    // Add celebration class to body for background effect
    document.body.classList.add('celebrating');

    return popup;
  }

  function celebrateDelivery(orderId) {
    // Check if we've already celebrated this order
    const celebratedOrders = JSON.parse(localStorage.getItem('celebratedOrders') || '[]');
    if (celebratedOrders.includes(orderId)) {
      return; // Already celebrated
    }

    // Mark as celebrated
    celebratedOrders.push(orderId);
    localStorage.setItem('celebratedOrders', JSON.stringify(celebratedOrders));

    // Create celebration elements
    const confettiContainer = createConfetti();
    const popup = showDeliveryPopup();

    // Remove celebration after 5 seconds
    setTimeout(() => {
      popup.classList.add('fade-out');
      confettiContainer.classList.add('fade-out');
      document.body.classList.remove('celebrating');

      setTimeout(() => {
        popup.remove();
        confettiContainer.remove();
      }, 500);
    }, 5000);
  }

  // Main function to load and display orders
  async function loadOrders() {
    ordersListContainer.innerHTML = ''; // Clear previous view
    showLoading('Loading orders...');
    const res = await fetch('/api/myorders');
    if (!res.ok) {
      hideLoading();
      ordersListContainer.innerHTML = '<p>Please login to view your orders.</p>';
      // Optionally add a login button here too
      // ordersListContainer.innerHTML += '<button onclick="window.location.href=\'/login.html\'">Login</button>';
      return;
    }
    const orderGroups = await res.json();
    hideLoading();

    if (orderGroups.length === 0) {
      // New message and button
      ordersListContainer.innerHTML = `
        <div style="text-align: center; margin-top: 30px;">
          <p>Make your order</p>
          <button onclick="window.location.href='/index.html'" style="padding: 10px 20px; font-size: 1em; cursor: pointer;">
          Click To Make Order
          </button>
        </div>
      `;
      return;
    }

    // Check for newly delivered orders to celebrate
    orderGroups.forEach(group => {
      if (group.status === 'Delivered') {
        celebrateDelivery(group._id);
      }
    });

    orderGroups.forEach(group => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.orderGroup = JSON.stringify(group); // Store group data on the element
      el.innerHTML = generateOrderCardHtml(group); // Generate static view
      ordersListContainer.appendChild(el);
    });
  }

  // Generates the static (non-edit) view of an order
  function generateOrderCardHtml(group) {
    const itemsHtml = group.items.map(item => {
      const descriptionHtml = item.description ? `<br><medium style="color: #555;">${item.description}</medium>` : '';
      // Use item.name or fallback to item.product if name isn't populated consistently yet
      const productName = item.name || item.product || 'Unknown Product';
      return `<li>
                    <strong>${productName}</strong>
                    <strong>${descriptionHtml}</strong> - ${item.quantity} ${item.unit || ''}
                </li><br>`;
    }).join('');

    // Calculate delivery count - count items that have been partially delivered
    // This determines how many Delivery 1, Delivery 2, etc. steps to show
    let deliveryCount = 0;
    if (group.items) {
      deliveryCount = group.items.filter(item => item.quantityDelivered > 0).length;
    }

    // Generate the status flow tracker (pass delivery count for dynamic steps)
    const statusFlowHtml = generateStatusFlowHtml(group.status, deliveryCount);

    let actionHtml = '';
    // Allow editing for Ordered and Paused
    if (group.status === 'Ordered' || group.status === 'Paused') {
      actionHtml = `<button class="edit-order-btn">Edit Order</button>`;
    } else if (group.status === 'Delivered') {
      actionHtml = `<p class="small" style="color: green;">✓ Order Delivered</p>`;
    } else if (group.status === 'Cancelled') {
      actionHtml = `<p class="small" style="color: #dc3545;">This order has been cancelled.</p>`;
    } else if (group.status === 'Hold') {
      actionHtml = `<p class="small" style="color: #343a40;">Your order is on hold. We will contact you shortly.</p>`;
      if (group.pauseReason) { // Display reason if available
        actionHtml += `<div style="background: #fff8e1; padding: 5px; margin-top: 5px; font-size: 0.9em; border-left: 3px solid #ffc107;"><strong>Reason:</strong> ${group.pauseReason}</div>`;
      }
    } else if (group.status === 'Dispatch' || group.status === 'Partially Delivered') {
      actionHtml = '<p class="small" style="color: #00a854;">Your order is out for delivery!</p>';
    } else if (group.status === 'Rate Requested' || group.status === 'Rate Approved') {
      // Show as Confirmed in processing for Rate Requested/Approved
      actionHtml = '<p class="small" style="color: #00a854;">Order is being processed</p>';
    } else { // Confirmed status
      actionHtml = '<p class="small" style="color: #00a854;">Order confirmed (Contact Company for changes)</p><b><p class="small" style="color: #00a854;">ஆர்டர் உறுதி செய்யப்பட்டது மேலும் தகவல்களுக்கு எங்களை தொடர்பு கொள்ளவும்.</p></b>';
    }

    let agentDetailsHtml = '';
    // Show agent details for Confirmed, Dispatch, Partially Delivered, Hold (but NOT Rate Requested/Approved for user)
    const showAgentStatuses = ['Confirmed', 'Dispatch', 'Partially Delivered', 'Hold'];
    if (showAgentStatuses.includes(group.status) && group.deliveryAgent && group.deliveryAgent.name) {
      const descriptionHtml = group.deliveryAgent.description
        ? `<br><span class="small"><strong>Note:</strong> ${group.deliveryAgent.description}</span>`
        : '';
      const addressHtml = group.deliveryAgent.address
        ? `<br><span class="small"><strong>Address:</strong> ${group.deliveryAgent.address}</span>`
        : ''; // Display address if available

      agentDetailsHtml = `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                <strong>Delivery Agent:</strong> ${group.deliveryAgent.name}<br>
                <strong>Contact:</strong> ${group.deliveryAgent.mobile || 'N/A'}
                ${descriptionHtml}
                ${addressHtml}
            </div>
        `;
    }

    // Display pause reason specifically for Paused status
    let pauseReasonHtml = '';
    if (group.status === 'Paused' && group.pauseReason) {
      pauseReasonHtml = `<div style="background: #fff8e1; padding: 8px; margin-top: 10px; border-left: 3px solid #ffc107;"><strong>Reason for Pause:</strong><p style="margin: 5px 0;">${group.pauseReason}</p></div>`;
    }


    return `
      <strong>Ordered at:</strong> ${formatDate(group.createdAt)}<br>
      ${statusFlowHtml}
      ${pauseReasonHtml} 
      <hr>
      <strong>Items in this Order:</strong>
      <ul class="item-list">${itemsHtml}</ul>
      <div class="order-actions">${actionHtml}</div>
      ${agentDetailsHtml}
      <p class="edit-msg small" style="color:red;"></p>
    `;
  }

  // Generate the Amazon-style status flow tracker with dynamic delivery steps
  function generateStatusFlowHtml(status, deliveryCount = 0) {
    // Build flow steps dynamically based on delivery count
    // Base steps: Ordered -> Confirmed -> Dispatch -> Delivered
    // If there are multiple deliveries, add Delivery 1, Delivery 2, etc. between Dispatch and Delivered

    const isPartiallyDelivered = status === 'Partially Delivered';
    const isDelivered = status === 'Delivered';
    const hasMultipleDeliveries = deliveryCount > 1 || isPartiallyDelivered;

    // Build the flow steps dynamically
    let flowSteps = [
      { key: 'Ordered', label: 'Ordered' },
      { key: 'Confirmed', label: 'Confirmed' },
      { key: 'Dispatch', label: 'Out for Delivery' }
    ];

    // Add delivery steps if there are multiple deliveries
    if (hasMultipleDeliveries) {
      const totalDeliveries = deliveryCount > 0 ? deliveryCount : 1;
      for (let i = 1; i <= totalDeliveries; i++) {
        flowSteps.push({ key: `Delivery${i}`, label: `Delivery ${i}` });
      }
    }

    // Always add the final Delivered step
    flowSteps.push({ key: 'Delivered', label: 'Delivered' });

    // Calculate current position
    let currentIndex = 0;
    const isInterrupt = status === 'Paused' || status === 'Hold';
    const isCancelled = status === 'Cancelled';

    if (status === 'Ordered' || status === 'Rate Requested' || status === 'Rate Approved') currentIndex = 0;
    else if (status === 'Confirmed') currentIndex = 1;
    else if (status === 'Dispatch') currentIndex = 2;
    else if (status === 'Partially Delivered') {
      // Current step is the last delivery step added
      currentIndex = 2 + deliveryCount;
    }
    else if (status === 'Delivered') currentIndex = flowSteps.length - 1;

    // If cancelled, show special flow
    if (isCancelled) {
      return `
        <div class="order-status-flow">
          <div class="progress-line" style="width: 0%;"></div>
          <div class="status-step cancelled">
            <div class="step-icon">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </div>
            <span class="step-label">Cancelled</span>
          </div>
        </div>
      `;
    }

    // Calculate progress line width - 100% for delivered
    const totalSteps = flowSteps.length;
    const activeIndex = isInterrupt ? 0 : currentIndex;
    const progressPercent = isDelivered ? 100 : (activeIndex > 0 ? ((activeIndex) / (totalSteps - 1)) * 100 : 0);

    let stepsHtml = flowSteps.map((step, index) => {
      let stepClass = 'status-step';
      let iconContent = '';

      if (isInterrupt && index === 0) {
        // Show interrupt status at first position
        stepClass += ' interrupt';
        iconContent = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
        return `
          <div class="${stepClass}">
            <div class="step-icon">${iconContent}</div>
            <span class="step-label">${status === 'Paused' ? 'Paused' : 'On Hold'}</span>
          </div>
        `;
      } else if (isDelivered || index < activeIndex) {
        // All steps completed when delivered, or previous steps completed
        stepClass += ' completed';
        iconContent = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
      } else if (index === activeIndex && !isInterrupt) {
        // Current step
        stepClass += ' current';
      }

      return `
        <div class="${stepClass}">
          <div class="step-icon">${iconContent}</div>
          <span class="step-label">${step.label}</span>
        </div>
      `;
    }).join('');

    // Add delivered class to flow container for special styling
    const flowClass = isDelivered ? 'order-status-flow delivered' : 'order-status-flow';

    // Calculate progress line width based on steps (from center to center)
    // Width should be (currentStep / (totalSteps - 1)) * (100% - margins)
    const progressWidth = isDelivered ? 100 : (activeIndex > 0 ? (activeIndex / (totalSteps - 1)) * 100 : 0);

    return `
      <div class="${flowClass}" style="--steps: ${totalSteps};">
        <div class="progress-line" style="width: ${progressWidth}%;"></div>
        ${stepsHtml}
      </div>
    `;
  }

  ordersListContainer.addEventListener('click', async (e) => {
    // Check if the user clicked the "Edit Order" button
    if (e.target.classList.contains('edit-order-btn')) {
      const card = e.target.closest('.card');
      if (!card) return;

      const group = JSON.parse(card.dataset.orderGroup);

      // 1. Prepare the order items in the format expected by products.js cart
      const itemsForCart = group.items.map(item => ({
        productId: item.productId, // Pass the actual product ID
        productName: item.product, // Pass the product name
        quantity: item.quantity,
        unit: item.unit,
        description: item.description
      }));

      // 2. Store the order ID and items in sessionStorage
      const orderToEdit = {
        orderId: group._id, // Use the correct order ID
        items: itemsForCart
      };
      sessionStorage.setItem('orderToEdit', JSON.stringify(orderToEdit));

      // 3. Redirect the user to the index page (products page)
      window.location.href = '/index.html';
    }
  });

  function connectToUserStream() {
    const eventSource = new EventSource('/api/myorders/stream');
    eventSource.onmessage = function (event) {
      if (event.data === 'order_status_updated') {
        console.log("Received order update notification. Reloading orders...");
        loadOrders(); // Reload orders when notified
      }
    };
    eventSource.onerror = function () {
      console.error('Real-time connection failed.');
      // Optionally implement reconnection logic here
      eventSource.close();
      // setTimeout(connectToUserStream, 5000); // Try reconnecting after 5 seconds
    };
  }

  // --- LOGOUT FUNCTION (Copied from products.js) ---
  function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const res = await fetch('/api/logout', { method: 'POST' });
          window.location.href = '/login.html';

        } catch (error) {
          console.error('Logout error:', error);
          window.location.href = '/login.html';
        }
      });
    }
  }

  // Initial load
  loadOrders();
  connectToUserStream(); // Connect for real-time updates
  setupLogoutButton(); // <-- ADD THIS LINE
});