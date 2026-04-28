import React, { useState, useEffect, useMemo } from 'react';
import adminApi from '../adminApi';
import OrderCard from './OrderCard';
import styles from '../adminStyles.module.css';
import { useNavigate, useOutletContext } from 'react-router-dom';

/**
 * CompletedOrders - Shows Delivered orders where the balance has been fully cleared.
 * An order is "balance-cleared" when the total amount due (items + adjustments) is fully
 * covered by received delivery payments (confirmed delivery batches).
 */
export default function CompletedOrders() {
    const navigate = useNavigate();
    const { refreshTrigger } = useOutletContext() || {};
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState(null);

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

    // Handle URL hash for auto-expansion and scrolling
    useEffect(() => {
        if (!loading && orders.length > 0 && window.location.hash) {
            const orderId = window.location.hash.substring(1);
            if (orders.some(o => o._id === orderId)) {
                setExpandedOrderId(orderId);
                // Wait for render
                setTimeout(() => {
                    const el = document.getElementById(orderId);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        }
    }, [loading, orders]);

    /**
     * Calculate whether an order's balance is fully cleared.
     * Works for both 'Delivered' and 'Completed' statuses.
     * An order is balance-cleared when (items total + adjustments) <= 0.01
     */
    const isBalanceCleared = (order) => {
        if (order.status !== 'Delivered' && order.status !== 'Completed') return false;

        // Calculate item totals
        const totalAmount = order.items?.reduce((sum, item) => {
            const qty = item.quantityOrdered || 0;
            // If it's a custom item and quantity is 0 or null (flat fee), treat it as 1 for total calculation
            const effectiveQty = (item.isCustom && (qty === 0 || qty === null)) ? 1 : (qty || 0);
            return sum + (effectiveQty * (item.price || 0));
        }, 0) || 0;

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

    const completedOrders = useMemo(() => {
        return orders.filter(isBalanceCleared);
    }, [orders]);

    const filteredOrders = useMemo(() => {
        if (!searchQuery.trim()) return completedOrders;
        const query = searchQuery.trim().toLowerCase();
        return completedOrders.filter(order =>
            order.user?.mobile?.toLowerCase().includes(query) ||
            order.user?.name?.toLowerCase().includes(query) ||
            order.customOrderId?.toLowerCase().includes(query)
        );
    }, [completedOrders, searchQuery]);

    const toggleOrderExpand = (orderId) => {
        setExpandedOrderId(prev => prev === orderId ? null : orderId);
    };

    const handleOrderStatusChange = async (orderId, newStatus, additionalData = {}) => {
        try {
            await adminApi.updateOrderStatus(orderId, newStatus, additionalData);
            let targetRoute = '/admin/pending';
            if (newStatus === 'Rate Requested') targetRoute = '/admin/rate-requested';
            else if (newStatus === 'Rate Approved') targetRoute = '/admin/rate-approved';
            else if (newStatus === 'Confirmed') targetRoute = '/admin/confirmed';
            else if (newStatus === 'Dispatch' || newStatus === 'Partially Delivered') targetRoute = '/admin/dispatch';
            else if (newStatus === 'Delivered') targetRoute = '/admin/delivered';
            else if (newStatus === 'Completed') targetRoute = '/admin/completed';
            else if (newStatus === 'Paused') targetRoute = '/admin/paused';
            else if (newStatus === 'Hold') targetRoute = '/admin/hold';
            else if (newStatus === 'Cancelled') targetRoute = '/admin/cancelled';
            navigate(targetRoute);
            await fetchOrders();
        } catch (err) {
            console.error('Error updating order status:', err);
            alert(`Error: ${err.message}`);
        }
    };

    const handleSingleOrderUpdate = (updatedOrder) => {
        setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
    };

    if (loading) {
        return (
            <div className={styles.adminSection}>
                <h3>Completed Orders</h3>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Loading completed orders...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.adminSection}>
                <h3>Completed Orders</h3>
                <div className={styles.errorMessage}>
                    <p>Error loading orders: {error}</p>
                    <button onClick={fetchOrders} className={styles.btnConfirm}>Retry</button>
                </div>
            </div>
        );
    }

    const totalCleared = filteredOrders.reduce((sum, order) => {
        const total = order.items?.reduce((s, item) => {
            const qty = item.quantityOrdered || 0;
            const effectiveQty = (item.isCustom && qty === 0) ? 1 : qty;
            return s + (effectiveQty * (item.price || 0));
        }, 0) || 0;
        let adj = 0;
        order.adjustments?.forEach(a => {
            if (a.type === 'charge') adj += a.amount;
            else if (a.type === 'discount' || a.type === 'advance') adj -= a.amount;
        });
        return sum + total + adj;
    }, 0);

    return (
        <div className={styles.adminSection}>
            <div className={styles.sectionHeader}>
                <div>
                    <h3>✅ Completed Orders ({filteredOrders.length})</h3>
                    <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0' }}>
                        Orders where the full balance has been received
                    </p>
                </div>
                <div style={{
                    background: 'linear-gradient(135deg, #11998e, #38ef7d)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    boxShadow: '0 4px 12px rgba(17,153,142,0.3)'
                }}>
                    Total Value: <span className={styles.rupee}>₹</span>{totalCleared.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
            </div>

            <div className={styles.searchContainer}>
                <input
                    type="search"
                    placeholder="Search by mobile, name, or order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {filteredOrders.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>
                        {searchQuery
                            ? 'No completed orders matching your search.'
                            : 'No orders with fully cleared balance yet.'
                        }
                    </p>
                </div>
            ) : (
                <div className={styles.ordersList}>
                    {filteredOrders.map(order => (
                        <OrderCard
                            key={order._id}
                            order={order}
                            isExpanded={expandedOrderId === order._id}
                            onToggleExpand={() => toggleOrderExpand(order._id)}
                            onStatusChange={handleOrderStatusChange}
                            onRefresh={fetchOrders}
                            onOrderUpdate={handleSingleOrderUpdate}
                            isAdmin={true}
                            isBalanceTab={true} // Enable modern table view for completed orders
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
