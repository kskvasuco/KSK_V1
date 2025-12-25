// API service layer for all backend calls
const API_BASE = '';  // Empty for same-origin

// Helper for API calls
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Authentication APIs
export const loginOrRegister = (mobile, password) =>
  apiCall('/api/user/login-or-register', {
    method: 'POST',
    body: JSON.stringify({ mobile, password }),
  });

export const getUserProfile = () =>
  apiCall('/api/user/profile');

export const updateUserProfile = (data) =>
  apiCall('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const logout = () =>
  apiCall('/api/logout', { method: 'POST' });

// Product APIs
export const getPublicProducts = () =>
  apiCall('/api/public/products');

// Cart APIs
export const getCart = () =>
  apiCall('/api/cart');

export const addToCart = (productId, productName, quantity, unit, description) =>
  apiCall('/api/cart/add', {
    method: 'POST',
    body: JSON.stringify({ productId, productName, quantity, unit, description }),
  });

export const updateCartItem = (productId, quantity) =>
  apiCall('/api/cart/update', {
    method: 'PUT',
    body: JSON.stringify({ productId, quantity }),
  });

export const removeFromCart = (productId) =>
  apiCall(`/api/cart/${productId}`, { method: 'DELETE' });

export const clearCart = () =>
  apiCall('/api/cart/clear', { method: 'DELETE' });

// Order APIs
export const placeOrder = (items) =>
  apiCall('/api/bulk-order', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });

export const getMyOrders = () =>
  apiCall('/api/myorders');

export const editOrder = (orderId, updatedItems) =>
  apiCall('/api/myorders/edit', {
    method: 'PUT',
    body: JSON.stringify({ orderId, updatedItems }),
  });

export const cancelOrder = (orderId) =>
  apiCall(`/api/myorders/cancel/${orderId}`, { method: 'DELETE' });

// Location APIs
export const getLocations = () =>
  apiCall('/api/locations');

// Check login status
export const checkLoginStatus = async () => {
  try {
    await getUserProfile();
    return true;
  } catch {
    return false;
  }
};

// Get product quantities in active orders (for limit checking)
export const getActiveOrderQuantities = () =>
  apiCall('/api/user/active-order-quantities');

