let cart = [];
let editContext = null;
let quantityLimits = [];

async function loadQuantityLimits() {
  try {
    const res = await fetch('/api/quantities');
    if (res.ok) {
      quantityLimits = await res.json();
    }
  } catch (e) {
    console.error('Error loading quantity limits', e);
  }
}

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


async function checkLoginStatus() {
  const userLinks = document.getElementById('user-links');
  const bookNowBtn = document.getElementById('book-now-btn');

  try {
    const res = await fetch('/api/user/profile');

    if (res.ok) {
      if (userLinks) userLinks.style.display = 'inline';
      if (bookNowBtn) bookNowBtn.style.display = 'none';
      return true;
    } else {

      if (userLinks) userLinks.style.display = 'none';
      if (bookNowBtn) bookNowBtn.style.display = 'inline';
      return false;
    }
  } catch (error) {
    console.error("Error checking login status:", error);
    if (userLinks) userLinks.style.display = 'none';
    if (bookNowBtn) bookNowBtn.style.display = 'inline';
    return false;
  }
}

function renderCart() {
  const cartSection = document.getElementById('cart-section');
  const cartItemsContainer = document.getElementById('cart-items');

  if (cart.length === 0) {
    // If cart is empty, still show the cart section IF we are in edit mode
    // This allows the user to see the "Update Order" button to finalize the deletion.
    if (editContext) {
      cartSection.style.display = 'block';
      cartItemsContainer.innerHTML = '<p style="text-align: center; color: #555;">Your cart is empty. Click "Update Order" to remove the order.</p>';
    } else {
      cartSection.style.display = 'none';
    }
    return;
  }

  cartSection.style.display = 'block';
  cartItemsContainer.innerHTML = '';

  cart.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.setAttribute('data-item-index', index);
    const descriptionHtml = item.description ? `<br><small style="color: #555;">${item.description}</small>` : '';
    el.innerHTML = `
      <div style="flex: 1;">
        <strong>${item.productName}</strong>${descriptionHtml}
        <br>
        <span class="quantity-display" data-index="${index}">
          Quantity: ${item.quantity} ${item.unit || ''}
        </span>
        <div class="quantity-edit" data-index="${index}" style="display: none;">
          <input type="tel" maxlength="5" pattern="[0-9.]*" class="edit-quantity-input" data-index="${index}" value="${item.quantity}" style="width: 80px; margin-right: 5px;">
          <span>${item.unit || ''}</span>
        </div>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
    <button class="edit-cart-btn" data-index="${index}" 
            style="width: auto; padding: 5px 15px; background-color: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
        Edit
    </button>

    <button class="save-edit-btn" data-index="${index}" 
            style="display: none; width: auto; padding: 5px 15px; background-color: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">
        Save
    </button>

    <button class="cancel-edit-btn" data-index="${index}" 
            style="display: none; width: auto; padding: 5px 15px; background-color: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">
        Cancel
    </button>

    <button id="rmbtn" class="remove-from-cart-btn" data-id="${item.productId}" 
            style="width: auto; padding: 5px 15px; background-color: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">
        X
    </button>
</div>
    `;
    cartItemsContainer.appendChild(el);
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';
    el.style.marginBottom = '10px';
  });

  // Add event listeners for edit, save, and cancel buttons
  document.querySelectorAll('.edit-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.dataset.index;
      toggleEditMode(index, true);
    });
  });

  document.querySelectorAll('.save-edit-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = e.target.dataset.index;
      await saveQuantityEdit(index);
    });
  });

  document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.dataset.index;
      toggleEditMode(index, false);
    });
  });
}

function toggleEditMode(index, isEditing) {
  const quantityDisplay = document.querySelector(`.quantity-display[data-index="${index}"]`);
  const quantityEdit = document.querySelector(`.quantity-edit[data-index="${index}"]`);
  const editBtn = document.querySelector(`.edit-cart-btn[data-index="${index}"]`);
  const saveBtn = document.querySelector(`.save-edit-btn[data-index="${index}"]`);
  const cancelBtn = document.querySelector(`.cancel-edit-btn[data-index="${index}"]`);

  if (isEditing) {
    quantityDisplay.style.display = 'none';
    quantityEdit.style.display = 'block';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';
  } else {
    quantityDisplay.style.display = 'inline';
    quantityEdit.style.display = 'none';
    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    // Reset input value to original
    const input = document.querySelector(`.edit-quantity-input[data-index="${index}"]`);
    input.value = cart[index].quantity;
  }
}

