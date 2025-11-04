let cart = [];
let editContext = null; 


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
  
  cart.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cart-item';
    const descriptionHtml = item.description ? `<br><small style="color: #555;">${item.description}</small>` : '';
    el.innerHTML = `
      <div>
        <strong>${item.productName}</strong>${descriptionHtml}
        <br>
        <span>Quantity: ${item.quantity} ${item.unit || ''}</span>
      </div>
      <button class="remove-from-cart-btn" data-id="${item.productId}" style="color:red; background:transparent; border:none; cursor:pointer;">Remove</button>
    `;
    cartItemsContainer.appendChild(el);
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';
    el.style.marginBottom = '10px';
  });
}

async function loadProducts(isUserLoggedIn) { 
  const res = await fetch('/api/public/products'); //
  const products = await res.json();
  const container = document.getElementById('products');
  container.innerHTML = '';
  
  products.forEach(p => {
    const el = document.createElement('div');
    el.className = 'product-card';
    const escapedName = p.name.replace(/"/g, '&quot;');
    const escapedDesc = (p.description || '').replace(/"/g, '&quot;');
    const escapedUnit = (p.unit || '').replace(/"/g, '&quot;');
    
    let cartControlsHtml = '';
    let unitHtml = ''; 
    
    if (isUserLoggedIn) {
      unitHtml = `<label> ${p.unit || ' ? '} </label>`;
      
      cartControlsHtml = `
        <input type="tel" maxlength="5" pattern="[0-9.]*" id="qty-${p._id}" style="width:100px;">
        <button 
          data-id="${p._id}" 
          data-name="${escapedName}" 
          data-unit="${escapedUnit}" 
          data-description="${escapedDesc}" 
          class="add-to-cart-btn">Add to Cart</button>
      `;
    }

    el.innerHTML = `
      <h3>${p.name} <span><div class="small">${p.description || ''}</div></span></h3>
      ${unitHtml} ${cartControlsHtml} `;
    container.appendChild(el);
  });

  if (isUserLoggedIn) {
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', ev => {
        const pid = ev.target.dataset.id;
        const pname = ev.target.dataset.name;
        const punit = ev.target.dataset.unit;
        const pdesc = ev.target.dataset.description;
        const qtyInput = document.getElementById(`qty-${pid}`);
        
        const qty = parseFloat(qtyInput.value) || 0; 

        if (qty <= 0) {
          document.getElementById('message').innerText = `Please enter a quantity greater than 0.`;
          setTimeout(() => { document.getElementById('message').innerText = ''; }, 2000);
          return; 
        }

        const existingItem = cart.find(item => item.productId === pid);
        if (existingItem) {
          existingItem.quantity = (parseFloat(existingItem.quantity) || 0) + qty;
        } else {
          cart.push({ productId: pid, productName: pname, quantity: qty, unit: punit, description: pdesc });
        }
        
        document.getElementById('message').innerText = `${pname} added to cart.`;
        setTimeout(() => { document.getElementById('message').innerText = ''; }, 2000);

        renderCart();
        
        qtyInput.value = "";
      });
    });
  }
}

document.getElementById('cart-section').addEventListener('click', (ev) => {
  if (ev.target.classList.contains('remove-from-cart-btn')) {
    const productIdToRemove = ev.target.dataset.id;
    cart = cart.filter(item => item.productId !== productIdToRemove);
    renderCart();
  }
});

// --- MODIFIED LOGIC START ---
document.getElementById('placeOrderBtn').addEventListener('click', async () => {
  const msg = document.getElementById('cart-message');
  
  if (cart.length === 0) {
    // Check if we are in edit mode.
    if (editContext && editContext.orderId) {
      // Cart is empty AND we are in edit mode. This now means "Delete this order."
      msg.innerText = 'Removing order...'; // <-- CHANGED
      
      try {
        const resp = await fetch(`/api/myorders/cancel/${editContext.orderId}`, { 
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await resp.json();

        if (resp.ok) {
          msg.innerText = data.message || 'Order removed successfully!'; // <-- CHANGED
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
        }
      } catch (error) {
        console.error("Error removing order:", error); // <-- CHANGED
        msg.innerText = 'An error occurred. Please try again.';
      }

    } else {
      // Cart is empty and we are NOT in edit mode (i.e., placing a new order).
      msg.innerText = 'Your cart is empty.';
    }
    return; // Stop further execution in either case.
  }
  // --- MODIFIED LOGIC END ---

  
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
  
  const resp = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body });
  const data = await resp.json();
  
  if (resp.ok) {
    msg.innerText = data.message || successMessage;
    cart = []; 
    
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
    if (!editContext) { 
      setTimeout(() => { window.location.href = '/login.html'; }, 1500);
    }
  }
});

function checkForEditOrder() {
  const orderDataString = sessionStorage.getItem('orderToEdit');
  if (orderDataString) {
    try {
      const orderData = JSON.parse(orderDataString);
      if (orderData.orderId && orderData.items) { 
        editContext = { orderId: orderData.orderId }; 
        cart = orderData.items.map(item => ({...item, quantity: parseFloat(item.quantity)}));
        
        document.getElementById('placeOrderBtn').innerText = 'Update Order';
        document.querySelector('.header h2').innerText = 'Edit Your Order';
        renderCart();
      }
    } catch (e) {
      console.error("Failed to parse order data from sessionStorage", e);
      sessionStorage.removeItem('orderToEdit'); // Clear corrupted data
    }
  }
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
  await loadProducts(isLoggedIn); 
  if (!isLoggedIn) {
    const cartSection = document.getElementById('cart-section');
    if (cartSection) cartSection.style.display = 'none';
  } else {
    checkForEditOrder(); 
  }
}

initializePage();