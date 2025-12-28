import React, { useState } from 'react';
import styles from '../adminStyles.module.css';
import adminApi from '../adminApi';

export default function OrderCard({ order, isExpanded, onToggleExpand, onUpdate, onStatusChange, onRefresh, onOrderUpdate }) {
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [pauseReason, setPauseReason] = useState('');
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [adjustmentType, setAdjustmentType] = useState('charge');
    const [adjustmentDescription, setAdjustmentDescription] = useState('');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');

    // Calculate totals
    const totalAmount = order.items?.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0) || 0;

    let adjustmentsTotal = 0;
    if (order.adjustments && order.adjustments.length > 0) {
        order.adjustments.forEach(adj => {
            if (adj.type === 'charge') {
                adjustmentsTotal += adj.amount;
            } else if (adj.type === 'discount' || adj.type === 'advance') {
                adjustmentsTotal -= adj.amount;
            }
        });
    }

    const finalTotal = totalAmount + adjustmentsTotal;

    // Format currency
    const formatCurrency = (amount) => {
        return `₹${amount?.toFixed(2) || '0.00'}`;
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    // Get status color
    const getStatusColor = () => {
        const colors = {
            'Ordered': '#28a745',
            'Rate Requested': '#ffc107',
            'Rate Approved': '#17a2b8',
            'Confirmed': '#007bff',
            'Dispatch': '#6f42c1',
            'Partially Delivered': '#fd7e14',
            'Delivered': '#28a745',
            'Paused': '#ffc107',
            'Hold': '#dc3545',
            'Cancelled': '#6c757d'
        };
        return colors[order.status] || '#000';
    };

    // Handle actions
    const handleConfirm = () => {
        if (window.confirm('Confirm this order?')) {
            onStatusChange(order._id, 'Confirmed');
        }
    };

    const handlePause = () => {
        setShowReasonModal(true);
    };

    const handleSubmitPause = () => {
        if (!pauseReason.trim()) {
            alert('Please enter a reason for pausing');
            return;
        }
        onStatusChange(order._id, 'Paused', { pauseReason });
        setShowReasonModal(false);
        setPauseReason('');
    };

    const handleHold = () => {
        const reason = window.prompt('Enter reason for holding this order:');
        if (reason) {
            onStatusChange(order._id, 'Hold', { pauseReason: reason });
        }
    };

    const handleCancel = () => {
        if (window.confirm('Are you sure you want to cancel this order?')) {
            onStatusChange(order._id, 'Cancelled');
        }
    };

    const handleApproveRate = () => {
        if (window.confirm('Approve the rate for this order?')) {
            onStatusChange(order._id, 'Rate Approved');
        }
    };

    const handleCancelRateRequest = () => {
        if (window.confirm('Cancel the rate request?')) {
            onStatusChange(order._id, 'Ordered');
        }
    };

    const handleDispatch = () => {
        if (window.confirm('Mark this order as dispatched?')) {
            onStatusChange(order._id, 'Dispatch');
        }
    };

    const handleEditReason = () => {
        const newReason = window.prompt('Edit reason:', order.pauseReason || '');
        if (newReason !== null && newReason.trim()) {
            // Use updateOrderStatus to update the reason while keeping the same status
            onStatusChange(order._id, order.status, { pauseReason: newReason.trim() });
        }
    };

    // Adjustment handlers
    const handleAddAdjustment = (type) => {
        setAdjustmentType(type);
        setAdjustmentDescription('');
        setAdjustmentAmount('');
        setShowAdjustmentModal(true);
    };

    const handleSubmitAdjustment = async () => {
        if (!adjustmentDescription.trim()) {
            alert('Please enter a description');
            return;
        }
        const amount = parseFloat(adjustmentAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            const result = await adminApi.addAdjustment(order._id, adjustmentDescription, amount, adjustmentType);
            setShowAdjustmentModal(false);
            setAdjustmentDescription('');
            setAdjustmentAmount('');

            // Instantly update local order state with returned data - no API refetch needed!
            if (result.order && onOrderUpdate) {
                onOrderUpdate(result.order);
            } else if (onRefresh) {
                // Fallback to refetch if onOrderUpdate not provided
                await onRefresh();
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleRemoveAdjustment = async (adjustmentId) => {
        if (!window.confirm('Remove this adjustment?')) return;

        try {
            const result = await adminApi.removeAdjustment(order._id, adjustmentId);

            // Instantly update local order state with returned data - no API refetch needed!
            if (result.order && onOrderUpdate) {
                onOrderUpdate(result.order);
            } else if (onRefresh) {
                // Fallback to refetch if onOrderUpdate not provided
                await onRefresh();
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    // Render action buttons based on status
    const renderActionButtons = () => {
        switch (order.status) {
            case 'Ordered':
                return (
                    <>
                        <button onClick={handleConfirm} className={styles.btnConfirm}>Confirm</button>
                        <button onClick={handlePause} className={styles.btnPause}>Pause</button>
                        <button onClick={handleCancel} className={styles.btnCancel}>Cancel</button>
                    </>
                );
            case 'Rate Requested':
                return (
                    <>
                        <button onClick={handleApproveRate} className={styles.btnApprove}>Approve Rate</button>
                        <button onClick={handleCancelRateRequest} className={styles.btnCancel}>Cancel Request</button>
                    </>
                );
            case 'Rate Approved':
                return (
                    <>
                        <button onClick={handleConfirm} className={styles.btnConfirm}>Confirm</button>
                        <button onClick={handleHold} className={styles.btnHold}>Hold</button>
                        <button onClick={handleCancelRateRequest} className={styles.btnCancel}>Cancel Request</button>
                    </>
                );
            case 'Confirmed':
                return (
                    <>
                        <button onClick={handleDispatch} className={styles.btnDispatch}>Dispatch</button>
                        <button onClick={handleHold} className={styles.btnHold}>Hold</button>
                        <button onClick={handleCancel} className={styles.btnCancel}>Cancel</button>
                    </>
                );
            case 'Dispatch':
            case 'Partially Delivered':
                return (
                    <>
                        <button className={styles.btnDeliver}>Record Delivery</button>
                    </>
                );
            case 'Paused':
            case 'Hold':
                return (
                    <>
                        <button onClick={handleEditReason} className={styles.btnEdit}>Edit Reason</button>
                        <button onClick={handleConfirm} className={styles.btnConfirm}>Resume & Confirm</button>
                        <button onClick={handleCancel} className={styles.btnCancel}>Cancel</button>
                    </>
                );
            case 'Delivered':
            case 'Cancelled':
                // No actions for delivered or cancelled orders
                return null;
            default:
                return null;
        }
    };

    return (
        <>
            <div className={styles.orderCard}>
                <div className={styles.orderCardHeader} onClick={onToggleExpand}>
                    <div>
                        <strong>ID: {order.customOrderId || 'N/A'}</strong> - {order.user?.name || 'N/A'} ({order.user?.mobile || 'N/A'})
                    </div>
                    <div style={{ color: getStatusColor(), fontWeight: 'bold' }}>
                        {order.status}
                    </div>
                </div>

                {isExpanded && (
                    <div className={styles.orderCardBody}>
                        <div className={styles.orderInfo}>
                            <div>
                                <strong>Customer:</strong> {order.user?.name} ({order.user?.mobile})<br />
                                <strong>Ordered at:</strong> {formatDate(order.createdAt)}
                            </div>
                        </div>

                        <hr />

                        <ul className={styles.itemList}>
                            {order.items?.map((item, index) => (
                                <li key={index} className={styles.orderItemRow}>
                                    <div className={styles.itemName}>{item.name}</div>
                                    <div className={styles.itemQty}>
                                        {item.quantityOrdered} {item.unit || ''} × {formatCurrency(item.price)}
                                    </div>
                                    <div className={styles.itemPrice}>
                                        {formatCurrency(item.quantityOrdered * item.price)}
                                    </div>
                                </li>
                            ))}

                            <li className={styles.orderTotal}>
                                <div></div>
                                <div><strong>Total Amount:</strong></div>
                                <div><strong>{formatCurrency(totalAmount)}</strong></div>
                            </li>

                            {order.adjustments && order.adjustments.length > 0 && (
                                <>
                                    {order.adjustments.map((adj, index) => (
                                        <li key={index} className={styles.adjustmentRow}>
                                            <div>
                                                {!adj.isLocked && (
                                                    <button
                                                        onClick={() => handleRemoveAdjustment(adj._id)}
                                                        className={styles.removeAdjustmentBtn}
                                                        title="Remove"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            <div>
                                                {adj.description}
                                                {adj.isLocked && <span style={{ color: '#6c757d', fontSize: '0.85em' }}> (Locked)</span>}:
                                            </div>
                                            <div style={{ color: adj.type === 'charge' ? '#dc3545' : '#28a745' }}>
                                                {adj.type === 'charge' ? '+' : '-'}{formatCurrency(adj.amount)}
                                            </div>
                                        </li>
                                    ))}

                                    <li className={styles.orderTotal}>
                                        <div></div>
                                        <div><strong>Balance Amount:</strong></div>
                                        <div><strong style={{ color: '#007bff' }}>{formatCurrency(finalTotal)}</strong></div>
                                    </li>
                                </>
                            )}
                        </ul>

                        {/* Adjustment Buttons */}
                        {!['Delivered', 'Cancelled'].includes(order.status) && (
                            <div className={styles.adjustmentButtons}>
                                <button onClick={() => handleAddAdjustment('charge')} className={styles.btnAddCharge}>
                                    + Charge
                                </button>
                                <button onClick={() => handleAddAdjustment('discount')} className={styles.btnAddDiscount}>
                                    + Discount
                                </button>
                                <button onClick={() => handleAddAdjustment('advance')} className={styles.btnAddAdvance}>
                                    + Advance
                                </button>
                            </div>
                        )}

                        {(order.status === 'Paused' || order.status === 'Hold') && order.pauseReason && (
                            <div className={styles.reasonBox}>
                                <strong>Reason:</strong> {order.pauseReason}
                            </div>
                        )}

                        <div className={styles.orderActions}>
                            {renderActionButtons()}
                        </div>
                    </div>
                )}
            </div>

            {/* Pause Reason Modal */}
            {showReasonModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>Pause Order</h3>
                        <p>Enter reason for pausing this order:</p>
                        <textarea
                            value={pauseReason}
                            onChange={(e) => setPauseReason(e.target.value)}
                            placeholder="Reason for pausing..."
                            rows="4"
                            className={styles.modalTextarea}
                        />
                        <div className={styles.modalActions}>
                            <button onClick={handleSubmitPause} className={styles.btnConfirm}>Submit</button>
                            <button onClick={() => setShowReasonModal(false)} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Adjustment Modal */}
            {showAdjustmentModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>Add {adjustmentType.charAt(0).toUpperCase() + adjustmentType.slice(1)}</h3>
                        <div className={styles.formGroup}>
                            <label>Description</label>
                            <input
                                type="text"
                                value={adjustmentDescription}
                                onChange={(e) => setAdjustmentDescription(e.target.value)}
                                placeholder="Enter description..."
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Amount (₹)</label>
                            <input
                                type="number"
                                value={adjustmentAmount}
                                onChange={(e) => setAdjustmentAmount(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={handleSubmitAdjustment} className={styles.btnConfirm}>Add</button>
                            <button onClick={() => setShowAdjustmentModal(false)} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
