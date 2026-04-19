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
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Status update failed');
        }
        return await res.json();
    }

    async updateOrderDate(orderId, newDate) {
        const res = await fetch(`/api/admin/orders/${orderId}/update-date`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ newDate })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update order date');
        }
        return await res.json();
    }

    async deleteOrder(orderId) {
        const res = await fetch(`/api/admin/orders/${orderId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        let data;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await res.json();
        } else {
            data = { error: await res.text() }; // Fallback for HTML errors
        }

        if (!res.ok) throw new Error(data.error || 'Delete failed');
        return data;
    }

    async getOrderCounts() {
        const res = await fetch('/api/admin/order-counts', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch order counts');
        return await res.json();
    }

    // Adjustment Management
    async addAdjustment(orderId, description, amount, type, date) {
        const res = await fetch('/api/admin/orders/adjustments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, description, amount, type, date })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to add adjustment');
        }
        return await res.json();
    }

    async updateAdjustmentDate(orderId, adjustmentId, newDate) {
        const res = await fetch(`/api/admin/orders/${orderId}/adjustments/${adjustmentId}/date`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ newDate })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update adjustment date');
        }
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
    async assignAgent(orderId, agentName, agentMobile, agentDescription, agentAddress, dispatchDate) {
        const res = await fetch('/api/admin/orders/assign-agent', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                orderId,
                agentName,
                agentMobile,
                agentDescription,
                agentAddress,
                dispatchDate
            })
        });
        if (!res.ok) throw new Error('Failed to assign agent');
        return await res.json();
    }

    async recordDelivery(orderId, deliveries, rent, deliveryDate) {
        const res = await fetch('/api/admin/orders/record-delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, deliveries, rent: rent || 0, deliveryDate: deliveryDate || null })
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
        // Map imageData to image for frontend consistency
        const mappedProducts = data.map(p => ({
            ...p,
            image: p.imageData || p.image
        }));
        return { products: mappedProducts };
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
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to edit order');
        }
        return await res.json();
    }

    async addCustomItem(orderId, { name, quantity, price, unit, description }) {
        const res = await fetch('/api/admin/orders/add-custom-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, name, quantity, price, unit, description })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to add custom item');
        }
        return await res.json();
    }

    async updateCustomItem(orderId, itemId, { name, quantity, price, unit, description }) {
        const res = await fetch('/api/admin/orders/update-custom-item', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, itemId, name, quantity, price, unit, description })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to update custom item');
        }
        return await res.json();
    }

    async deleteCustomItem(orderId, itemId) {
        const res = await fetch('/api/admin/orders/remove-custom-item', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, itemId })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to remove custom item');
        }
        return await res.json();
    }

    async requestRateChange(orderId, updatedItems) {
        const res = await fetch('/api/admin/orders/request-rate-change', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId, updatedItems }) // Pass updatedItems in body
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to request rate change');
        }
        return await res.json();
    }

    async createOrderForUser(userId, items, orderDate) {
        // Determine endpoint based on price changes (logic similar to staff)
        // ideally, the backend should handle this decision or expose a single endpoint
        // For now, mirroring staff logic but using admin routes if they exist
        // Note: Staff uses specific endpoints. Admin likely uses /api/admin/orders/create-for-user

        // Check if any item price differs from product price
        // In a real scenario, we'd check against current product price, but here we assume 'items' has both
        // For simplicity, we'll hit a generic admin create endpoint.
        // If specific endpoints are needed like staff, we'll adapt.
        // Assuming /api/admin/orders/create-for-user handles both standard and custom rates for admins
        // Admin overrides are usually auto-approved anyway.

        const res = await fetch('/api/admin/orders/create-for-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId, items, orderDate })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || res.statusText);
        }
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
        const res = await fetch('/api/admin/create-user', {
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
    async getLocations() {
        const res = await fetch('/api/locations');
        if (!res.ok) throw new Error('Failed to get locations');
        return await res.json();
    }

    async verifyPassword(password) {
        const res = await fetch('/api/admin/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Password verification failed');
        }
        return await res.json();
    }

    async blockUser(userId, isBlocked) {
        const res = await fetch(`/api/admin/users/${userId}/block`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isBlocked })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Block failed');
        }
        return await res.json();
    }

    async deleteUser(userId) {
        const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Delete user failed');
        }
        return await res.json();
    }

    // Payment Settings Management
    async getPaymentSettings() {
        const res = await fetch('/api/admin/payment-settings', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch payment settings');
        return await res.json();
    }

    async createPaymentSetting(data) {
        const res = await fetch('/api/admin/payment-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || 'Failed to create payment setting');
        }
        return result;
    }

    async updatePaymentSetting(id, data) {
        const res = await fetch('/api/admin/payment-settings', {
            method: 'POST', // Same endpoint for update with ID
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id, ...data })
        });
        const result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || 'Failed to update payment setting');
        }
        return result;
    }

    async deletePaymentSetting(id) {
        const res = await fetch(`/api/admin/payment-settings/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to delete payment setting');
        return await res.json();
    }

    // Delivery Agent Management
    async getDeliveryAgents() {
        const res = await fetch('/api/admin/delivery-agents', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch delivery agents');
        return await res.json();
    }

    async getAgentRecords(agentId) {
        const res = await fetch(`/api/admin/delivery-records/${agentId}`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch agent records');
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

    async updateDispatchBatchDate(orderId, batchKey, newDate) {
        const res = await fetch(`/api/admin/orders/${orderId}/dispatch-batch-date`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ batchKey, newDate })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update dispatch batch date');
        }
        return await res.json();
    }

    // App Controller Settings
    async getAppController() {
        const res = await fetch('/api/admin/app-controller', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch app controller settings');
        return await res.json();
    }

    async updateAppController(updates) {
        const res = await fetch('/api/admin/app-controller', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update app controller settings');
        }
        return await res.json();
    }
}

export default new AdminAPI();
