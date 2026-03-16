import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import * as api from '../services/api';
import './MyOrders.css';

export default function MyOrders() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deliveryHistories, setDeliveryHistories] = useState({});
    const [selectedHistory, setSelectedHistory] = useState(null); // For history modal
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [expandedHistoryIds, setExpandedHistoryIds] = useState({}); // Track which histories are expanded
    const [expandedCardIds, setExpandedCardIds] = useState({}); // Track which order cards are expanded

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [authLoading, isAuthenticated, navigate]);

    useEffect(() => {
        if (isAuthenticated) {
            loadOrders();
            connectToStream();
        }
    }, [isAuthenticated]);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const data = await api.getMyOrders();
            setOrders(data);

            // Fetch delivery histories for all orders to be safe
            const allOrderIds = data.map(o => o._id);
            if (allOrderIds.length > 0) {
                loadDeliveryHistories(allOrderIds);
            }

            // Check for newly delivered orders to celebrate
            data.forEach(order => {
                if (order.status === 'Delivered') {
                    celebrateDelivery(order._id);
                }
            });
        } catch (err) {
            console.error('Failed to load orders', err);
        } finally {
            setLoading(false);
        }
    };

    const loadDeliveryHistories = async (orderIds) => {
        try {
            const historyMap = { ...deliveryHistories };
            await Promise.all(orderIds.map(async (id) => {
                try {
                    const history = await api.getDeliveryHistory(id);
                    historyMap[id] = history || [];
                } catch (err) {
                    console.error(`Failed to load history for ${id}`, err);
                    historyMap[id] = [];
                }
            }));
            setDeliveryHistories(historyMap);
        } catch (err) {
            console.error('Failed to load delivery histories', err);
        }
    };

    const connectToStream = () => {
        const eventSource = new EventSource('/api/myorders/stream');
        eventSource.onmessage = (event) => {
            if (event.data === 'order_status_updated') {
                loadOrders();
            }
        };
        eventSource.onerror = () => {
            eventSource.close();
        };
        return () => eventSource.close();
    };

    const celebrateDelivery = (orderId) => {
        const celebratedOrders = JSON.parse(localStorage.getItem('celebratedOrders') || '[]');
        if (celebratedOrders.includes(orderId)) return;

        celebratedOrders.push(orderId);
        localStorage.setItem('celebratedOrders', JSON.stringify(celebratedOrders));

        // Create confetti and popup
        document.body.classList.add('celebrating');
        const popup = document.createElement('div');
        popup.className = 'delivery-celebration-popup';
        popup.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-icon">🎉</div>
        <h2>Order Delivered!</h2>
        <p>Thank you for your order</p>
        <div class="celebration-check">✓</div>
      </div>
    `;
        document.body.appendChild(popup);

        setTimeout(() => {
            popup.classList.add('fade-out');
            document.body.classList.remove('celebrating');
            setTimeout(() => popup.remove(), 500);
        }, 5000);
    };

    const formatDate = (dateString, includeTime = true) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        if (!includeTime) return date.toLocaleDateString();
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const groupDeliveries = (deliveries) => {
        if (!deliveries || deliveries.length === 0) return [];

        // Group by time (within 5 seconds)
        const groups = [];
        const sortedDeliveries = [...deliveries].sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate));

        sortedDeliveries.forEach(del => {
            const delDate = new Date(del.deliveryDate);
            const group = groups.find(g => Math.abs(new Date(g.date) - delDate) < 5000);

            if (group) {
                group.items.push(del);
            } else {
                groups.push({
                    date: del.deliveryDate,
                    items: [del]
                });
            }
        });

        // Add sequence number to groups (Delivery 1, Delivery 2, ...)
        return groups.map((group, index) => ({
            ...group,
            deliveryNumber: index + 1
        })).sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const handleViewHistoryDetails = (group) => {
        setSelectedHistory(group);
        setShowHistoryModal(true);
    };

    const toggleHistoryExpand = (orderId) => {
        setExpandedHistoryIds(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const toggleCardExpand = (orderId) => {
        setExpandedCardIds(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const handleEditOrder = (order) => {
        const itemsForCart = order.items.map(item => ({
            productId: item.productId,
            productName: item.product || item.name,
            quantity: item.quantity,
            unit: item.unit,
            description: item.description
        }));

        sessionStorage.setItem('orderToEdit', JSON.stringify({
            orderId: order._id,
            items: itemsForCart
        }));

        navigate('/');
    };

    const generateStatusFlow = (order, isExpanded) => {
        const { status } = order;
        const isDelivered = status === 'Delivered';
        const isCancelled = status === 'Cancelled';
        const isInterrupt = status === 'Paused' || status === 'Hold';

        // Get actual delivery batches from grouped deliveries
        const groups = groupDeliveries(deliveryHistories[order._id]) || [];
        const hasHistory = groups.length > 0;
        const currentDeliveryNum = groups.length;

        // Build flow steps
        const flowSteps = [
            { key: 'Ordered', label: 'Ordered' },
            { key: 'Confirmed', label: 'Confirmed' },
            {
                key: 'Dispatch', label: hasHistory
                    ? `Delivery ${currentDeliveryNum}`
                    : (status === 'Dispatch' && !order.deliveryAgent?.name ? 'Ready to Dispatch' : 'Dispatch')
            },
            { key: 'Delivered', label: 'Delivered' }
        ];

        // Calculate current position
        let currentIndex = 0;
        if (status === 'Ordered' || status === 'Rate Requested' || status === 'Rate Approved') currentIndex = 0;
        else if (status === 'Confirmed') currentIndex = 1;
        else if (status === 'Dispatch' || status === 'Partially Delivered') currentIndex = 2;
        else if (status === 'Delivered') currentIndex = 3;

        if (isCancelled) {
            return (
                <div className="order-status-flow">
                    <div className="progress-line" style={{ width: '0%' }}></div>
                    <div className="status-step cancelled">
                        <div className="step-icon">
                            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                        </div>
                        <span className="step-label">Cancelled</span>
                    </div>
                </div>
            );
        }

        // Only show progress if the card is expanded to trigger fill animation
        const actualProgressWidth = isDelivered ? 100 : (currentIndex > 0 ? (currentIndex / (flowSteps.length - 1)) * 100 : 0);
        const progressWidth = isExpanded ? actualProgressWidth : 0;

        return (
            <div className={`order-status-flow ${isDelivered ? 'delivered' : ''} ${isExpanded ? 'flow-expanded' : ''}`}>
                <div className="progress-line" style={{ width: `${progressWidth}%` }}></div>
                {flowSteps.map((step, index) => {
                    let stepClass = 'status-step';
                    let iconContent = null;

                    if (isInterrupt && index === 0) {
                        stepClass += ' interrupt';
                        return (
                            <div key={step.key} className={stepClass} style={{ '--index': index }}>
                                <div className="step-icon"></div>
                                <span className="step-label">{status === 'Paused' ? 'Paused' : 'On Hold'}</span>
                            </div>
                        );
                    } else if (isDelivered || index < currentIndex) {
                        stepClass += ' completed';
                        iconContent = <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>;
                    } else if (index === currentIndex && !isInterrupt) {
                        stepClass += ' current';
                    }

                    return (
                        <div key={step.key} className={stepClass} style={{ '--index': index }}>
                            <div className="step-icon">{iconContent}</div>
                            <span className="step-label">{step.label}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (authLoading || loading) {
        return <LoadingSpinner message="Loading orders..." />;
    }

    return (
        <div className="myorders-page">
            <Navbar />

            <div className="orders-container">
                <h1 className="orders-title">My Orders</h1>

                {orders.length === 0 ? (
                    <div className="no-orders">
                        <p>Make your order</p>
                        <Link to="/" className="btn">Click To Make Order</Link>
                    </div>
                ) : (
                    <div className="orders-list">
                        {orders.map(order => {
                            const isDelivered = order.status === 'Delivered';
                            const isCancelled = order.status === 'Cancelled';
                            const isCollapsible = isDelivered || isCancelled;
                            const isExpanded = !isCollapsible || !!expandedCardIds[order._id];

                            return (
                                <div key={order._id} className={`order-card card ${isExpanded ? 'expanded' : ''} ${!isCollapsible ? 'always-expanded' : ''}`}>
                                    <div
                                        className={`order-card-header ${!isCollapsible ? 'no-toggle' : ''}`}
                                        onClick={() => isCollapsible && toggleCardExpand(order._id)}
                                    >
                                        <div className="header-info">
                                            <p><strong>Order:</strong> {formatDate(order.createdAt)}</p>
                                            <p className="header-status-badge">{order.status}</p>
                                        </div>
                                        {isCollapsible && (
                                            <div className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>▼</div>
                                        )}
                                    </div>

                                    <div className="order-card-body">
                                        {generateStatusFlow(order, isExpanded)}

                                        {order.status === 'Paused' && order.pauseReason && (
                                            <div className="pause-reason">
                                                <strong>Reason for Pause:</strong>
                                                <p>{order.pauseReason}</p>
                                            </div>
                                        )}

                                        <hr />

                                        <strong>Items in this Order:</strong>
                                        <ul className="item-list">
                                            {order.items.map((item, i) => (
                                                <li key={i}>
                                                    <strong>{item.name || item.product}</strong>
                                                    {item.description && (
                                                        <><br /><span className="item-desc">{item.description}</span></>
                                                    )}
                                                    {' '}- {item.quantity} {item.unit || ''}
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="order-actions">
                                            {(order.status === 'Ordered' || order.status === 'Paused') && (
                                                <button className="edit-order-btn" onClick={() => handleEditOrder(order)}>
                                                    Edit Order
                                                </button>
                                            )}
                                            {order.status === 'Delivered' && (
                                                <p className="status-message success">✓ Order Delivered</p>
                                            )}
                                            {order.status === 'Cancelled' && (
                                                <p className="status-message error">This order has been cancelled.</p>
                                            )}
                                            {order.status === 'Hold' && (
                                                <p className="status-message warning">Your order is on hold. We will contact you shortly.</p>
                                            )}
                                            {order.status === 'Dispatch' && (
                                                <p className="status-message success">
                                                    {groupDeliveries(deliveryHistories[order._id])?.length > 0
                                                        ? `Your order is in Delivery ${groupDeliveries(deliveryHistories[order._id])?.length}!`
                                                        : 'Your order is in Dispatch!'}
                                                </p>
                                            )}
                                            {order.status === 'Partially Delivered' && (
                                                <p className="status-message success">
                                                    Your order is Partially Delivered! (Current: Delivery {groupDeliveries(deliveryHistories[order._id])?.length})
                                                </p>
                                            )}
                                            {order.status === 'Confirmed' && (
                                                <p className="status-message success">Order confirmed (Contact Company for changes)</p>
                                            )}

                                            {/* Delivery History Batches */}
                                            {deliveryHistories[order._id] && deliveryHistories[order._id].length > 0 && (
                                                <div className={`delivery-history-container ${expandedHistoryIds[order._id] ? 'expanded' : ''}`}>
                                                    <div
                                                        className="history-header-toggle"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleHistoryExpand(order._id);
                                                        }}
                                                    >
                                                        <p className="history-title">Delivery History ({groupDeliveries(deliveryHistories[order._id]).length})</p>
                                                        <span className={`toggle-icon ${expandedHistoryIds[order._id] ? 'rotated' : ''}`}>▼</span>
                                                    </div>

                                                    <div className="history-batches-wrapper">
                                                        {groupDeliveries(deliveryHistories[order._id]).map((group, idx) => (
                                                            <div key={idx} className="history-item-card" onClick={() => handleViewHistoryDetails(group)}>
                                                                <div className="history-item-header">
                                                                    <span className="history-status">Delivery {group.deliveryNumber}</span>
                                                                    <span className="history-date">{formatDate(group.date)}</span>
                                                                </div>
                                                                <div className="history-item-body">
                                                                    <p>{group.items.length} product(s) delivered in this batch</p>
                                                                    <span className="view-details-link">View Details →</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Delivery Agent Details */}
                                        {['Confirmed', 'Dispatch', 'Partially Delivered', 'Hold'].includes(order.status) &&
                                            order.deliveryAgent?.name && (
                                                <div className="agent-details">
                                                    <strong>Delivery Agent:</strong> {order.deliveryAgent.name}<br />
                                                    <strong>Contact:</strong> {order.deliveryAgent.mobile || 'N/A'}
                                                    {order.deliveryAgent.description && (
                                                        <><br /><span className="small"><strong>Note:</strong> {order.deliveryAgent.description}</span></>
                                                    )}
                                                    {order.deliveryAgent.address && (
                                                        <><br /><span className="small"><strong>Address:</strong> {order.deliveryAgent.address}</span></>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Delivery History Modal */}
            {showHistoryModal && selectedHistory && (
                <div className="history-modal-overlay" onClick={() => setShowHistoryModal(false)}>
                    <div className="history-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Delivery Details</h2>
                            <button className="close-modal-btn" onClick={() => setShowHistoryModal(false)} style={{ color: '#333' }}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-date"><strong>Date:</strong> {formatDate(selectedHistory.date)}</p>
                            <div className="delivered-items-list">
                                {selectedHistory.items.map((item, idx) => (
                                    <div key={idx} className="delivered-item-row">
                                        <div className="delivered-item-info">
                                            <span className="delivered-product-name">{item.product?.name || 'Unknown Product'}</span>
                                            {item.product?.description && (
                                                <span className="delivered-product-desc">{item.product.description}</span>
                                            )}
                                        </div>
                                        <div className="delivered-item-qty">
                                            {item.quantityDelivered} {item.product?.unit || ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
