import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../adminApi';
import OrderCard from './OrderCard';
import styles from '../adminStyles.module.css';

/**
 * Reusable OrderList component for displaying orders filtered by status
 * @param {string} status - The order status to filter by
 * @param {string} title - The title to display for this list
 * @param {function} refreshTrigger - Optional external trigger to force refresh
 */
export default function OrderList({ status, title, refreshTrigger }) {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState(null);

    // Fetch orders from API
    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await adminApi.getOrders();
            setOrders(data.orders || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [refreshTrigger]);

    const isBalanceCleared = (order) => {
        // Calculate item totals
        const totalAmount = order.items?.reduce(
            (sum, item) => sum + (item.quantityOrdered * item.price), 0
        ) || 0;

        // Calculate adjustments
        let adjustmentsTotal = 0;
        if (order.adjustments?.length > 0) {
            order.adjustments.forEach(adj => {
                if (adj.type === 'charge') adjustmentsTotal += adj.amount;
                else if (adj.type === 'discount' || adj.type === 'advance' || adj.type === 'payment') adjustmentsTotal -= adj.amount;
            });
        }

        const finalTotal = totalAmount + adjustmentsTotal;

        return finalTotal <= 0.01;
    };

    // Filter orders by status and search query
    const filteredOrders = useMemo(() => {
        let filtered = orders;

        // Filter by status
        if (status) {
            filtered = filtered.filter(order => {
                // Handle special cases for status filtering
                if (status === 'pending') return order.status === 'Ordered';
                if (status === 'rate-request') return order.status === 'Rate Requested';
                if (status === 'rate-approved') return order.status === 'Rate Approved';
                if (status === 'confirmed') return order.status === 'Confirmed';
                if (status === 'dispatch') return order.status === 'Dispatch' || order.status === 'Partially Delivered';
                if (status === 'balance') {
                    const isRelevantStatus = order.status === 'Delivered' || order.status === 'Dispatch' || order.status === 'Partially Delivered';
                    return isRelevantStatus && !isBalanceCleared(order);
                }
                if (status === 'Paused') return order.status === 'Paused';
                if (status === 'Hold') return order.status === 'Hold';
                if (status === 'Delivered') return order.status === 'Delivered' && !isBalanceCleared(order);
                if (status === 'Cancelled') return order.status === 'Cancelled';
                return order.status === status;
            });
        }

        // Filter by search query (mobile number)
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(order =>
                order.user?.mobile?.toLowerCase().includes(query) ||
                order.user?.name?.toLowerCase().includes(query) ||
                order.customOrderId?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [orders, status, searchQuery]);

    const toggleOrderExpand = (orderId) => {
        setExpandedOrderId(prev => prev === orderId ? null : orderId);
    };

    const handleOrderUpdate = async (orderId, updates) => {
        try {
            await adminApi.updateOrder(orderId, updates);
            // Refresh orders after update
            await fetchOrders();
        } catch (err) {
            console.error('Error updating order:', err);
            alert(`Error: ${err.message}`);
        }
    };

    const handleOrderStatusChange = async (orderId, newStatus, additionalData = {}) => {
        try {
            await adminApi.updateOrderStatus(orderId, newStatus, additionalData);
            
            // Map status to route for redirection
            let targetRoute = '/admin/pending';
            if (newStatus === 'Rate Requested') targetRoute = '/admin/rate-requested';
            else if (newStatus === 'Rate Approved') targetRoute = '/admin/rate-approved';
            else if (newStatus === 'Confirmed') targetRoute = '/admin/confirmed';
            else if (newStatus === 'Dispatch' || newStatus === 'Partially Delivered') targetRoute = '/admin/dispatch';
            else if (newStatus === 'Delivered') targetRoute = '/admin/delivered';
            else if (newStatus === 'Paused') targetRoute = '/admin/paused';
            else if (newStatus === 'Hold') targetRoute = '/admin/hold';
            else if (newStatus === 'Cancelled') targetRoute = '/admin/cancelled';

            // Navigate to the target route after successful update
            navigate(targetRoute);
            
            // Refresh orders after status change (if we are still on the same page category)
            await fetchOrders();
        } catch (err) {
            console.error('Error updating order status:', err);
            alert(`Error: ${err.message}`);
        }
    };

    const handleSingleOrderUpdate = (updatedOrder) => {
        // Update the specific order in the local state without API call
        setOrders(prevOrders =>
            prevOrders.map(order =>
                order._id === updatedOrder._id ? updatedOrder : order
            )
        );
    };

    if (loading) {
        return (
            <div className={styles.adminSection}>
                <h3>{title}</h3>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Loading orders...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.adminSection}>
                <h3>{title}</h3>
                <div className={styles.errorMessage}>
                    <p>Error loading orders: {error}</p>
                    <button onClick={fetchOrders}>Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.adminSection}>
            <div className={styles.sectionHeader}>
                <h3>{title} ({filteredOrders.length})</h3>
                {status === 'pending' && (
                    <button
                        onClick={() => navigate('/admin/create-order')}
                        className={styles.btnAdd}
                    >
                        + Create Order
                    </button>
                )}
            </div>

            <div className={styles.searchContainer}>
                <input
                    type="search"
                    placeholder="Search by mobile number, name, or order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {filteredOrders.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No orders found{searchQuery ? ' matching your search' : ''}.</p>
                </div>
            ) : (
                <div className={styles.ordersList}>
                    {filteredOrders.map(order => (
                        <OrderCard
                            key={order._id}
                            order={order}
                            isExpanded={expandedOrderId === order._id}
                            onToggleExpand={() => toggleOrderExpand(order._id)}
                            onUpdate={handleOrderUpdate}
                            onStatusChange={handleOrderStatusChange}
                            onRefresh={fetchOrders}
                            onOrderUpdate={handleSingleOrderUpdate}
                            isAdmin={true}
                            isBalanceTab={status === 'balance'}
                            isDispatchTab={status === 'dispatch'}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
