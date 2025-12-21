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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
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

    const generateStatusFlow = (status, deliveryCount = 0) => {
        const isPartiallyDelivered = status === 'Partially Delivered';
        const isDelivered = status === 'Delivered';
        const isInterrupt = status === 'Paused' || status === 'Hold';
        const isCancelled = status === 'Cancelled';

        // Build flow steps
        let flowSteps = [
            { key: 'Ordered', label: 'Ordered' },
            { key: 'Confirmed', label: 'Confirmed' },
            { key: 'Dispatch', label: 'Out for Delivery' },
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

        const progressWidth = isDelivered ? 100 : (currentIndex > 0 ? (currentIndex / (flowSteps.length - 1)) * 100 : 0);

        return (
            <div className={`order-status-flow ${isDelivered ? 'delivered' : ''}`}>
                <div className="progress-line" style={{ width: `${progressWidth}%` }}></div>
                {flowSteps.map((step, index) => {
                    let stepClass = 'status-step';
                    let iconContent = null;

                    if (isInterrupt && index === 0) {
                        stepClass += ' interrupt';
                        return (
                            <div key={step.key} className={stepClass}>
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
                        <div key={step.key} className={stepClass}>
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
                        {orders.map(order => (
                            <div key={order._id} className="order-card card">
                                <p><strong>Ordered at:</strong> {formatDate(order.createdAt)}</p>

                                {generateStatusFlow(order.status)}

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
                                    {(order.status === 'Dispatch' || order.status === 'Partially Delivered') && (
                                        <p className="status-message success">Your order is out for delivery!</p>
                                    )}
                                    {order.status === 'Confirmed' && (
                                        <p className="status-message success">Order confirmed (Contact Company for changes)</p>
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