async function saveQuantityEdit(index) {
  const input = document.querySelector(`.edit-quantity-input[data-index="${index}"]`);
  const newQuantity = parseFloat(input.value);

  if (!newQuantity || newQuantity <= 0) {
    alert('Please enter a valid quantity greater than 0');
    return;
  }

  const item = cart[index];
  const limitObj = quantityLimits.find(q => q.name === item.unit);
  if (limitObj && newQuantity > limitObj.limit) {
    alert(`Limit exceeded: You can only order up to ${limitObj.limit} ${item.unit}.`);
    return;
  }
  const oldQuantity = item.quantity;

  // Update the cart array
  cart[index].quantity = newQuantity;

  // If in edit mode (editing an existing order), just update local cart
  if (editContext) {
    toggleEditMode(index, false);
    renderCart();
    return;
  }

  // If in normal mode, update the database
  try {
    const res = await fetch('/api/cart/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: item.productId,
        quantity: newQuantity
      })
    });

    if (res.ok) {
      toggleEditMode(index, false);
      renderCart();
      const msg = document.getElementById('message');
      msg.innerText = `Quantity updated for ${item.productName}`;
      setTimeout(() => { msg.innerText = ''; }, 2000);
    } else {
      // Revert on error
      cart[index].quantity = oldQuantity;
      alert('Failed to update quantity. Please try again.');
    }
  } catch (e) {
    console.error('Error updating quantity:', e);
    cart[index].quantity = oldQuantity;
    alert('Error updating quantity. Please check your connection.');
  }
}

// Helper to clean up session and redirect
function cleanupAndRedirect() {
  cart = [];
  editContext = null;
  sessionStorage.removeItem('orderToEdit');
  window.location.href = '/myorders.html';
}

// New function to connect to SSE stream and monitor order status
function connectToUserOrderStream() {
  // Only connect if the user is logged in (check if logout button exists in the DOM)
  if (!document.getElementById('logout-btn')) {
    return;
  }

  const eventSource = new EventSource('/api/myorders/stream');

  eventSource.onmessage = async function (event) {
    // Only trigger the logic if we are currently in an edit context
    if (event.data === 'order_status_updated' && editContext && editContext.orderId) {
      console.log("Received status update while editing. Validating order status...");

      try {
        // FIX: Add timestamp to URL to prevent browser caching of the 'Paused' state
        const res = await fetch(`/api/myorders?t=${new Date().getTime()}`, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });

        if (!res.ok) throw new Error('Failed to fetch orders.');

        const orders = await res.json();
        const currentOrder = orders.find(o => o._id === editContext.orderId);

        if (!currentOrder) {
          // Case 1: Order was deleted/removed entirely
          alert('The order you were editing has been removed.');
          cleanupAndRedirect();
          return;
        }

        // FIX: Simplified Logic. 
        // Server only allows editing 'Ordered' or 'Paused'. 
        // If status is ANYTHING else (Confirmed, Cancelled, Rate Approved, etc.), terminate session.
        if (currentOrder.status !== 'Ordered' && currentOrder.status !== 'Paused') {
          alert(`Order status changed to ${currentOrder.status} by Staff/Admin. Your editing session must end.`);
          cleanupAndRedirect();
          return;
        }

        const msg = document.getElementById('cart-message');
        // if(msg) {
        //    msg.innerText = `Current Status: ${currentOrder.status}. (Admin/Staff may have updated items).`;
        msg.style.color = 'orange';
        // }

      } catch (error) {
        console.error("Error connecting or checking status:", error);
        const msg = document.getElementById('cart-message');
        if (msg) msg.innerText = 'Warning: Lost real-time sync. Please confirm status before saving.';
      }
    }
  };

  eventSource.onerror = function (error) {
    console.error('SSE Error:', error);
    eventSource.close();
  };
}

