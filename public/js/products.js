// Global variables
let cart = [];
let editContext = null; // Will store orderIds if we are in "edit" mode

// Function to render/update the cart display
function renderCart() {
  const cartSection = document.getElementById('cart-section');
  const cartItemsContainer = document.getElementById('cart-items');
  
  if (cart.length === 0) {
    cartSection.style.display = 'none';
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

// Function to load products from the server
async function loadProducts() {
  const res = await fetch('/api/public/products'); 
  const products = await res.json();
  const container = document.getElementById('products');
  container.innerHTML = '';
  
  products.forEach(p => {
    const el = document.createElement('div');
    el.className = 'product-card';
    const escapedName = p.name.replace(/"/g, '&quot;');
    const escapedDesc = (p.description || '').replace(/"/g, '&quot;');
    const escapedUnit = (p.unit || '').replace(/"/g, '&quot;');
    el.innerHTML = `
      <h3>${p.name} <span><div class="small">${p.description || ''}</div></span></h3>
      <label> ${p.unit || ' ? '} </label>
      
      <input type="number" min="0" step="0.1" value="" id="qty-${p._id}" style="width:90px;">
      
      <button 
        data-id="${p._id}" 
        data-name="${escapedName}" 
        data-unit="${escapedUnit}" 
        data-description="${escapedDesc}" 
        class="add-to-cart-btn">Add to Cart</button>
    `;
    container.appendChild(el);
  });

  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', ev => {
      const pid = ev.target.dataset.id;
      const pname = ev.target.dataset.name;
      const punit = ev.target.dataset.unit;
      const pdesc = ev.target.dataset.description;
      const qtyInput = document.getElementById(`qty-${pid}`);
      
      // This will correctly parse "" as NaN, which || 0 handles.
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
      
      // CHANGE 2: Reset input value to empty string
      qtyInput.value = "";
    });
  });
}

// Event Listener for Removing Items from Cart
document.getElementById('cart-section').addEventListener('click', (ev) => {
  if (ev.target.classList.contains('remove-from-cart-btn')) {
    const productIdToRemove = ev.target.dataset.id;
    cart = cart.filter(item => item.productId !== productIdToRemove);
    renderCart();
  }
});

// Event listener for Place/Update Order button
document.getElementById('placeOrderBtn').addEventListener('click', async () => {
  const msg = document.getElementById('cart-message');
  if (cart.length === 0) {
    msg.innerText = editContext ? 'Cannot update with an empty cart. Please add items.' : 'Your cart is empty.';
    return;
  }
  
  let endpoint, method, body, successMessage, failureMessage;

  // Check if we are in "edit" mode
  if (editContext && editContext.orderId) { 
    endpoint = '/api/myorders/edit';
    method = 'PUT';
    body = JSON.stringify({
        orderId: editContext.orderId, 
        updatedItems: cart.map(item => ({ productId: item.productId, quantity: item.quantity }))
    });
    successMessage = 'Order updated successfully!';
    failureMessage = 'Failed to update order.';
  } else {
    // This is the original logic for placing a new order
    endpoint = '/api/bulk-order';
    method = 'POST';
    body = JSON.stringify({ items: cart });
    successMessage = 'Order placed successfully!';
    failureMessage = 'Order failed. Please login.';
  }
  
  const resp = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body });
  const data = await resp.json();
  
  if (resp.ok) {
    msg.innerText = data.message || successMessage;
    cart = []; // Clear the cart
    
    // If we were editing, clear the context and sessionStorage
    if (editContext) {
        editContext = null;
        sessionStorage.removeItem('orderToEdit');
        // Redirect back to my orders page after success
        setTimeout(() => {
            window.location.href = '/myorders.html';
        }, 2000);
    } else {
       // This is for a NEW order. Redirect to myorders.html
       setTimeout(() => {
        window.location.href = '/myorders.html';
       }, 1000); // 1 second delay to read the success message
    }
  } else {
    msg.innerText = data.error || failureMessage;
    if (!editContext) { // Only redirect to login for new orders
      setTimeout(() => { window.location.href = '/login.html'; }, 1500);
    }
  }
});


// Checks sessionStorage for an order to edit
function checkForEditOrder() {
  const orderDataString = sessionStorage.getItem('orderToEdit');
  if (orderDataString) {
    try {
      const orderData = JSON.parse(orderDataString);
      if (orderData.orderId && orderData.items) { 
        // We are in edit mode. Populate the cart and context.
        editContext = { orderId: orderData.orderId }; 
        cart = orderData.items.map(item => ({...item, quantity: parseFloat(item.quantity)}));
        
        // Update UI
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

// Initial page load logic
async function initializePage() {
  await loadProducts(); // Load all products first
  checkForEditOrder();  // Then check if we need to populate the cart for editing
}

initializePage();