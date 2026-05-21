import { apiRequest } from './http';

export const getPublicProducts = () => apiRequest('/api/public/products');
export const getUserProfile = () => apiRequest('/api/user/profile');
export const updateUserProfile = (data) =>
  apiRequest('/api/user/profile', { method: 'PUT', body: JSON.stringify(data) });
export const getCart = () => apiRequest('/api/cart');
export const addToCart = (productId, productName, quantity, unit, description) =>
  apiRequest('/api/cart/add', {
    method: 'POST',
    body: JSON.stringify({ productId, productName, quantity, unit, description }),
  });
export const updateCartItem = (productId, quantity) =>
  apiRequest('/api/cart/update', { method: 'PUT', body: JSON.stringify({ productId, quantity }) });
export const removeFromCart = (productId) =>
  apiRequest(`/api/cart/${productId}`, { method: 'DELETE' });
export const clearCart = () => apiRequest('/api/cart/clear', { method: 'DELETE' });
export const placeOrder = (items) =>
  apiRequest('/api/bulk-order', { method: 'POST', body: JSON.stringify({ items }) });
export const getMyOrders = () => apiRequest('/api/myorders');
export const editOrder = (orderId, updatedItems) =>
  apiRequest('/api/myorders/edit', {
    method: 'PUT',
    body: JSON.stringify({ orderId, updatedItems }),
  });
export const cancelOrder = (orderId) =>
  apiRequest(`/api/myorders/cancel/${orderId}`, { method: 'DELETE' });
export const getDeliveryHistory = (orderId) =>
  apiRequest(`/api/myorders/${orderId}/history`);
export const getLocations = () => apiRequest('/api/locations');
export const getActiveOrderQuantities = () =>
  apiRequest('/api/user/active-order-quantities');
