import React, { useState } from 'react';
import styles from '../adminStyles.module.css';
import adminApi from '../adminApi';

export default function OrderCard({ order, isExpanded, onToggleExpand, onUpdate, onStatusChange, onRefresh, onOrderUpdate, api = adminApi }) {
    // Consolidated Reason Modal State
    const [reasonModal, setReasonModal] = useState({
        show: false,
        action: null, // 'Paused', 'Hold', or 'Edit'
        title: '',
        message: ''
    });
    const [reasonText, setReasonText] = useState('');

    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [adjustmentType, setAdjustmentType] = useState('charge');
    const [adjustmentDescription, setAdjustmentDescription] = useState('');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');

    // Dispatch Modal State
    const [showAgentModal, setShowAgentModal] = useState(false);
    const [agentForm, setAgentForm] = useState({
        name: '',
        mobile: '',
        description: '',
        address: ''
    });

    // Delivery Modal State
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [deliveryItems, setDeliveryItems] = useState([]);

    // Delivery History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [deliveryHistory, setDeliveryHistory] = useState([]);

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

    // Check if all items are fully delivered
    const allItemsDelivered = order.status === 'Dispatch' || order.status === 'Partially Delivered'
        ? order.items?.every(item => {
            const delivered = item.quantityDelivered || 0;
            const ordered = item.quantityOrdered || 0;
            return Math.abs(ordered - delivered) < 0.001; // tolerance for floats
        }) || false
        : false;

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

    // --- Unified Reason Handlers ---

    const handlePause = () => {
        setReasonText('');
        setReasonModal({
            show: true,
            action: 'Paused',
            title: 'Pause Order',
            message: 'Enter reason for pausing this order:'
        });
    };

    const handleHold = () => {
        setReasonText('');
        setReasonModal({
            show: true,
            action: 'Hold',
            title: 'Hold Order',
            message: 'Enter reason for putting this order on hold:'
        });
    };

    const handleEditReason = () => {
        setReasonText(order.pauseReason || '');
        setReasonModal({
            show: true,
            action: 'Edit',
            title: 'Edit Reason',
            message: 'Update the reason:'
        });
    };

    const handleSubmitReason = () => {
        if (!reasonText.trim()) {
            alert('Please enter a reason.');
            return;
        }

        const { action } = reasonModal;

        if (action === 'Edit') {
            // Keep current status, just update reason
            onStatusChange(order._id, order.status, { pauseReason: reasonText.trim() });
        } else {
            // 'Paused' or 'Hold'
            onStatusChange(order._id, action, { pauseReason: reasonText.trim() });
        }

        closeReasonModal();
    };

    const closeReasonModal = () => {
        setReasonModal({ show: false, action: null, title: '', message: '' });
        setReasonText('');
    };

    // -------------------------------

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

    // Dispatch handlers
    const handleDispatch = () => {
        // Open agent assignment modal
        setAgentForm({
            name: order.deliveryAgent?.name || '',
            mobile: order.deliveryAgent?.mobile || '',
            description: order.deliveryAgent?.description || '',
            address: order.deliveryAgent?.address || ''
        });
        setShowAgentModal(true);
    };

    const handleAssignAgent = async () => {
        if (!agentForm.name.trim()) {
            alert('Please enter agent name');
            return;
        }

        try {
            await api.assignAgent(
                order._id,
                agentForm.name,
                agentForm.mobile,
                agentForm.description,
                agentForm.address
            );

            // Also change status to Dispatch
            await onStatusChange(order._id, 'Dispatch');

            setShowAgentModal(false);
            if (onRefresh) await onRefresh();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleOpenDeliveryModal = () => {
        // Initialize delivery form with order items
        const items = order.items.map(item => ({
            productId: item.product,
            name: item.name,
            unit: item.unit,
            quantityOrdered: item.quantityOrdered,
            quantityDelivered: item.quantityDelivered || 0,
            remainingQty: item.quantityOrdered - (item.quantityDelivered || 0),
            toDeliver: 0
        }));
        setDeliveryItems(items);
        setShowDeliveryModal(true);
    };

    const handleDeliveryQuantityChange = (index, value) => {
        const newItems = [...deliveryItems];
        const qty = parseFloat(value) || 0;
        const maxQty = newItems[index].remainingQty;
        newItems[index].toDeliver = Math.min(Math.max(0, qty), maxQty);
        setDeliveryItems(newItems);
    };

    const handleRecordDelivery = async () => {
        const deliveries = deliveryItems
            .filter(item => item.toDeliver > 0)
            .map(item => ({
                productId: item.productId,
                quantity: item.toDeliver
            }));

        if (deliveries.length === 0) {
            alert('Please enter quantities to deliver');
            return;
        }

        if (!window.confirm(`Record delivery for ${deliveries.length} item(s)?`)) {
            return;
        }

        try {
            await api.recordDelivery(order._id, deliveries);
            setShowDeliveryModal(false);
            if (onRefresh) await onRefresh();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleMarkDelivered = () => {
        if (window.confirm('Mark this order as fully delivered?')) {
            onStatusChange(order._id, 'Delivered');
        }
    };

    const handleViewHistory = async () => {
        try {
            const deliveries = await api.getDeliveryHistory(order._id);
            setDeliveryHistory(deliveries || []);
            setShowHistoryModal(true);
        } catch (err) {
            alert(`Error: ${err.message}`);
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
            const result = await api.addAdjustment(order._id, adjustmentDescription, amount, adjustmentType);
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
            // Use api (staff/admin specific)
            const result = await api.removeAdjustment(order._id, adjustmentId);

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
                if (allItemsDelivered) {
                    return (
                        <>
                            <button onClick={handleMarkDelivered} className={styles.btnDeliver}>
                                Mark as Delivered
                            </button>
                            <button onClick={handleViewHistory} className={styles.btnEdit}>View History</button>
                            <button onClick={handleDispatch} className={styles.btnEdit}>Edit Agent</button>
                        </>
                    );
                } else {
                    return (
                        <>
                            <button onClick={handleOpenDeliveryModal} className={styles.btnDeliver}>Record Delivery</button>
                            <button onClick={handleViewHistory} className={styles.btnEdit}>View History</button>
                            <button onClick={handleDispatch} className={styles.btnEdit}>Edit Agent</button>
                        </>
                    );
                }
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

                        {/* Delivery Agent Information */}
                        {(order.status === 'Dispatch' || order.status === 'Partially Delivered') && order.deliveryAgent && (
                            <div style={{
                                marginTop: '15px',
                                padding: '15px',
                                backgroundColor: '#e7f3ff',
                                borderRadius: '8px',
                                border: '1px solid #b3d9ff'
                            }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#0056b3', fontSize: '16px' }}>
                                    📦 Delivery Agent
                                </h4>
                                <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                                    <div><strong>Name:</strong> {order.deliveryAgent.name}</div>
                                    {order.deliveryAgent.mobile && (
                                        <div><strong>Mobile:</strong> {order.deliveryAgent.mobile}</div>
                                    )}
                                    {order.deliveryAgent.description && (
                                        <div><strong>Description:</strong> {order.deliveryAgent.description}</div>
                                    )}
                                    {order.deliveryAgent.address && (
                                        <div><strong>Address:</strong> {order.deliveryAgent.address}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className={styles.orderActions}>
                            {renderActionButtons()}
                        </div>
                    </div>
                )}
            </div>

            {/* Unified Reason Modal (Pause / Hold / Edit) */}
            {reasonModal.show && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>{reasonModal.title}</h3>
                        <p>{reasonModal.message}</p>
                        <textarea
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            placeholder="Type reason here..."
                            rows="4"
                            className={styles.modalTextarea}
                            autoFocus
                        />
                        <div className={styles.modalActions}>
                            <button onClick={handleSubmitReason} className={styles.btnConfirm}>Submit</button>
                            <button onClick={closeReasonModal} className={styles.btnCancel}>Cancel</button>
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

            {/* Agent Assignment Modal */}
            {showAgentModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>Assign Delivery Agent</h3>
                        <div className={styles.formGroup}>
                            <label>Agent Name *</label>
                            <input
                                type="text"
                                value={agentForm.name}
                                onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                                placeholder="Enter agent name"
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Agent Mobile</label>
                            <input
                                type="text"
                                value={agentForm.mobile}
                                onChange={(e) => setAgentForm({ ...agentForm, mobile: e.target.value })}
                                placeholder="Enter mobile number"
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Description</label>
                            <input
                                type="text"
                                value={agentForm.description}
                                onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                                placeholder="Vehicle, ETA, etc."
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Delivery Address</label>
                            <textarea
                                value={agentForm.address}
                                onChange={(e) => setAgentForm({ ...agentForm, address: e.target.value })}
                                placeholder="Enter delivery address"
                                rows="3"
                                className={styles.modalTextarea}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={handleAssignAgent} className={styles.btnConfirm}>Assign & Dispatch</button>
                            <button onClick={() => setShowAgentModal(false)} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Record Delivery Modal */}
            {showDeliveryModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent} style={{ maxWidth: '700px' }}>
                        <h3>Record Delivery</h3>
                        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                            Enter quantities to deliver for each item:
                        </p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #ddd' }}>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>Product</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>Ordered</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>Delivered</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>Remaining</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>Deliver Now</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deliveryItems.map((item, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '8px' }}>{item.name}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            {item.quantityOrdered} {item.unit}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            {item.quantityDelivered} {item.unit}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {item.remainingQty.toFixed(2)} {item.unit}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                value={item.toDeliver || ''}
                                                onChange={(e) => handleDeliveryQuantityChange(index, e.target.value)}
                                                min="0"
                                                max={item.remainingQty}
                                                step="0.1"
                                                placeholder="Qty"
                                                disabled={item.remainingQty <= 0}
                                                style={{
                                                    width: '70px',
                                                    padding: '4px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px',
                                                    textAlign: 'center'
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                            <button onClick={handleRecordDelivery} className={styles.btnConfirm}>Record Delivery</button>
                            <button onClick={() => setShowDeliveryModal(false)} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delivery History Modal */}
            {showHistoryModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent} style={{ maxWidth: '700px' }}>
                        <h3>Delivery History</h3>
                        {deliveryHistory.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                No deliveries recorded yet.
                            </p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '15px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Date/Time</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Product</th>
                                        <th style={{ padding: '8px', textAlign: 'center' }}>Quantity</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Agent</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deliveryHistory.map((delivery, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '8px' }}>
                                                {new Date(delivery.deliveryDate || delivery.createdAt).toLocaleString('en-IN', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                })}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {delivery.product?.name || 'Unknown Product'}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                {delivery.quantityDelivered} {delivery.product?.unit || ''}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {delivery.deliveryAgent?.name || 'N/A'}
                                                {delivery.deliveryAgent?.mobile && (
                                                    <><br /><small style={{ color: '#666' }}>{delivery.deliveryAgent.mobile}</small></>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                            <button onClick={() => setShowHistoryModal(false)} className={styles.btnCancel}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