async function loadProducts(isUserLoggedIn) {
  showLoading('Loading products...');
  const res = await fetch('/api/public/products'); //
  const products = await res.json();
  const container = document.getElementById('products');
  container.innerHTML = '';
  hideLoading();

  products.forEach(p => {
    const el = document.createElement('div');
    el.className = 'amazon-product-card';
    const escapedName = p.name.replace(/"/g, '&quot;');
    const escapedDesc = (p.description || '').replace(/"/g, '&quot;');
    const escapedUnit = (p.unit || '').replace(/"/g, '&quot;');

    let cartControlsHtml = '';

    if (isUserLoggedIn) {
      cartControlsHtml = `
        <div class="product-actions">
          <input type="tel" maxlength="5" pattern="[0-9.]*" id="qty-${p._id}" class="qty-input">
          <button 
            data-id="${p._id}" 
            data-name="${escapedName}" 
            data-unit="${escapedUnit}" 
            data-description="${escapedDesc}" 
            class="add-to-cart-btn add-btn">Add to Cart</button>
        </div>
      `;
    }

    // Generate image HTML
    let imageHtml = '';
    if (p.imageData) {
      imageHtml = `<img src="${p.imageData}" alt="${escapedName}" onerror="this.parentElement.innerHTML='<span class=\\'placeholder-icon\\'>🧱</span>'">`;
    } else {
      imageHtml = `<span class="placeholder-icon">🧱</span>`;
    }

    el.innerHTML = `
      <div class="product-image">
        ${imageHtml}
      </div>
      <div class="product-name">${p.name}</div>
      <div class="product-desc">${p.description || ''}</div>
      <div class="product-unit">${p.unit || ''}</div>
      ${cartControlsHtml}
    `;
    container.appendChild(el);
  });


  if (isUserLoggedIn) {
    // Inside loadProducts function...
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', async ev => { // Make async
        const pid = ev.target.dataset.id;
        const pname = ev.target.dataset.name;
        const punit = ev.target.dataset.unit;
        const pdesc = ev.target.dataset.description;
        const qtyInput = document.getElementById(`qty-${pid}`);

        const qty = parseFloat(qtyInput.value) || 0;

        if (qty <= 0) {
          alert("Please enter a valid quantity.");
          return;
        }

        const limitObj = quantityLimits.find(q => q.name === punit);
        if (limitObj) {
          const existingItem = cart.find(item => item.productId === pid);
          const currentQty = existingItem ? existingItem.quantity : 0;
          if (currentQty + qty > limitObj.limit) {
            alert(`Limit exceeded: You can only order up to ${limitObj.limit} ${punit}.\nYou have ${currentQty} ${punit} in cart.`);
            return;
          }
        }

        // If in Edit Mode (editContext exists), add to local cart array
        if (editContext) {
          const existingIndex = cart.findIndex(item => item.productId === pid);
          if (existingIndex > -1) {
            // Add to existing quantity
            cart[existingIndex].quantity += qty;
          } else {
            // Add new item to local cart
            cart.push({
              productId: pid,
              productName: pname,
              quantity: qty,
              unit: punit,
              description: pdesc
            });
          }
          renderCart();
          document.getElementById('message').innerText = `${pname} added to order.`;
          setTimeout(() => { document.getElementById('message').innerText = ''; }, 2000);
          qtyInput.value = "";
          return;
        }

        // Normal mode: use server API
        try {
          const res = await fetch('/api/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: pid,
              productName: pname,
              quantity: qty,
              unit: punit,
              description: pdesc
            })
          });

          if (res.ok) {
            const data = await res.json();
            // Update local cart with data returned from server to stay in sync
            // Or simply refetch the cart:
            await fetchPersistentCart();

            document.getElementById('message').innerText = `${pname} added to cart.`;
            setTimeout(() => { document.getElementById('message').innerText = ''; }, 2000);
            qtyInput.value = "";
          } else {
            alert('Failed to save to cart. Please check connection.');
          }
        } catch (e) {
          console.error(e);
        }
      });
    });
  }
}

