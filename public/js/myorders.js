document.addEventListener('DOMContentLoaded', () => {
  const ordersListContainer = document.getElementById('ordersList');
  let allProducts = []; // Cache for products to add

  // Main function to load and display orders
  async function loadOrders() {
    ordersListContainer.innerHTML = ''; // Clear previous view
    const res = await fetch('/api/myorders');
    if (!res.ok) {
      ordersListContainer.innerHTML = '<p>Please login to view your orders.</p>';
      // Optionally add a login button here too
      // ordersListContainer.innerHTML += '<button onclick="window.location.href=\'/login.html\'">Login</button>';
      return;
    }
    const orderGroups = await res.json();

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

    let statusHtml;
    if (group.status === 'Delivered') statusHtml = `<strong style="color: green;">${group.status}</strong>`;
    else if (group.status === 'Confirmed') statusHtml = `<strong style="color: #007bff;">Order Confirmed</strong>`;
    else if (group.status === 'Paused') statusHtml = `<strong style="color: #6c757d;">Order Paused</strong>`;
    else if (group.status === 'Cancelled') statusHtml = `<strong style="color: #dc3545;">Order Cancelled</strong>`;
    else if (group.status === 'Rate Requested') statusHtml = `<strong style="color: #e83e8c;">Request for Confirm</strong>`;
    else if (group.status === 'Rate Approved') statusHtml = `<strong style="color: #20c997;">Rate Approved</strong>`;
    else if (group.status === 'Hold') statusHtml = `<strong style="color: #343a40;">Order on Hold</strong>`;
    else if (group.status === 'Dispatch') statusHtml = `<strong style="color: #fd7e14;">Out for Delivery</strong>`; // Added Dispatch status display
    else if (group.status === 'Partially Delivered') statusHtml = `<strong style="color: #fd7e14;">Partially Delivered</strong>`; // Added Partially Delivered
    else statusHtml = `<strong style="color: orange;">${group.status}</strong>`;

    let actionHtml = '';
    // Allow editing for Pending and Paused
    if (group.status === 'Pending' || group.status === 'Paused') {
        actionHtml = `<button class="edit-order-btn">Edit Order</button>`;
    } else if (group.status === 'Delivered') {
        actionHtml = `<p class="small" style="color: green;">✓ Order Delivered</p>`;
    } else if (group.status === 'Cancelled') {
        actionHtml = `<p class="small" style="color: #dc3545;">This order has been cancelled.</p>`;
    } else if (group.status === 'Hold') {
        actionHtml = `<p class="small" style="color: #343a40;">Your order is on hold. We will contact you shortly.</p>`;
         if(group.pauseReason) { // Display reason if available
             actionHtml += `<div style="background: #fff8e1; padding: 5px; margin-top: 5px; font-size: 0.9em; border-left: 3px solid #ffc107;"><strong>Reason:</strong> ${group.pauseReason}</div>`;
         }
    } else if (group.status === 'Rate Requested') {
        actionHtml = `<p class="small" style="color: #e83e8c;">Price updated. Please wait for confirmation call.</p>`;
    } else if (group.status === 'Rate Approved') {
        actionHtml = `<p class="small" style="color: #20c997;">Rate approved. Order processing shortly.</p>`;
    } else if (group.status === 'Dispatch' || group.status === 'Partially Delivered') {
        actionHtml = '<p class="small" style="color: #fd7e14;">Your order is out for delivery!</p>';
    }
    else { // Confirmed status
        actionHtml = '<p class="small" style="color: #00a40b;">Order confirmed (Contact Company for changes)</p><b><p class="small" style="color: #00a40b;">ஆர்டர் உறுதி செய்யப்பட்டது மேலும் தகவல்களுக்கு எங்களை தொடர்பு கொள்ளவும்.</p></b>';
    }

    let agentDetailsHtml = '';
    // Show agent details for Confirmed, Dispatch, Partially Delivered, Hold, Rate Approved, Rate Requested
    const showAgentStatuses = ['Confirmed', 'Dispatch', 'Partially Delivered', 'Hold', 'Rate Approved', 'Rate Requested'];
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
      <strong>Ordered at:</strong> ${new Date(group.createdAt).toLocaleString()}<br>
      <strong>Status:</strong> ${statusHtml}
      ${pauseReasonHtml} 
      <hr>
      <strong>Items in this Order:</strong>
      <ul class="item-list">${itemsHtml}</ul>
      <div class="order-actions">${actionHtml}</div>
      ${agentDetailsHtml}
      <p class="edit-msg small" style="color:red;"></p>
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
    eventSource.onmessage = function(event) {
      if (event.data === 'order_status_updated') {
        console.log("Received order update notification. Reloading orders...");
        loadOrders(); // Reload orders when notified
      }
    };
    eventSource.onerror = function() {
      console.error('Real-time connection failed.');
       // Optionally implement reconnection logic here
       eventSource.close();
        // setTimeout(connectToUserStream, 5000); // Try reconnecting after 5 seconds
    };
  }

  // Initial load
  loadOrders();
  connectToUserStream(); // Connect for real-time updates
});