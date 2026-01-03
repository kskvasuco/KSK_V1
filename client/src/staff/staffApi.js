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
        if (!res.ok) throw new Error('Status update failed');
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
    async assignAgent(orderId, agentName, agentMobile, agentDescription, agentAddress) {
        const res = await fetch('/api/admin/orders/assign-agent', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, agentName, agentMobile, agentDescription, agentAddress })
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

    // Product Management (Shared - Read Only mainly, but endpoint exists)
    async getProducts() {
        // Staff likely uses the same product endpoint
        const res = await fetch('/api/products', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { products: data };
    }

    // User Management (Shared)
    async getUsers() {
        const res = await fetch('/api/admin/visited-users', {
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

    // Create Order (Shared logic)
    async createOrder(userId, items) {
        // Determine if it's a rate request or standard order based on some logic...
        // For now, let's assume standard order creation
        const res = await fetch('/api/admin/orders/create-for-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId, items })
        });
        if (!res.ok) throw new Error('Failed to create order');
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
}

export default new StaffAPI();