document.getElementById('cart-section').addEventListener('click', async (ev) => {
  if (ev.target.classList.contains('remove-from-cart-btn')) {
    const productIdToRemove = ev.target.dataset.id;
    // If in Edit Mode (editContext exists), we just manipulate local array
    if (editContext) {
      cart = cart.filter(item => item.productId !== productIdToRemove);
      renderCart();
      return;
    }
    // If in Normal Mode, remove from DB
    try {
      const res = await fetch(`/api/cart/${productIdToRemove}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchPersistentCart(); // Refresh view from DB
      }
    } catch (e) {
      console.error("Error removing item", e);
    }
  }
});

// --- MODIFIED LOGIC START ---
document.getElementById('placeOrderBtn').addEventListener('click', async () => {
  const msg = document.getElementById('cart-message');
  const placeOrderBtn = document.getElementById('placeOrderBtn');

  // Prevent duplicate submissions - disable button immediately
  if (placeOrderBtn.disabled) {
    return; // Already processing, ignore click
  }

  // Store original button text and disable the button
  const originalBtnText = placeOrderBtn.innerText;
  placeOrderBtn.disabled = true;
  placeOrderBtn.style.opacity = '0.6';
  placeOrderBtn.style.cursor = 'not-allowed';

  if (cart.length === 0) {
    // Check if we are in edit mode.
    if (editContext && editContext.orderId) {
      // Cart is empty AND we are in edit mode. This now means "Delete this order."
      msg.innerText = 'Removing order...'; // <-- CHANGED
      placeOrderBtn.innerText = 'Removing...';

      try {
        const resp = await fetch(`/api/myorders/cancel/${editContext.orderId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await resp.json();

        if (resp.ok) {
          msg.innerText = data.message || 'Order removed successfully!'; // <-- CHANGED
          document.getElementById('cancelEditBtn').style.display = 'none';
          cart = [];
          editContext = null;
          sessionStorage.removeItem('orderToEdit');

          // Redirect to myorders page after a short delay
          setTimeout(() => {
            window.location.href = '/myorders.html';
          }, 2000);

        } else {
          // Show specific error from server, or a generic one
          msg.innerText = data.error || 'Failed to remove order.'; // <-- CHANGED
          // Re-enable button on error
          placeOrderBtn.disabled = false;
          placeOrderBtn.style.opacity = '1';
          placeOrderBtn.style.cursor = 'pointer';
          placeOrderBtn.innerText = originalBtnText;
        }
      } catch (error) {
        console.error("Error removing order:", error); // <-- CHANGED
        msg.innerText = 'An error occurred. Please try again.';
        // Re-enable button on error
        placeOrderBtn.disabled = false;
        placeOrderBtn.style.opacity = '1';
        placeOrderBtn.style.cursor = 'pointer';
        placeOrderBtn.innerText = originalBtnText;
      }

    } else {
      // Cart is empty and we are NOT in edit mode (i.e., placing a new order).
      msg.innerText = 'Your cart is empty.';
      // Re-enable button
      placeOrderBtn.disabled = false;
      placeOrderBtn.style.opacity = '1';
      placeOrderBtn.style.cursor = 'pointer';
      placeOrderBtn.innerText = originalBtnText;
    }
    return; // Stop further execution in either case.
  }
  // --- MODIFIED LOGIC END ---

  // Show loading state on button
  placeOrderBtn.innerText = editContext ? 'Updating...' : 'Placing Order...';

  let endpoint, method, body, successMessage, failureMessage;

  if (editContext && editContext.orderId) {
    endpoint = '/api/myorders/edit'; //
    method = 'PUT';
    body = JSON.stringify({
      orderId: editContext.orderId,
      updatedItems: cart.map(item => ({ productId: item.productId, quantity: item.quantity }))
    });
    successMessage = 'Order updated successfully!';
    failureMessage = 'Failed to update order.';
  } else {
    endpoint = '/api/bulk-order'; //
    method = 'POST';
    body = JSON.stringify({ items: cart });
    successMessage = 'Order placed successfully!';
    failureMessage = 'Order failed. Please login.';
  }

  try {
    const resp = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body });
    const data = await resp.json();

    if (resp.ok) {
      msg.innerText = data.message || successMessage;
      placeOrderBtn.innerText = 'Success!';
      document.getElementById('cancelEditBtn').style.display = 'none';
      cart = [];

      // Clear the server-side cart as well
      try {
        await fetch('/api/cart/clear', { method: 'DELETE' });
      } catch (e) {
        console.error('Error clearing cart:', e);
      }

      if (editContext) {
        editContext = null;
        sessionStorage.removeItem('orderToEdit');
        setTimeout(() => {
          window.location.href = '/myorders.html';
        }, 2000);
      } else {
        setTimeout(() => {
          window.location.href = '/myorders.html';
        }, 1000);
      }
    } else {
      msg.innerText = data.error || failureMessage;
      // Re-enable button on error
      placeOrderBtn.disabled = false;
      placeOrderBtn.style.opacity = '1';
      placeOrderBtn.style.cursor = 'pointer';
      placeOrderBtn.innerText = originalBtnText;
      // Only redirect to login if it's an authentication error (401)
      if (!editContext && resp.status === 401) {
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
      }
    }
  } catch (error) {
    console.error("Error placing order:", error);
    msg.innerText = 'Network error. Please check your connection and try again.';
    // Re-enable button on network error
    placeOrderBtn.disabled = false;
    placeOrderBtn.style.opacity = '1';
    placeOrderBtn.style.cursor = 'pointer';
    placeOrderBtn.innerText = originalBtnText;
  }
});

