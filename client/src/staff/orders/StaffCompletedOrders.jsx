import React, { useState, useEffect, useMemo } from 'react';
import staffApi from '../staffApi';
import OrderCard from '../../admin/orders/OrderCard';
import styles from '../../admin/adminStyles.module.css';
import { useNavigate, useOutletContext } from 'react-router-dom';

/**
 * StaffCompletedOrders - Shows Delivered orders where the balance has been fully cleared.
 */
export default function StaffCompletedOrders() {
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

    const isBalanceCleared = (order) => {
        if (order.status !== 'Delivered') return false;

        const totalAmount = order.items?.reduce(
            (sum, item) => sum + (item.quantityOrdered * item.price), 0
        ) || 0;

        let adjustmentsTotal = 0;
        if (order.adjustments?.length > 0) {
            order.adjustments.forEach(adj => {
                if (adj.type === 'charge') adjustmentsTotal += adj.amount;
                else if (adj.type === 'discount' || adj.type === 'advance') adjustmentsTotal -= adj.amount;
            });
        }

        const finalTotal = totalAmount + adjustmentsTotal;

        const totalReceived = order.deliveries?.reduce((sum, batch) => {
            if (batch.isConfirmed) return sum + (batch.receivedAmount || 0);
            return sum;
        }, 0) || 0;

        return (finalTotal - totalReceived) <= 0;
    };

    const completedOrders = useMemo(() => orders.filter(isBalanceCleared), [orders]);

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
            await staffApi.updateOrderStatus(orderId, newStatus, additionalData);
            let targetRoute = '/staff/pending';
            if (newStatus === 'Rate Requested') targetRoute = '/staff/rate-requested';
            else if (newStatus === 'Rate Approved') targetRoute = '/staff/rate-approved';
            else if (newStatus === 'Confirmed') targetRoute = '/staff/confirmed';
            else if (newStatus === 'Dispatch' || newStatus === 'Partially Delivered') targetRoute = '/staff/dispatch';
            else if (newStatus === 'Delivered') targetRoute = '/staff/delivered';
            else if (newStatus === 'Paused') targetRoute = '/staff/paused';
            else if (newStatus === 'Hold') targetRoute = '/staff/hold';
            else if (newStatus === 'Cancelled') targetRoute = '/staff/cancelled';
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
        const total = order.items?.reduce((s, item) => s + (item.quantityOrdered * item.price), 0) || 0;
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
                    Total Value: ₹{totalCleared.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                            api={staffApi}
                            isAdmin={false}
                            isBalanceTab={true}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
