// adminApi.js - Centralized admin API service

class AdminAPI {
    // Authentication uses /api/admin
    async login(username, password) {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error('Login failed');
        return await res.json();
    }

    async logout() {
        const res = await fetch('/api/admin/logout', {
            method: 'POST',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Logout failed');
        return await res.json();
    }

    async checkSession() {
        const res = await fetch('/api/admin/check', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Not authenticated');
        return await res.json();
    }

    // Order Management uses /api/admin
    async getOrders() {
        const res = await fetch('/api/admin/orders', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Backend returns orders array directly, wrap it for frontend
        return { orders: data };
    }

    async updateOrder(orderId, updates) {
        const res = await fetch(`/api/admin/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Update failed');
        return await res.json();
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

    // Adjustment Management
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

    // Product Management uses /api/products
    async getProducts() {
        const res = await fetch('/api/products', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Return in format expected by ProductList
        return { products: data };
    }

    async createProduct(productData) {
        // Map 'image' to 'imageData' for backend
        const backendData = {
            ...productData,
            imageData: productData.image
        };
        delete backendData.image;

        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(backendData)
        });
        if (!res.ok) throw new Error('Failed to create product');
        return await res.json();
    }

    async updateProduct(productId, productData) {
        // Map 'image' to 'imageData' for backend
        const backendData = {
            ...productData,
            imageData: productData.image
        };
        delete backendData.image;

        const res = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(backendData)
        });
        if (!res.ok) throw new Error('Failed to update product');
        return await res.json();
    }

    async deleteProduct(productId) {
        const res = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to delete product');
        return await res.json();
    }

    async reorderProducts(orders) {
        const res = await fetch('/api/products/reorder', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orders })
        });
        if (!res.ok) throw new Error('Failed to reorder products');
        return await res.json();
    }

    async toggleProductVisibility(productId, isVisible) {
        const res = await fetch(`/api/products/${productId}/visibility`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isVisible })
        });
        if (!res.ok) throw new Error('Failed to toggle product visibility');
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
            body: JSON.stringify({ orderId, updatedItems }) // Pass updatedItems in body
        });
        if (!res.ok) throw new Error('Failed to request rate change');
        return await res.json();
    }

    // User Management uses /api/admin
    async getUsers() {
        const res = await fetch('/api/admin/visited-users', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to get users');
        return await res.json();
    }

    async createUser(userData) {
        const res = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(userData)
        });
        if (!res.ok) throw new Error('Failed to create user');
        return await res.json();
    }
}

export default new AdminAPI();