function checkForEditOrder() {
  const orderDataString = sessionStorage.getItem('orderToEdit');
  if (orderDataString) {
    try {
      const orderData = JSON.parse(orderDataString);
      if (orderData.orderId && orderData.items) {
        editContext = { orderId: orderData.orderId };
        cart = orderData.items.map(item => ({ ...item, quantity: parseFloat(item.quantity) }));

        const placeOrderBtn = document.getElementById('placeOrderBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const pageTitle = document.querySelector('.page-title');

        if (placeOrderBtn) placeOrderBtn.innerText = 'Update Order';
        if (cancelEditBtn) {
          cancelEditBtn.addEventListener('click', () => {
            editContext = null;
            sessionStorage.removeItem('orderToEdit');
            window.location.href = '/myorders.html';
          });
          cancelEditBtn.style.display = 'inline-block';
        }
        if (pageTitle) pageTitle.innerText = '✏️ Edit Your Order';

        renderCart();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to parse order data from sessionStorage", e);
      sessionStorage.removeItem('orderToEdit'); // Clear corrupted data
      return false;
    }
  }
  return false;
}

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

async function initializePage() {
  const isLoggedIn = await checkLoginStatus();
  setupLogoutButton();
  await loadQuantityLimits();
  await loadProducts(isLoggedIn);
  connectToUserOrderStream();
  if (!isLoggedIn) {
    const cartSection = document.getElementById('cart-section');
    if (cartSection) cartSection.style.display = 'none';
  } else {
    // Check if we are editing a specific order from session storage first
    const isEditing = checkForEditOrder(); // NOTE: Modify checkForEditOrder to return true/false

    // If NOT editing, fetch the persistent cart from DB
    if (!isEditing) {
      await fetchPersistentCart();
    }
  }
}

// New function to get cart from server
async function fetchPersistentCart() {
  try {
    showLoading('Loading cart...');
    const res = await fetch('/api/cart');
    if (res.ok) {
      const serverItems = await res.json();
      // Map server items to the local cart structure
      cart = serverItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        description: item.description
      }));
      renderCart();
    }
    hideLoading();
  } catch (err) {
    console.error("Failed to load persistent cart", err);
    hideLoading();
  }
}

initializePage();

// window.addEventListener('beforeunload', function (e) {
//   if (cart.length > 0) {
//     e.preventDefault();
//     e.returnValue = '';
//   }
// });