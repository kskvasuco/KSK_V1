import { apiRequest } from './http';

const adminApi = {
  getOrders: () => apiRequest('/api/admin/orders').then((orders) => ({ orders })),
  updateOrderStatus: (orderId, status, data = {}) =>
    apiRequest('/api/admin/orders/update-status', {
      method: 'PATCH',
      body: JSON.stringify({ orderId, status, reason: data.pauseReason, ...data }),
    }),
  updateOrder: (orderId, updates) =>
    apiRequest(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteOrder: (orderId) =>
    apiRequest(`/api/admin/orders/${orderId}`, { method: 'DELETE' }),
  getDeletedOrders: () =>
    apiRequest('/api/admin/deleted-orders').then((orders) => ({ orders })),
  restoreOrder: (orderId) =>
    apiRequest(`/api/admin/orders/${orderId}/restore`, { method: 'POST' }),
  permanentDeleteOrder: (orderId) =>
    apiRequest(`/api/admin/orders/${orderId}/permanent`, { method: 'DELETE' }),
  getOrderCounts: () => apiRequest('/api/admin/order-counts'),
  addAdjustment: (orderId, description, amount, type, date, note) =>
    apiRequest('/api/admin/orders/adjustments', {
      method: 'POST',
      body: JSON.stringify({ orderId, description, amount, type, date, note }),
    }),
  removeAdjustment: (orderId, adjustmentId) =>
    apiRequest('/api/admin/orders/remove-adjustment', {
      method: 'PATCH',
      body: JSON.stringify({ orderId, adjustmentId }),
    }),
  assignAgent: (orderId, agentName, agentMobile, agentDescription, agentAddress, dispatchDate) =>
    apiRequest('/api/admin/orders/assign-agent', {
      method: 'PATCH',
      body: JSON.stringify({ orderId, agentName, agentMobile, agentDescription, agentAddress, dispatchDate }),
    }),
  recordDelivery: (orderId, deliveries, rent, deliveryDate) =>
    apiRequest('/api/admin/orders/record-delivery', {
      method: 'POST',
      body: JSON.stringify({ orderId, deliveries, rent: rent || 0, deliveryDate: deliveryDate || null }),
    }),
  getDeliveryHistory: (orderId) => apiRequest(`/api/admin/orders/${orderId}/history`),
  getProducts: () =>
    apiRequest('/api/products').then((data) => ({
      products: data.map((p) => ({ ...p, image: p.imageData || p.image })),
    })),
  createProduct: (productData) => {
    const backendData = { ...productData, imageData: productData.image };
    delete backendData.image;
    return apiRequest('/api/products', { method: 'POST', body: JSON.stringify(backendData) });
  },
  updateProduct: (productId, productData) => {
    const backendData = { ...productData, imageData: productData.image };
    delete backendData.image;
    return apiRequest(`/api/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(backendData),
    });
  },
  deleteProduct: (productId) =>
    apiRequest(`/api/products/${productId}`, { method: 'DELETE' }),
  toggleProductVisibility: (productId, isVisible) =>
    apiRequest(`/api/products/${productId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ isVisible }),
    }),
  reorderProducts: (orders) =>
    apiRequest('/api/products/reorder', { method: 'PATCH', body: JSON.stringify({ orders }) }),
  editOrder: (orderId, updatedItems) =>
    apiRequest('/api/admin/orders/edit', {
      method: 'PUT',
      body: JSON.stringify({ orderId, updatedItems }),
    }),
  addCustomItem: (orderId, item) =>
    apiRequest('/api/admin/orders/add-custom-item', {
      method: 'POST',
      body: JSON.stringify({ orderId, ...item }),
    }),
  requestRateChange: (orderId, updatedItems) =>
    apiRequest('/api/admin/orders/request-rate-change', {
      method: 'PATCH',
      body: JSON.stringify({ orderId, updatedItems }),
    }),
  createOrderForUser: (userId, items, orderDate) =>
    apiRequest('/api/admin/orders/create-for-user', {
      method: 'POST',
      body: JSON.stringify({ userId, items, orderDate }),
    }),
  getUsers: () => apiRequest('/api/admin/visited-users'),
  getAllUsers: () => apiRequest('/api/admin/all-users'),
  getUser: (userId) => apiRequest(`/api/admin/users/${userId}`),
  createUser: (userData) =>
    apiRequest('/api/admin/create-user', { method: 'POST', body: JSON.stringify(userData) }),
  updateUser: (userId, userData) =>
    apiRequest(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(userData) }),
  blockUser: (userId, isBlocked) =>
    apiRequest(`/api/admin/users/${userId}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ isBlocked }),
    }),
  deleteUser: (userId) =>
    apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' }),
  getLocations: () => apiRequest('/api/locations'),
  verifyPassword: (password) =>
    apiRequest('/api/admin/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  getPaymentSettings: () => apiRequest('/api/admin/payment-settings'),
  createPaymentSetting: (data) =>
    apiRequest('/api/admin/payment-settings', { method: 'POST', body: JSON.stringify(data) }),
  updatePaymentSetting: (id, data) =>
    apiRequest('/api/admin/payment-settings', {
      method: 'POST',
      body: JSON.stringify({ id, ...data }),
    }),
  deletePaymentSetting: (id) =>
    apiRequest(`/api/admin/payment-settings/${id}`, { method: 'DELETE' }),
  getDeliveryAgents: () => apiRequest('/api/admin/delivery-agents'),
  getAgentRecords: (agentId) => apiRequest(`/api/admin/delivery-records/${agentId}`),
  updateDeliveryAgent: (deliveryIds, agentName, agentMobile, agentDescription, agentAddress) =>
    apiRequest('/api/admin/deliveries/update-agent', {
      method: 'PATCH',
      body: JSON.stringify({ deliveryIds, agentName, agentMobile, agentDescription, agentAddress }),
    }),
  confirmDeliveryBatch: (orderId, batchDate, amount, isNull, paymentMode) => {
    const params = new URLSearchParams({
      orderId,
      batchDate,
      receivedAmount: amount || 0,
      isNullAction: isNull ? 'true' : '',
      paymentMode: paymentMode || '',
    });
    return apiRequest(`/api/admin/delivery-batches/confirm?${params}`);
  },
  getAppController: () => apiRequest('/api/admin/app-controller'),
  updateAppController: (updates) =>
    apiRequest('/api/admin/app-controller', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  getAnalytics: () => apiRequest('/api/admin/analytics'),
  requestOtp: (email) =>
    apiRequest('/api/admin/request-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email, otp, newPassword) =>
    apiRequest('/api/admin/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    }),
  resetProfilePassword: (email, otp, newPassword) =>
    apiRequest('/api/admin/reset-profile-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    }),
  resetUsername: (email, otp, newUsername) =>
    apiRequest('/api/admin/reset-username', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newUsername }),
    }),
  getLedgerSummary: (params = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return apiRequest(`/api/admin/ledger/summary?${searchParams}`);
  },
  getLedgerCustomers: (params = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return apiRequest(`/api/admin/ledger/customers?${searchParams}`);
  },
  getCustomerLedger: (userId) => apiRequest(`/api/admin/ledger/customer/${userId}`),
  addLedgerTransaction: (data) =>
    apiRequest('/api/admin/ledger/transaction', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteLedgerTransaction: (transactionId) =>
    apiRequest(`/api/admin/ledger/transaction/${transactionId}`, { method: 'DELETE' }),
  syncAllLedgers: () => apiRequest('/api/admin/ledger/sync-all', { method: 'POST' }),
  addToLedger: (userId, ledgerType) =>
    apiRequest('/api/admin/ledger/add-to-ledger', {
      method: 'POST',
      body: JSON.stringify({ userId, ledgerType }),
    }),
  switchLedgerType: (userId, ledgerType) =>
    apiRequest('/api/admin/ledger/switch-type', {
      method: 'POST',
      body: JSON.stringify({ userId, ledgerType }),
    }),
  removeFromLedger: (userId) =>
    apiRequest(`/api/admin/ledger/remove-from-ledger/${userId}`, {
      method: 'DELETE',
    }),
  getVisibleProducts: () => apiRequest('/api/admin/products/visible'),
};

export default adminApi;
