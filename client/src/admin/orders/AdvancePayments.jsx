import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../adminApi';
import styles from '../adminStyles.module.css';

export default function AdvancePayments() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

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
    }, []);

    const advances = useMemo(() => {
        const list = [];
        orders.forEach(order => {
            if (order.adjustments && Array.isArray(order.adjustments)) {
                order.adjustments.forEach(adj => {
                    if (adj.type === 'advance') {
                        list.push({
                            ...adj,
                            orderId: order._id,
                            customOrderId: order.customOrderId,
                            customerName: order.user?.name || 'Unknown',
                            customerMobile: order.user?.mobile || '',
                            status: order.status
                        });
                    }
                });
            }
        });
        // Sort by date descending
        return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [orders]);

    const filteredAdvances = useMemo(() => {
        if (!searchQuery.trim()) return advances;
        const query = searchQuery.toLowerCase();
        return advances.filter(adv => 
            adv.customOrderId?.toLowerCase().includes(query) ||
            adv.customerName?.toLowerCase().includes(query) ||
            adv.customerMobile?.includes(query) ||
            adv.description?.toLowerCase().includes(query)
        );
    }, [advances, searchQuery]);

    const handleOrderClick = (status, orderId) => {
        let route = '/admin/pending';
        if (status === 'Rate Requested') route = '/admin/rate-requested';
        else if (status === 'Rate Approved') route = '/admin/rate-approved';
        else if (status === 'Confirmed') route = '/admin/confirmed';
        else if (status === 'Dispatch' || status === 'Partially Delivered') route = '/admin/dispatch';
        else if (status === 'Delivered') route = '/admin/delivered';
        else if (status === 'Paused') route = '/admin/paused';
        else if (status === 'Hold') route = '/admin/hold';
        else if (status === 'Cancelled') route = '/admin/cancelled';
        else if (status === 'Completed') route = '/admin/completed';

        navigate(`${route}#${orderId}`);
    };

    if (loading) {
        return (
            <div className={styles.adminSection}>
                <h3>Advance Payments</h3>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Loading advance records...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.adminSection}>
                <h3>Advance Payments</h3>
                <div className={styles.errorMessage}>
                    <p>Error: {error}</p>
                    <button onClick={fetchOrders} className={styles.btnConfirm}>Retry</button>
                </div>
            </div>
        );
    }

    const totalAdvance = filteredAdvances.reduce((sum, adv) => sum + (adv.amount || 0), 0);

    return (
        <div className={styles.adminSection}>
            <div className={styles.sectionHeader}>
                <h3>Advance Payments ({filteredAdvances.length})</h3>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
                    Total: ₹{totalAdvance.toFixed(2)}
                </div>
            </div>

            <div className={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="Search by Order ID, Customer Name, or Mobile..."
                    className={styles.searchInput}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {filteredAdvances.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No advance payments found.</p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                            <tr>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Order ID</th>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Customer</th>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Description</th>
                                <th style={{ padding: '15px', textAlign: 'right' }}>Amount</th>
                                <th style={{ padding: '15px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAdvances.map((adv, index) => (
                                <tr key={`${adv.orderId}-${index}`} style={{ borderBottom: '1px solid #f0f0f0', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '15px' }}>{new Date(adv.date).toLocaleDateString()}</td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#1a73e8' }}>{adv.customOrderId}</td>
                                    <td style={{ padding: '15px' }}>
                                        <div>{adv.customerName}</div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>{adv.customerMobile}</div>
                                    </td>
                                    <td style={{ padding: '15px', color: '#555' }}>{adv.description}</td>
                                    <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#28a745' }}>
                                        ₹{adv.amount.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '15px', textAlign: 'center' }}>
                                        <button 
                                            onClick={() => handleOrderClick(adv.status, adv.orderId)}
                                            style={{ 
                                                padding: '6px 12px', 
                                                background: '#f0f7ff', 
                                                color: '#007bff', 
                                                border: '1px solid #cce5ff', 
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                fontWeight: '500'
                                            }}
                                        >
                                            View Order
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
