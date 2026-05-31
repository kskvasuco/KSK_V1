import React, { useState, useEffect, useMemo } from 'react';
import adminApi from '../adminApi';
import styles from '../adminStyles.module.css';

const inputStyle = {
    padding: '9px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    color: '#1e293b',
    outline: 'none',
    background: '#fff',
    minWidth: 140,
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
};

const thStyle = {
    padding: '14px 24px',
    background: '#f8fafc',
    color: '#475569',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #cbd5e1'
};

const tdStyle = {
    padding: '14px 24px',
    fontSize: 14,
    color: '#1e293b',
    verticalAlign: 'middle'
};

const tabStyle = (active) => ({
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '700',
    color: active ? '#0f52ba' : '#64748b',
    borderBottom: active ? '3px solid #0f52ba' : '3px solid transparent',
    background: 'none',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none'
});

export default function RecycleBin() {
    const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'customers'
    const [deletedOrders, setDeletedOrders] = useState([]);
    const [deletedUsers, setDeletedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchDeletedOrders = async () => {
        try {
            setLoading(true);
            const res = await adminApi.getDeletedOrders();
            setDeletedOrders(res.orders || []);
            setError('');
        } catch (err) {
            setError(err.message || 'Failed to load deleted orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchDeletedUsers = async () => {
        try {
            setLoading(true);
            const res = await adminApi.getDeletedUsers();
            setDeletedUsers(res || []);
            setError('');
        } catch (err) {
            setError(err.message || 'Failed to load deleted customers');
        } finally {
            setLoading(false);
        }
    };

    const refreshData = () => {
        if (activeTab === 'orders') {
            fetchDeletedOrders();
        } else {
            fetchDeletedUsers();
        }
    };

    useEffect(() => {
        setSearchQuery('');
        refreshData();
    }, [activeTab]);

    const handleRestoreOrder = async (orderId) => {
        if (!window.confirm('Are you sure you want to restore this order?')) return;
        try {
            await adminApi.restoreOrder(orderId);
            fetchDeletedOrders();
        } catch (err) {
            alert(`Restore failed: ${err.message}`);
        }
    };

    const handlePermanentDeleteOrder = async (orderId) => {
        if (!window.confirm('Are you sure you want to PERMANENTLY delete this order? This action cannot be undone.')) return;
        try {
            await adminApi.permanentDeleteOrder(orderId);
            fetchDeletedOrders();
        } catch (err) {
            alert(`Permanent delete failed: ${err.message}`);
        }
    };

    const handleRestoreUser = async (userId) => {
        if (!window.confirm('Are you sure you want to restore this customer?')) return;
        try {
            await adminApi.restoreUser(userId);
            fetchDeletedUsers();
        } catch (err) {
            alert(`Restore failed: ${err.message}`);
        }
    };

    const handlePermanentDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to PERMANENTLY delete this customer? This action cannot be undone.')) return;
        try {
            await adminApi.permanentDeleteUser(userId);
            fetchDeletedUsers();
        } catch (err) {
            alert(`Permanent delete failed: ${err.message}`);
        }
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filteredOrders = useMemo(() => {
        let filtered = deletedOrders;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(order => {
                const idMatch = (order.customOrderId || order._id.toString()).toLowerCase().includes(q);
                const nameMatch = (order.user?.name || '').toLowerCase().includes(q);
                const phoneMatch = (order.user?.mobile || '').toLowerCase().includes(q);
                return idMatch || nameMatch || phoneMatch;
            });
        }
        filtered.sort((a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime());
        return filtered;
    }, [deletedOrders, searchQuery]);

    const filteredUsers = useMemo(() => {
        let filtered = deletedUsers;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(u => {
                const nameMatch = (u.name || '').toLowerCase().includes(q);
                const phoneMatch = (u.mobile || '').toLowerCase().includes(q);
                const districtMatch = (u.district || '').toLowerCase().includes(q);
                const talukMatch = (u.taluk || '').toLowerCase().includes(q);
                return nameMatch || phoneMatch || districtMatch || talukMatch;
            });
        }
        filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return filtered;
    }, [deletedUsers, searchQuery]);

    if (loading) return (
        <div className={styles.adminSection}>
            <h3>🗑️ Recycle Bin</h3>
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading recycle bin...</p>
            </div>
        </div>
    );

    return (
        <div className={styles.adminSection}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
                        🗑️ Recycle Bin
                    </h3>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
                        Manage soft-deleted items. You can restore them or delete them permanently.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={refreshData}
                        style={{
                            padding: '9px 18px',
                            background: '#f0f9ff',
                            border: '1.5px solid #bae6fd',
                            borderRadius: 10,
                            color: '#0284c7',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        🔄 Refresh Data
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', marginBottom: 20, gap: '8px' }}>
                <button 
                    style={tabStyle(activeTab === 'orders')} 
                    onClick={() => setActiveTab('orders')}
                >
                    📦 Deleted Orders ({filteredOrders.length})
                </button>
                <button 
                    style={tabStyle(activeTab === 'customers')} 
                    onClick={() => setActiveTab('customers')}
                >
                    👤 Deleted Customers ({filteredUsers.length})
                </button>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, marginBottom: 20 }}>
                    {error}
                </div>
            )}

            {/* Search */}
            <div style={{
                background: '#fff',
                padding: '18px 24px',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                marginBottom: 24,
                boxShadow: '0 2px 14px rgba(0,0,0,0.03)'
            }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200, maxWidth: 400 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Search</label>
                        <input
                            type="text"
                            placeholder={activeTab === 'orders' ? "Search Order ID, Name or Phone..." : "Search Name, Phone, District..."}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ ...inputStyle, width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                overflow: 'hidden'
            }}>
                {activeTab === 'orders' ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Order Info</th>
                                    <th style={thStyle}>Customer</th>
                                    <th style={thStyle}>Deleted Details</th>
                                    <th style={thStyle}>Previous Status</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
                                            <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>No deleted orders found.</div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map((order, i) => (
                                        <tr key={order._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}>
                                            <td style={{ ...tdStyle, color: '#1e293b' }}>
                                                <div style={{ fontWeight: 700, color: '#1a73e8', letterSpacing: '-0.2px' }}>
                                                    {order.customOrderId || order._id.toString().slice(-6)}
                                                </div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                                    Ordered: {formatDateDisplay(order.createdAt)}
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{order.user?.name || 'Unknown'}</div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{order.user?.mobile || '—'}</div>
                                            </td>
                                            <td style={{ ...tdStyle, color: '#475569', fontSize: 13 }}>
                                                <div style={{ color: '#dc2626', fontWeight: 600 }}>{formatDateDisplay(order.deletedAt)}</div>
                                            </td>
                                            <td style={{ ...tdStyle }}>
                                                <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => handleRestoreOrder(order._id)}
                                                        style={{
                                                            padding: '7px 14px',
                                                            background: '#16a34a',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
                                                        }}
                                                    >
                                                        ♻️ Restore
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDeleteOrder(order._id)}
                                                        style={{
                                                            padding: '7px 14px',
                                                            background: '#dc2626',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            boxShadow: '0 2px 4px rgba(220,38,38,0.2)'
                                                        }}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Customer Info</th>
                                    <th style={thStyle}>Mobile</th>
                                    <th style={thStyle}>Location</th>
                                    <th style={thStyle}>Ledger State</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
                                            <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>No deleted customers found.</div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((u, i) => (
                                        <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}>
                                            <td style={{ ...tdStyle, color: '#1e293b' }}>
                                                <div style={{ fontWeight: 700, color: '#0f52ba', letterSpacing: '-0.2px' }}>
                                                    {u.name}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                    Deleted: {formatDateDisplay(u.updatedAt)}
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>📱 +91 {u.mobile}</div>
                                                {u.altMobile && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📱 +91 {u.altMobile}</div>}
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ fontWeight: 600 }}>📍 {u.district || '—'}</div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📍 {u.taluk || '—'}</div>
                                            </td>
                                            <td style={{ ...tdStyle }}>
                                                <span style={{
                                                    background: u.isAddedToLedger ? '#ecfdf5' : '#f1f5f9',
                                                    color: u.isAddedToLedger ? '#059669' : '#475569',
                                                    padding: '4px 10px',
                                                    borderRadius: 20,
                                                    fontSize: 12,
                                                    fontWeight: 600
                                                }}>
                                                    {u.isAddedToLedger ? `${u.ledgerType || 'Ledger'}` : 'Not in Ledger'}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => handleRestoreUser(u._id)}
                                                        style={{
                                                            padding: '7px 14px',
                                                            background: '#16a34a',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
                                                        }}
                                                    >
                                                        ♻️ Restore
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDeleteUser(u._id)}
                                                        style={{
                                                            padding: '7px 14px',
                                                            background: '#dc2626',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            boxShadow: '0 2px 4px rgba(220,38,38,0.2)'
                                                        }}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
