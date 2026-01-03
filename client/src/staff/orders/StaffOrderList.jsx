import React, { useState, useEffect, useMemo } from 'react';
import staffApi from '../staffApi'; // Using Staff API service
import OrderCard from '../../admin/orders/OrderCard'; // Reusing OrderCard
import styles from '../../admin/adminStyles.module.css'; // Reusing Admin Styles

/**
 * StaffOrderList component for displaying orders filtered by status
 * Adapted from Admin OrderList with staff-specific API calls
 */
export default function StaffOrderList({ status, title, refreshTrigger }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedOrderIds, setExpandedOrderIds] = useState(new Set());

    // Fetch orders from Staff API
    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await staffApi.getOrders();
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

    // Filter orders by status and search query
    const filteredOrders = useMemo(() => {
        let filtered = orders;

        // Filter by status (Logic remains same as Admin)
        if (status) {
            filtered = filtered.filter(order => {
                if (status === 'pending') return order.status === 'Ordered';
                if (status === 'rate-request') return order.status === 'Rate Requested';
                if (status === 'rate-approved') return order.status === 'Rate Approved';
                if (status === 'confirmed') return order.status === 'Confirmed';
                if (status === 'dispatch') return order.status === 'Dispatch' || order.status === 'Partially Delivered';
                if (status === 'balance') return order.status !== 'Cancelled';
                if (status === 'paused') return order.status === 'Paused';
                if (status === 'hold') return order.status === 'Hold';
                if (status === 'delivered') return order.status === 'Delivered';
                if (status === 'cancelled') return order.status === 'Cancelled';
                return order.status === status;
            });
        }

        // Filter by search query
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
        setExpandedOrderIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    // Staff might not have full update permissions, but updateOrderStatus is shared
    const handleOrderStatusChange = async (orderId, newStatus, additionalData = {}) => {
        try {
            await staffApi.updateOrderStatus(orderId, newStatus, additionalData);
            // Refresh orders after status change
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

    // Note: handleOrderUpdate (generic update) removed as Staff typically use specific actions
    // If needed, add it back using staffApi.updateOrder

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
            <h3>{title} ({filteredOrders.length})</h3>

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
                            isExpanded={expandedOrderIds.has(order._id)}
                            onToggleExpand={() => toggleOrderExpand(order._id)}
                            onStatusChange={handleOrderStatusChange}
                            onRefresh={fetchOrders}
                            onOrderUpdate={handleSingleOrderUpdate}
                            api={staffApi} // Inject Staff API
                            isAdmin={false}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
