import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import staffApi from '../staffApi'; // Using Staff API service
import OrderCard from '../../admin/orders/OrderCard'; // Reusing OrderCard
import styles from '../../admin/adminStyles.module.css'; // Reusing Admin Styles

/**
 * StaffOrderList component for displaying orders filtered by status
 * Adapted from Admin OrderList with staff-specific API calls
 */
export default function StaffOrderList({ status, title, refreshTrigger }) {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [creatingUser, setCreatingUser] = useState(false);
    const [locations, setLocations] = useState(null);
    const [newUser, setNewUser] = useState({
        mobile: '',
        name: '',
        email: '',
        district: '',
        taluk: '',
        address: '',
        pincode: '',
        altMobile: '',
        isRateRequestEnabled: true
    });
    const [validationError, setValidationError] = useState('');

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
        fetchLocations();
    }, [refreshTrigger]);

    const fetchLocations = async () => {
        try {
            const data = await staffApi.getLocations();
            setLocations(data);
        } catch (err) {
            console.error('Error fetching locations:', err);
        }
    };

    /**
     * Calculate whether an order's balance is fully cleared.
     * Balance cleared = total order value - received payments <= 0
     */
    const isBalanceCleared = (order) => {
        // Calculate item totals
        const totalAmount = order.items?.reduce(
            (sum, item) => sum + (item.quantityOrdered * item.price), 0
        ) || 0;

        // Calculate adjustments (including delivery payments synced as 'advance')
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
                if (status === 'dispatch') return order.status.startsWith('Dispatch') || order.status === 'Partially Delivered';
                if (status === 'balance') {
                    const isRelevantStatus = order.status === 'Delivered' || order.status.startsWith('Dispatch') || order.status === 'Partially Delivered';
                    return isRelevantStatus && !isBalanceCleared(order);
                }
                if (status === 'paused') return order.status === 'Paused';
                if (status === 'hold') return order.status === 'Hold';
                if (status === 'delivered') return order.status === 'Delivered' && !isBalanceCleared(order);
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
        setExpandedOrderId(prev => prev === orderId ? null : orderId);
    };

    // Staff might not have full update permissions, but updateOrderStatus is shared
    const handleOrderStatusChange = async (orderId, newStatus, additionalData = {}) => {
        try {
            await staffApi.updateOrderStatus(orderId, newStatus, additionalData);
            
            // Map status to route for redirection
            let targetRoute = '/staff/pending';
            if (newStatus === 'Rate Requested') targetRoute = '/staff/rate-requested';
            else if (newStatus === 'Rate Approved') targetRoute = '/staff/rate-approved';
            else if (newStatus === 'Confirmed') targetRoute = '/staff/confirmed';
            else if (newStatus === 'Dispatch' || newStatus === 'Partially Delivered') targetRoute = '/staff/dispatch';
            else if (newStatus === 'Delivered') {
                // Redirect to delivered tab as requested
                targetRoute = '/staff/delivered';
            }
            else if (newStatus === 'Completed') targetRoute = '/staff/completed';
            else if (newStatus === 'Paused') targetRoute = '/staff/paused';
            else if (newStatus === 'Hold') targetRoute = '/staff/hold';
            else if (newStatus === 'Cancelled') targetRoute = '/staff/cancelled';

            // Navigate to the target route after successful update
            navigate(targetRoute);

            // Refresh orders after status change (if we are still on the same page category)
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

    const handleUserInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewUser(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        if (name === 'district') {
            setNewUser(prev => ({ ...prev, taluk: '' }));
        }
        setValidationError('');
    };

    const validateForm = () => {
        if (!newUser.name || !newUser.mobile) {
            return `Please fill required fields (Name and Mobile).`;
        }
        if (!/^\d{10}$/.test(newUser.mobile)) {
            return 'Mobile number must be exactly 10 digits.';
        }
        if (!/^[6-9]/.test(newUser.mobile)) {
            return 'Enter a Valid Mobile Number';
        }
        if (/^(\d)\1{9}$/.test(newUser.mobile)) {
            return 'Invalid mobile number.';
        }
        if (newUser.altMobile) {
            if (!/^\d{10}$/.test(newUser.altMobile)) {
                return 'Alternative mobile number must be exactly 10 digits.';
            }
            if (!/^[6-9]/.test(newUser.altMobile)) {
                return 'Enter a Valid Alternative Mobile Number';
            }
            if (/^(\d)\1{9}$/.test(newUser.altMobile)) {
                return 'Invalid alternative mobile number.';
            }
        }
        if (newUser.name.length > 29) {
            return 'Name must be 29 characters or less.';
        }
        if (newUser.email && !/\S+@\S+\.\S+/.test(newUser.email)) {
            return 'Please enter a valid email address.';
        }
        if (newUser.address && newUser.address.length > 250) {
            return 'Address must be 250 characters or less.';
        }
        if (newUser.pincode && !/^\d{6}$/.test(newUser.pincode)) {
            return 'Pincode must be exactly 6 digits.';
        }
        return null;
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setValidationError('');

        const errorMsg = validateForm();
        if (errorMsg) {
            setValidationError(errorMsg);
            return;
        }

        setCreatingUser(true);
        try {
            await staffApi.createUser(newUser);
            alert('User created successfully!');
            setShowCreateUserModal(false);
            setNewUser({
                mobile: '',
                name: '',
                email: '',
                district: '',
                taluk: '',
                address: '',
                pincode: '',
                altMobile: '',
                isRateRequestEnabled: true
            });
        } catch (err) {
            setValidationError(err.message);
        } finally {
            setCreatingUser(false);
        }
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
            <div className={styles.sectionHeader}>
                <h3>{title} ({filteredOrders.length})</h3>
                {status === 'pending' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => navigate('/staff/create-order')}
                            className={styles.btnAdd}
                        >
                            + Create Order
                        </button>
                    </div>
                )}
            </div>

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
                            isExpanded={expandedOrderId === order._id}
                            onToggleExpand={() => toggleOrderExpand(order._id)}
                            onStatusChange={handleOrderStatusChange}
                            onRefresh={fetchOrders}
                            onOrderUpdate={handleSingleOrderUpdate}
                            api={staffApi} // Inject Staff API
                            isAdmin={false}
                            isBalanceTab={status === 'balance'}
                            isDispatchTab={status === 'dispatch'}
                            refreshTrigger={refreshTrigger}
                        />
                    ))}
                </div>
            )}

            {/* Create User Modal */}
            {showCreateUserModal && (
                <div 
                    className={styles.modal} 
                    style={{ zIndex: 1100 }}
                    onClick={() => setShowCreateUserModal(false)}
                >
                    <div 
                        className={styles.modalContent} 
                        style={{ maxWidth: '700px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                            <h3 style={{ margin: 0, color: '#202124' }}>Create New User</h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateUserModal(false)}
                                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser}>
                            <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Full Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Customer name"
                                        value={newUser.name}
                                        onChange={handleUserInputChange}
                                        className={styles.modalInput}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Mobile *</label>
                                    <input
                                        type="text"
                                        name="mobile"
                                        placeholder="10-digit mobile"
                                        value={newUser.mobile}
                                        onChange={handleUserInputChange}
                                        maxLength="10"
                                        className={styles.modalInput}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Alt Mobile</label>
                                    <input
                                        type="text"
                                        name="altMobile"
                                        placeholder="Alternative mobile"
                                        value={newUser.altMobile}
                                        onChange={handleUserInputChange}
                                        maxLength="10"
                                        className={styles.modalInput}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>District</label>
                                    <select
                                        name="district"
                                        value={newUser.district}
                                        onChange={handleUserInputChange}
                                        className={styles.modalSelect}
                                    >
                                        <option value="">Select District</option>
                                        {locations && Object.keys(locations).sort().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Taluk</label>
                                    <select
                                        name="taluk"
                                        value={newUser.taluk}
                                        onChange={handleUserInputChange}
                                        className={styles.modalSelect}
                                        disabled={!newUser.district}
                                    >
                                        <option value="">Select Taluk</option>
                                        {newUser.district && locations?.[newUser.district]?.sort().map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Pincode</label>
                                    <input
                                        type="text"
                                        name="pincode"
                                        placeholder="6-digit pincode"
                                        value={newUser.pincode}
                                        onChange={handleUserInputChange}
                                        maxLength="6"
                                        className={styles.modalInput}
                                    />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Address</label>
                                    <textarea
                                        name="address"
                                        placeholder="Full Address"
                                        value={newUser.address}
                                        onChange={handleUserInputChange}
                                        className={styles.modalInput}
                                        style={{ height: '80px', resize: 'vertical', paddingTop: '10px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Email Address"
                                        value={newUser.email}
                                        onChange={handleUserInputChange}
                                        className={styles.modalInput}
                                    />
                                </div>

                                {validationError && (
                                    <div style={{
                                        gridColumn: '1 / -1',
                                        color: '#d93025',
                                        fontSize: '13px',
                                        marginTop: '5px',
                                        fontWeight: '500',
                                        padding: '8px 12px',
                                        background: '#fce8e6',
                                        borderRadius: '4px'
                                    }}>
                                        {validationError}
                                    </div>
                                )}

                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateUserModal(false)}
                                        className={styles.btnCancel}
                                        style={{ padding: '8px 25px' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creatingUser}
                                        className={styles.btnConfirm}
                                        style={{ padding: '8px 25px' }}
                                    >
                                        {creatingUser ? 'Creating...' : 'Create User'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
