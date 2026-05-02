import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import adminApi from '../adminApi';
import styles from '../adminStyles.module.css';
import OrderCard from './OrderCard';
import AdminPasswordModal from '../components/AdminPasswordModal';

/* ─── helpers ─────────────────────────────────────────────── */

function calcBalance(order) {
    const totalAmount = order.items?.reduce((sum, item) => {
        const qty = item.quantityOrdered || 0;
        // If it's a custom item and quantity is 0 or null (flat fee), treat it as 1 for total calculation
        const effectiveQty = (item.isCustom && (qty === 0 || qty === null)) ? 1 : (qty || 0);
        return sum + (effectiveQty * (item.price || 0));
    }, 0) || 0;
    let adjustmentsTotal = 0;
    if (order.adjustments?.length > 0) {
        order.adjustments.forEach(adj => {
            if (adj.type === 'charge') adjustmentsTotal += adj.amount;
            else if (adj.type === 'discount' || adj.type === 'advance' || adj.type === 'payment' || adj.type === 'less')
                adjustmentsTotal -= adj.amount;
        });
    }
    return totalAmount + adjustmentsTotal;
}

function getTabForStatus(status) {
    if (status?.startsWith('Dispatch')) return '/admin/dispatch';
    switch (status) {
        case 'Ordered':           return '/admin/pending';
        case 'Rate Requested':    return '/admin/rate-requested';
        case 'Rate Approved':     return '/admin/rate-approved';
        case 'Confirmed':         return '/admin/confirmed';
        case 'Partially Delivered': return '/admin/dispatch';
        case 'Delivered':         return '/admin/delivered';
        case 'Paused':            return '/admin/paused';
        case 'Hold':              return '/admin/hold';
        case 'Cancelled':         return '/admin/cancelled';
        case 'Completed':         return '/admin/completed';
        default:                  return '/admin';
    }
}

/* ─── Collect Payment Modal ───────────────────────────────── */

