// staffApi.js - Dedicated API service for staff
class StaffAPI {
    // Authentication
    async login(username, password) {
        const res = await fetch('/api/staff/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error('Login failed');
        return await res.json();
    }

    async logout() {
        const res = await fetch('/api/staff/logout', {
            method: 'POST',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Logout failed');
        return await res.json();
    }

    async checkSession() {
        const res = await fetch('/api/staff/check', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Not authenticated');
        return await res.json();
    }

    // Order Management (Shared with Admin)
    async getOrders() {
        const res = await fetch('/api/admin/orders', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { orders: data };
    }

    async updateOrderStatus(orderId, status, data = {}) {
        const res = await fetch('/api/admin/orders/update-status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, status, reason: data.pauseReason, ...data })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Status update failed');
        }
        return await res.json();
    }

    // Adjustment Management (Shared with Admin)
    async addAdjustment(orderId, description, amount, type) {
        const res = await fetch('/api/admin/orders/adjustments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, description, amount, type })
        });
        if (!res.ok) throw new Error('Failed to add adjustment');
        return await res.json();
    }

    // Use admin remove adjustment endpoint (if staff are allowed, which they are via requireAdminOrStaff)
    async removeAdjustment(orderId, adjustmentId) {
        const res = await fetch('/api/admin/orders/remove-adjustment', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, adjustmentId })
        });
        if (!res.ok) throw new Error('Failed to remove adjustment');
        return await res.json();
    }

    // Dispatch and Delivery Management
    async assignAgent(orderId, agentName, agentMobile, agentDescription, agentAddress, rent) {
        const res = await fetch('/api/admin/orders/assign-agent', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, agentName, agentMobile, agentDescription, agentAddress, rent })
        });
        if (!res.ok) throw new Error('Failed to assign agent');
        return await res.json();
    }

    async recordDelivery(orderId, deliveries) {
        const res = await fetch('/api/admin/orders/record-delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, deliveries })
        });
        if (!res.ok) throw new Error('Failed to record delivery');
        return await res.json();
    }

    async getDeliveryHistory(orderId) {
        const res = await fetch(`/api/admin/orders/${orderId}/history`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch delivery history');
        return await res.json();
    }

    async confirmDeliveryBatch(orderId, batchDate, amount, isNull, paymentMode) {
        const params = new URLSearchParams({
            orderId,
            batchDate,
            receivedAmount: amount || 0,
            isNullAction: isNull ? 'true' : '',
            paymentMode: paymentMode || ''
        });
        const res = await fetch(`/api/admin/delivery-batches/confirm?${params.toString()}`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to confirm delivery batch');
        return await res.json();
    }

    async updateExpectedAmount(orderId, batchDate, expectedAmount) {
        const res = await fetch('/api/admin/delivery-batches/expected-amount', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, batchDate, expectedAmount })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update expected amount');
        return data;
    }

    async updateAgentCharge(orderId, batchDate, chargeAmount) {
        const res = await fetch('/api/admin/delivery-batches/agent-charge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, batchDate, chargeAmount })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update agent charge');
        return data;
    }

    // Product Management (Shared - Read Only mainly, but endpoint exists)
    async getProducts() {
        // Staff likely uses the same product endpoint
        const res = await fetch('/api/products', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Map imageData to image for frontend consistency
        const mappedProducts = data.map(p => ({
            ...p,
            image: p.imageData || p.image
        }));
        return { products: mappedProducts };
    }

    // User Management (Shared)
    async getUsers() {
        const res = await fetch('/api/admin/all-users', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to get users');
        return await res.json();
    }

    async getAllUsers() {
        const res = await fetch('/api/admin/all-users', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to get all users');
        return await res.json();
    }

    async getUser(userId) {
        const res = await fetch(`/api/admin/users/${userId}`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to get user');
        return await res.json();
    }

    async createUser(userData) {
        const res = await fetch('/api/admin/create-user', { // Reusing admin create-user endpoint if permitted, or staff specific
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(userData)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || err.error || 'Failed to create user');
        }
        return await res.json();
    }

    async updateUser(userId, userData) {
        const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(userData)
        });
        if (!res.ok) throw new Error('Failed to update user');
        return await res.json();
    }

    // Create Order (Shared logic)
    async createOrder(userId, items) {
        const res = await fetch('/api/admin/orders/create-for-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId, items })
        });
        if (!res.ok) throw new Error('Failed to create order');
        return await res.json();
    }

    async requestRateChangeForNewOrder(userId, items) {
        const res = await fetch('/api/admin/orders/create-for-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId, items, status: 'Rate Requested' })
        });
        if (!res.ok) throw new Error('Failed to request rate change');
        return await res.json();
    }

    async editOrder(orderId, updatedItems) {
        const res = await fetch('/api/admin/orders/edit', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, updatedItems })
        });
        if (!res.ok) throw new Error('Failed to edit order');
        return await res.json();
    }

    async requestRateChange(orderId, updatedItems) {
        const res = await fetch('/api/admin/orders/request-rate-change', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, updatedItems })
        });
        if (!res.ok) throw new Error('Failed to request rate change');
        return await res.json();
    }
    async getLocations() {
        const res = await fetch('/api/locations');
        if (!res.ok) throw new Error('Failed to get locations');
        return await res.json();
    }

    async deleteDispatchBatch(orderId, dispatchId) {
        const res = await fetch(`/api/admin/orders/${orderId}/dispatch/${dispatchId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to delete dispatch batch');
        return await res.json();
    }

    async updateDispatchAgent(orderId, dispatchId, agentData) {
        const res = await fetch(`/api/admin/orders/${orderId}/dispatch/${dispatchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(agentData)
        });
        if (!res.ok) throw new Error('Failed to update agent details');
        return await res.json();
    }

    async getOrderCounts() {
        const res = await fetch('/api/admin/order-counts', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch order counts');
        return await res.json();
    }
}

export default new StaffAPI();