function CollectPaymentModal({ order, onClose, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('Payment');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    const balance = calcBalance(order);

    const handleSubmit = async () => {
        const val = parseFloat(amount);
        if (!val || val <= 0) { alert('Please enter a valid amount'); return; }
        if (val > balance + 0.01) { alert(`Amount cannot exceed balance (₹${balance.toFixed(2)})`); return; }
        if (!description.trim()) { alert('Please enter a description'); return; }
        setLoading(true);
        try {
            await adminApi.addAdjustment(order._id, description.trim(), val, 'payment', date, note.trim());
            onSuccess();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={overlay}>
            <div style={modal}>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#202124' }}>
                    Collect Payment
                </h3>
                <p style={{ margin: '0 0 18px', color: '#5f6368', fontSize: 13 }}>
                    <strong>{order.user?.name}</strong> &nbsp;·&nbsp; {order.customOrderId || order._id}
                    &nbsp;·&nbsp; Balance: <span style={{ color: '#e53935', fontWeight: 700 }}>₹{balance.toFixed(2)}</span>
                </p>

                <label style={labelStyle}>Description</label>
                <input
                    style={inputStyle}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Payment description"
                />

                <label style={labelStyle}>Payment Date</label>
                <input
                    style={inputStyle}
                    type="datetime-local"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                />

                <label style={labelStyle}>Amount (₹)</label>
                <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    max={balance.toFixed(2)}
                    step="0.01"
                    value={amount}
                    onChange={e => {
                        let input = e.target.value;
                        if (input === '') {
                            setAmount('');
                            return;
                        }
                        
                        // Restrict to max 2 decimal places
                        if (input.includes('.')) {
                            const [integerPart, decimalPart] = input.split('.');
                            if (decimalPart.length > 2) {
                                input = `${integerPart}.${decimalPart.slice(0, 2)}`;
                            }
                        }
                        
                        const val = parseFloat(input);
                        
                        // Prevent 0 as a starting value if it's the only character
                        if (val === 0 && input.length === 1 && input !== '0.') {
                            return; 
                        }

                        if (val > balance) {
                            // Clamp to max balance, ensuring no additional decimals are added beyond precision
                            setAmount(balance.toFixed(2));
                        } else {
                            setAmount(input);
                        }
                    }}
                    placeholder={`Max ₹${balance.toFixed(2)}`}
                    autoFocus
                />

                <label style={labelStyle}>Note (Optional)</label>
                <textarea
                    style={{ ...inputStyle, height: '60px', resize: 'none', padding: '8px 10px' }}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Add a note here..."
                />

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button
                        style={{ ...btnBase, background: 'linear-gradient(135deg,#28a745,#1e7e34)', color: '#fff', flex: 1 }}
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? 'Saving…' : '✔ Collect'}
                    </button>
                    <button
                        style={{ ...btnBase, background: '#f1f3f4', color: '#3c4043', flex: 1 }}
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

function LessAdjustmentModal({ order, onClose, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('LESS');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    const balance = calcBalance(order);

    const handleSubmit = async () => {
        const val = parseFloat(amount);
        if (!val || val <= 0) { alert('Please enter a valid amount'); return; }
        if (!description.trim()) { alert('Please enter a description'); return; }
        setLoading(true);
        try {
            await adminApi.addAdjustment(order._id, description.trim(), val, 'less', date, note.trim());
            onSuccess();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={overlay}>
            <div style={modal}>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#e53935' }}>
                    Add LESS Deduction
                </h3>
                <p style={{ margin: '0 0 18px', color: '#5f6368', fontSize: 13 }}>
                    <strong>{order.user?.name}</strong> &nbsp;·&nbsp; {order.customOrderId || order._id}
                    &nbsp;·&nbsp; Current Balance: <span style={{ color: '#e53935', fontWeight: 700 }}>₹{balance.toFixed(2)}</span>
                </p>

                <label style={labelStyle}>Description</label>
                <input
                    style={inputStyle}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="LESS description"
                />

                <label style={labelStyle}>Date</label>
                <input
                    style={inputStyle}
                    type="datetime-local"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                />

                <label style={labelStyle}>LESS Amount (₹) (Max: {balance.toFixed(2)})</label>
                <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    max={balance}
                    step="0.01"
                    value={amount}
                    onChange={e => {
                        let val = e.target.value;
                        if (val === '') { setAmount(''); return; }
                        
                        // Restrict to max 2 decimal places
                        if (val.includes('.')) {
                            const [int, dec] = val.split('.');
                            if (dec.length > 2) val = `${int}.${dec.slice(0, 2)}`;
                        }

                        // Cap at balance
                        if (parseFloat(val) > balance) val = balance.toString();
                        
                        setAmount(val);
                    }}
                    placeholder="Enter amount to deduct"
                    autoFocus
                />

                <label style={labelStyle}>Note (Optional)</label>
                <textarea
                    style={{ ...inputStyle, height: '60px', resize: 'none', padding: '8px 10px' }}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Add a note here..."
                />

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button
                        style={{ ...btnBase, background: 'linear-gradient(135deg,#e53935,#c62828)', color: '#fff', flex: 1 }}
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? 'Saving…' : '✔ Apply LESS'}
                    </button>
                    <button
                        style={{ ...btnBase, background: '#f1f3f4', color: '#3c4043', flex: 1 }}
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ──────────────────────────────────────── */

export default function BalanceOrders() {
    const { refreshTrigger } = useOutletContext() || {};
    const navigate = useNavigate();

    const [orders, setOrders]       = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);
    const [search, setSearch]       = useState('');
    const [payOrder, setPayOrder]   = useState(null); // order to collect payment for
    const [lessOrder, setLessOrder] = useState(null); // order to add LESS adjustment for
    const [showLessAuthModal, setShowLessAuthModal] = useState(false);
    const [pendingLessOrder, setPendingLessOrder] = useState(null);
    const [expandedOrderId, setExpandedOrderId] = useState(null); // ID of the order to expand in-place

    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await adminApi.getOrders();
            setOrders(data.orders || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, [refreshTrigger]);

    /* Filter: keep only orders with outstanding balance */
    const balanceOrders = useMemo(() => {
        const relevant = orders.filter(o => {
            const isRelevant =
                o.status === 'Delivered' ||
                o.status?.startsWith('Dispatch') ||
                o.status === 'Partially Delivered' ||
                o.status === 'Completed';
            return isRelevant && calcBalance(o) > 0.01;
        });

        if (!search.trim()) return relevant;
        const q = search.trim().toLowerCase();
        return relevant.filter(o =>
            o.user?.mobile?.toLowerCase().includes(q) ||
            o.user?.name?.toLowerCase().includes(q) ||
            o.customOrderId?.toLowerCase().includes(q)
        );
    }, [orders, search]);

    const handlePaymentSuccess = async () => {
        setPayOrder(null);
        await fetchOrders();
    };

    const handleViewOrder = (order) => {
        const route = getTabForStatus(order.status);
        navigate(`${route}#${order._id}`);
    };

    const toggleExpand = (orderId) => {
        setExpandedOrderId(prev => prev === orderId ? null : orderId);
    };

    const handleSingleOrderUpdate = (updatedOrder) => {
        setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
    };

    /* ─── rendering ─── */

    if (loading) return (
        <div className={styles.adminSection}>
            <h3>Balance</h3>
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner} />
                <p>Loading…</p>
            </div>
        </div>
    );

    if (error) return (
        <div className={styles.adminSection}>
            <h3>Balance</h3>
            <div className={styles.errorMessage}>
                <p>Error: {error}</p>
                <button onClick={fetchOrders}>Retry</button>
            </div>
        </div>
    );

    return (
        <div className={styles.adminSection}>
            {/* Header */}
            <div className={styles.sectionHeader}>
                <h3 style={{ margin: 0 }}>Balance ({balanceOrders.length})</h3>
            </div>

            {/* Search */}
            <div className={styles.searchContainer}>
                <input
                    type="search"
                    placeholder="Search by name, mobile or order ID…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {/* Table */}
            {balanceOrders.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No pending balance orders{search ? ' matching your search' : ''}.</p>
                </div>
            ) : (
                <div style={tableWrapper}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(90deg,#f8f9fa,#e9ecef)' }}>
                                <th style={th}>Order&nbsp;ID</th>
                                <th style={th}>Customer</th>
                                <th style={{ ...th, textAlign: 'right' }}>Balance&nbsp;Due</th>
                                <th style={{ ...th, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {balanceOrders.map((order, idx) => {
                                const balance = calcBalance(order);
                                return (
                                    <React.Fragment key={order._id}>
                                        <tr
                                            style={{
                                                background: idx % 2 === 0 ? '#ffffff' : '#f8fafb',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#eef6ff'}
                                            onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafb'}
                                        >
                                        {/* Order ID */}
                                        <td style={td}>
                                            <span 
                                                onClick={() => handleViewOrder(order)}
                                                style={{ 
                                                    fontFamily: 'monospace', 
                                                    fontWeight: 600, 
                                                    color: '#1a73e8', 
                                                    fontSize: 13,
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline'
                                                }}
                                                title="Click to go to order page"
                                            >
                                                {order.customOrderId || order._id.slice(-8).toUpperCase()}
                                            </span>
                                            <br />
                                            <span style={{ 
                                                fontSize: 11, 
                                                fontWeight: 700, 
                                                color: '#155724', 
                                                backgroundColor: '#d4edda',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                display: 'inline-block',
                                                marginTop: 4,
                                                border: '1px solid #c3e6cb'
                                            }}>
                                                {order.status}
                                            </span>
                                        </td>

                                        {/* Customer */}
                                        <td style={td}>
                                            <span style={{ fontWeight: 600, color: '#202124' }}>
                                                {order.user?.name || '—'}
                                            </span>
                                            {order.user?.mobile && (
                                                <>
                                                    <br />
                                                    <span style={{ fontSize: 12, color: '#5f6368' }}>
                                                        {order.user.mobile}
                                                    </span>
                                                </>
                                            )}
                                        </td>

                                        {/* Balance */}
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            <span style={{
                                                fontWeight: 700,
                                                fontSize: 16,
                                                color: balance > 500 ? '#c62828' : balance > 200 ? '#e65100' : '#e53935'
                                            }}>
                                                ₹{balance.toFixed(2)}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ ...td, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    style={{
                                                        ...btnBase,
                                                        background: 'linear-gradient(135deg,#1a73e8,#1557b0)',
                                                        color: '#fff',
                                                        fontSize: 12,
                                                        padding: '7px 14px',
                                                    }}
                                                    onClick={() => setPayOrder(order)}
                                                >
                                                    💳 Collect Payment
                                                </button>
                                                <button
                                                    style={{
                                                        ...btnBase,
                                                        background: 'linear-gradient(135deg,#e53935,#c62828)',
                                                        color: '#fff',
                                                        fontSize: 12,
                                                        padding: '7px 14px',
                                                    }}
                                                    onClick={() => {
                                                        setPendingLessOrder(order);
                                                        setShowLessAuthModal(true);
                                                    }}
                                                >
                                                    📉 LESS
                                                </button>
                                                    <button
                                                        style={{
                                                            ...btnBase,
                                                            background: expandedOrderId === order._id ? '#e8f0fe' : '#f1f3f4',
                                                            color: expandedOrderId === order._id ? '#1a73e8' : '#3c4043',
                                                            border: expandedOrderId === order._id ? '1px solid #1a73e8' : '1px solid #dadce0',
                                                            fontSize: 12,
                                                            padding: '7px 14px',
                                                            fontWeight: expandedOrderId === order._id ? 700 : 400
                                                        }}
                                                        onClick={() => toggleExpand(order._id)}
                                                    >
                                                        {expandedOrderId === order._id ? '🔼 Close Details' : '🔍 View Order'}
                                                    </button>
                                            </div>
                                        </td>
                                    </tr>
                                        {expandedOrderId === order._id && (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '0 15px 20px', backgroundColor: '#f8f9fa' }}>
                                                    <div style={{ 
                                                        marginTop: '10px', 
                                                        border: '2px solid #1a73e8', 
                                                        borderRadius: '12px', 
                                                        overflow: 'hidden',
                                                        boxShadow: '0 4px 15px rgba(26, 115, 232, 0.1)'
                                                    }}>
                                                        <OrderCard 
                                                            order={order}
                                                            isExpanded={true}
                                                            onToggleExpand={() => toggleExpand(order._id)}
                                                            onRefresh={fetchOrders}
                                                            onOrderUpdate={handleSingleOrderUpdate}
                                                            api={adminApi}
                                                            isAdmin={true}
                                                            isBalanceTab={true}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Collect Payment Modal */}
            {payOrder && (
                <CollectPaymentModal
                    order={payOrder}
                    onClose={() => setPayOrder(null)}
                    onSuccess={handlePaymentSuccess}
                />
            )}

            {/* LESS Adjustment Modal */}
            {lessOrder && (
                <LessAdjustmentModal
                    order={lessOrder}
                    onClose={() => setLessOrder(null)}
                    onSuccess={() => {
                        setLessOrder(null);
                        fetchOrders();
                    }}
                />
            )}

            <AdminPasswordModal
                show={showLessAuthModal}
                title="Authorize LESS Deduction"
                message="Please enter the PROFILE_PASSWORD to add a LESS deduction."
                onConfirm={() => {
                    setShowLessAuthModal(false);
                    setLessOrder(pendingLessOrder);
                }}
                onCancel={() => setShowLessAuthModal(false)}
            />
        </div>
    );
}

/* ─── Inline styles ───────────────────────────────────────── */

const tableWrapper = {
    overflowX: 'auto',
    borderRadius: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
    border: '1px solid #e9ecef',
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
};

const th = {
    padding: '13px 16px',
    fontWeight: 600,
    color: '#5f6368',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e9ecef',
    whiteSpace: 'nowrap',
};

const td = {
    padding: '14px 16px',
    borderBottom: '1px solid #f1f3f4',
    verticalAlign: 'middle',
};

const btnBase = {
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
};

/* Modal overlay / box */
const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
};

const modal = {
    background: '#fff',
    borderRadius: 14,
    padding: '28px 32px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#5f6368',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: 5,
    marginTop: 14,
};

const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #dadce0',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
};
