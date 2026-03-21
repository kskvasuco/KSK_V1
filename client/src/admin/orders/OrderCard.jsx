
import React, { useState, useEffect, useRef } from 'react';
import { formatPrice } from '../../utils/priceFormatter';
import styles from '../adminStyles.module.css';
import adminApi from '../adminApi';
import AdminPasswordModal from '../components/AdminPasswordModal';

export default function OrderCard({
    order,
    isExpanded,
    onToggleExpand,
    onUpdate,
    onStatusChange,
    onRefresh,
    onOrderUpdate,
    api = adminApi,
    isAdmin = false,
    isBalanceTab, // New prop to identify if we are in Balance tab
    isDispatchTab // New prop to identify if we are in Dispatch tab
}) {
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
    const [deliveryRent, setDeliveryRent] = useState('');
    const [showItemsPopup, setShowItemsPopup] = useState(false);
    const [selectedBatchForItems, setSelectedBatchForItems] = useState(null);

    // Delivery History Modal State
    const [deliveryHistory, setDeliveryHistory] = useState([]);
    const [confirmingBatch, setConfirmingBatch] = useState(null); // { key, date }
    const [confirmAmount, setConfirmAmount] = useState('');
    const [confirmPaymentMode, setConfirmPaymentMode] = useState('Cash'); // Default to Cash

    // Edit Order Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editItems, setEditItems] = useState([]); // { productId, name, unit, price, quantity, type: 'existing'|'new' }
    const [availableProducts, setAvailableProducts] = useState([]);
    const [productSearch, setProductSearch] = useState(null); // null means collapsed, '' means expanded showing all
    const [highlightedProductId, setHighlightedProductId] = useState(null);
    const itemRefs = useRef({});

    // Auth Modal State
    const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);

    // Payment Selection Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentModalType, setPaymentModalType] = useState('withHeader'); // 'plain' or 'withHeader'
    const [paymentSettings, setPaymentSettings] = useState([]);
    const [selectedPayments, setSelectedPayments] = useState({ primary: null, bank: null });
    const [isPayLoading, setIsPayLoading] = useState(false);
    const [showEditAgentModal, setShowEditAgentModal] = useState(false);
    const [editAgentModalData, setEditAgentModalData] = useState({
        dispatchId: null,
        form: { newDispatchId: '', name: '', mobile: '', description: '', address: '', rent: '' }
    });
    const cardRef = useRef(null);

    useEffect(() => {
        if (window.location.hash === `#${order._id}`) {
            setTimeout(() => {
                if (cardRef.current) {
                    cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (!isExpanded) onToggleExpand();
                }
            }, 500);
        }
    }, [order._id, isExpanded, onToggleExpand]);

    // Fetch delivery history when expanded and in relevant status
    useEffect(() => {
        const fetchHistory = async () => {
            if (isExpanded && (order.status === 'Dispatch' || order.status === 'Partially Delivered' || order.status === 'Delivered')) {
                try {
                    const deliveries = await api.getDeliveryHistory(order._id);
                    setDeliveryHistory(deliveries || []);
                } catch (err) {
                    console.error('Error fetching delivery history:', err);
                }
            }
        };
        fetchHistory();
    }, [isExpanded, order._id, order.status]);

    useEffect(() => {
        if (highlightedProductId && itemRefs.current[highlightedProductId]) {
            itemRefs.current[highlightedProductId].scrollIntoView({ behavior: 'smooth', block: 'center' });
            const timer = setTimeout(() => setHighlightedProductId(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [highlightedProductId, showEditModal]);

    // User Edit Modal State - REMOVED DUPLICATE
    // (State is now defined lower down with locations)

    // Calculate totals
    const totalAmount = order.items?.reduce((sum, item) => {
        const qty = (isBalanceTab && (order.status === 'Dispatch' || order.status === 'Partially Delivered')) 
            ? (item.quantityDelivered || 0) 
            : item.quantityOrdered;
        return sum + (qty * item.price);
    }, 0) || 0;

    let adjustmentsTotal = 0;
    if (order.adjustments && order.adjustments.length > 0) {
        order.adjustments.forEach(adj => {
            if (adj.type === 'charge') {
                adjustmentsTotal += adj.amount;
            } else if (adj.type === 'discount' || adj.type === 'advance' || adj.type === 'payment') {
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

    // Format currency - REMOVED (Using utility)

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

    // --- Edit Order Handlers ---
    const handleEditOrder = async () => {
        try {
            // Load available products for adding new items
            const res = await api.getProducts();
            setAvailableProducts(res.products || []);

            // Initialize edit items from order
            const items = order.items.map(item => ({
                productId: item.product, // Stored as 'product' ID ref in order item
                name: item.name,
                description: item.description,
                unit: item.unit,
                price: item.price,
                quantity: item.quantityOrdered,
                originalPrice: item.price // Track for price change detection
            }));
            setEditItems(items);
            setShowEditModal(true);
        } catch (err) {
            console.error('Error initializing edit:', err);
            alert('Failed to load products for editing');
        }
    };

    const handleEditItemChange = (index, field, value) => {
        const newItems = [...editItems];
        if (value === '') {
            newItems[index][field] = '';
        } else {
            newItems[index][field] = parseFloat(value) || 0;
        }
        setEditItems(newItems);
    };

    const handleRemoveEditItem = (index) => {
        const newItems = [...editItems];
        newItems.splice(index, 1);
        setEditItems(newItems);
    };

    const handleAddProductToEdit = (product) => {
        const exists = editItems.find(item => item.productId === product._id);
        if (exists) {
            alert('Product already in order');
            return;
        }
        setEditItems([
            ...editItems,
            {
                productId: product._id,
                name: product.name,
                description: product.description,
                unit: product.unit,
                price: product.price,
                quantity: 1,
                originalPrice: product.price // Track original price from catalog
            }
        ]);
        setProductSearch(null); // Reset search and collapse section
        setHighlightedProductId(product._id);
    };

    const calculateEditTotal = () => {
        return editItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const handleSubmitOrderEdit = async () => {
        if (editItems.length === 0) {
            alert('Order must have at least one item');
            return;
        }

        if (!window.confirm('Save changes to this order?')) return;

        try {
            // Check for price changes
            const hasPriceChange = editItems.some(item => {
                // If it's a new item (no originalPrice technically from order, but from catalog), checks against itself
                // Basically we want to know if the USER changed the price from what it WAS
                // For existing items: compare new price with originalPrice
                // For new items: compare new price with catalog price? Actually the logic in backend/staff usually is:
                // if price sent != current price in DB?
                // Simpler: Just send current price.
                // The API determines if it needs Rate Approved status if we use specific endpoint?
                // Requirement: "When prices are changed, the order will be sent to "Rate Requested" status."
                return item.price !== item.originalPrice;
            });

            const updatedItems = editItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price
            }));

            let result;
            if (hasPriceChange && !isAdmin) {
                // If price changed AND user is NOT admin (i.e. Staff), request rate change
                result = await api.requestRateChange(order._id, updatedItems);
            } else {
                // If no price change OR user IS Admin, just edit the order directly without status change
                result = await api.editOrder(order._id, updatedItems);
            }

            setShowEditModal(false);

            // Instantly update local order state
            if (result.order && onOrderUpdate) {
                onOrderUpdate(result.order);
            } else if (onRefresh) {
                await onRefresh();
            }
            alert('Order updated successfully!');

        } catch (err) {
            console.error('Error editing order:', err);
            alert(`Failed to update order: ${err.message} `);
        }
    };

    const handleCancelEdit = () => {
        // Init items for comparison
        const initialItems = order.items.map(item => ({
            productId: item.product,
            quantity: item.quantityOrdered,
            price: item.price
        }));

        // Check for changes
        const hasChanges = editItems.length !== initialItems.length || editItems.some((item) => {
            const original = initialItems.find(i => i.productId === item.productId);
            if (!original) return true; // New item added
            return item.quantity !== original.quantity || item.price !== original.price;
        });

        if (hasChanges) {
            if (!window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                return;
            }
        }
        setShowEditModal(false);
    };

    // Handle actions
    const handleConfirm = () => {
        if (window.confirm('Confirm this order?')) {
            onStatusChange(order._id, 'Confirmed');
        }
    };

    const handleDelete = async () => {
        if (!isAdmin) return;
        setShowDeleteAuthModal(true);
    };

    const confirmDeleteOrder = async () => {
        try {
            await api.deleteOrder(order._id);
            setShowDeleteAuthModal(false);
            if (onRefresh) await onRefresh();
        } catch (err) {
            alert(`Failed to delete order: ${err.message}`);
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
    const handleMoveToDispatch = () => {
        if (window.confirm('Move order to dispatch queue?')) {
            onStatusChange(order._id, 'Dispatch');
        }
    };

    const handleDispatch = () => {
        // Open agent assignment modal
        setAgentForm({
            name: '',
            mobile: '',
            description: '',
            address: '',
            rent: ''
        });
        setShowAgentModal(true);
    };

    const handleAssignAgent = async () => {
        if (!agentForm.name.trim()) {
            alert('Please enter agent name');
            return;
        }

        if (agentForm.mobile && !/^\d{10}$/.test(agentForm.mobile)) {
            alert('Agent mobile number must be exactly 10 digits.');
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
            alert(`Error: ${err.message} `);
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

    const handleDeleteAgentSection = async (dispatchId) => {
        if (!window.confirm(`Are you sure you want to delete this Entire Dispatch Section (${dispatchId})? This will rollback the quantities and delete all delivery history for this batch.`)) return;
        try {
            await api.deleteDispatchBatch(order._id, dispatchId);
            alert('Dispatch batch deleted and quantities rolled back.');
            onRefresh();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleEditAgentSection = (sectionBatch) => {
        const currentDispatchId = sectionBatch.batches[0]?.dispatchId || sectionBatch.info?.dispatchId;
        setEditAgentModalData({
            dispatchId: currentDispatchId,
            form: {
                newDispatchId: currentDispatchId || '',
                name: sectionBatch.info?.name || '',
                mobile: sectionBatch.info?.mobile || '',
                description: sectionBatch.info?.description || '',
                address: sectionBatch.info?.address || '',
                rent: sectionBatch.agentCharge || ''
            }
        });
        setShowEditAgentModal(true);
    };

    const handleAgainDelivery = (sectionBatch) => {
        setAgentForm({
            name: sectionBatch.info?.name || '',
            mobile: sectionBatch.info?.mobile || '',
            description: sectionBatch.info?.description || '',
            address: sectionBatch.info?.address || ''
        });
        setShowItemsPopup(false);
        setShowAgentModal(true);
    };

    const submitEditAgent = async () => {
        try {
            await api.updateDispatchAgent(order._id, editAgentModalData.dispatchId, editAgentModalData.form);
            alert('Agent details updated.');
            setShowEditAgentModal(false);
            onRefresh();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleStartDelivery = async () => {
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

        if (!window.confirm(`Start delivery for ${deliveries.length} item(s) ? `)) {
            return;
        }

        try {
            await api.recordDelivery(order._id, deliveries, deliveryRent);
            setDeliveryRent('');
            setShowDeliveryModal(false);
            if (onRefresh) await onRefresh();
        } catch (err) {
            alert(`Error: ${err.message} `);
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
            setConfirmingBatch(null);
            setShowHistoryModal(true);
        } catch (err) {
            alert(`Error: ${err.message} `);
        }
    };

    const handleConfirmBatchClick = (batch) => {
        setConfirmingBatch(batch);
        setConfirmAmount('');
    };

    const submitBatchConfirmation = async (batch, isNull) => {
        try {
            const amount = isNull ? 0 : parseFloat(confirmAmount) || 0;
            const mode = isNull ? null : confirmPaymentMode;
            
            await api.confirmDeliveryBatch(
                order._id,
                batch.date,
                amount,
                isNull,
                mode
            );
            
            setConfirmingBatch(null);
            setConfirmPaymentMode('Cash');
            
            // Refresh history and order
            const deliveries = await api.getDeliveryHistory(order._id);
            setDeliveryHistory(deliveries || []);
            
            if (onRefresh) await onRefresh();
            alert('Batch confirmed successfully!');
        } catch (err) {
            console.error('Error confirming batch:', err);
            alert('Failed to confirm batch: ' + err.message);
        }
    };

    const groupDeliveriesByBatch = (deliveries) => {
        const batches = [];
        deliveries.forEach(record => {
            // Group by the exact timestamp of delivery (the "load")
            const batchKey = `${new Date(record.deliveredAt || record.deliveryDate || record.createdAt).getTime()}_${record.isConfirmed}`;
            
            let batch = batches.find(b => b.key === batchKey);
            if (!batch) {
                batch = {
                    key: batchKey,
                    date: record.deliveredAt || record.deliveryDate || record.createdAt,
                    isConfirmed: record.isConfirmed,
                    receivedAmount: 0, // Initialize to 0 for summation
                    dispatchId: record.dispatchId || (order.deliveryAgent?.dispatchId) || 'N/A',
                    agentCharge: record.agentCharge || 0,
                    paymentMode: record.paymentMode || 'N/A',
                    items: []
                };
                batches.push(batch);
            }
            batch.items.push(record);
            // Sum up the received amount for the batch
            batch.receivedAmount += (record.receivedAmount || 0);
        });
        return batches;
    };

    const groupHistoryByAgent = (history) => {
        const agentsMap = {};
        
        // Group records by agent first
        history.forEach(record => {
            const agentId = record.deliveryAgent?.id || record.deliveryAgent?.name || 'Unknown';
            if (!agentsMap[agentId]) {
                agentsMap[agentId] = {
                    info: record.deliveryAgent,
                    records: []
                };
            }
            agentsMap[agentId].records.push(record);
        });

        // Convert to array and group each agent's records by batch
        return Object.values(agentsMap).map(agentData => {
            const batches = groupDeliveriesByBatch(agentData.records);
            // Track earliest date for sorting agents by their first dispatch
            const earliestDate = Math.min(...batches.map(b => new Date(b.date).getTime()));
            return {
                info: agentData.info,
                batches,
                earliestDate
            };
        });
    };

    // Adjustment handlers
    const handleAddAdjustment = (type) => {
        setAdjustmentType(type);

        // Set default description based on type
        let defaultDesc = '';
        if (type === 'charge') defaultDesc = 'Charges';
        else if (type === 'discount') defaultDesc = 'Discount';
        else if (type === 'advance') defaultDesc = 'Advance';
        else if (type === 'payment') defaultDesc = 'Payment';

        setAdjustmentDescription(defaultDesc);
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
            alert(`Error: ${err.message} `);
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
            alert(`Error: ${err.message} `);
        }
    };

    // User Edit Modal State
    const [showUserEditModal, setShowUserEditModal] = useState(false);
    const [locations, setLocations] = useState({}); // Stores district/taluk data
    const [userEditForm, setUserEditForm] = useState({
        name: '',
        mobile: '',
        email: '',
        district: '',
        taluk: '',
        address: '',
        pincode: '',
        altMobile: ''
    });

    // ... (existing code) ...

    // User Edit Handlers
    const handleEditUser = async () => {
        if (!order.user?._id) return;
        try {
            // Load user and locations in parallel
            const [user, locs] = await Promise.all([
                api.getUser(order.user._id),
                api.getLocations()
            ]);

            setLocations(locs || {});

            setUserEditForm({
                name: user.name || '',
                mobile: user.mobile || '',
                email: user.email || '',
                district: user.district || '',
                taluk: user.taluk || '',
                address: user.address || '',
                pincode: user.pincode || '',
                altMobile: user.altMobile || ''
            });
            setShowUserEditModal(true);
        } catch (err) {
            console.error('Error fetching details:', err);
            alert('Failed to load user details');
        }
    };

    const handleUserInputChange = (field, value) => {
        setUserEditForm(prev => {
            const newState = { ...prev, [field]: value };
            // Reset taluk when district changes
            if (field === 'district') {
                newState.taluk = '';
            }
            return newState;
        });
    };

    const handleSubmitUserEdit = async () => {
        // Validation (matching Profile.jsx)
        if (userEditForm.altMobile && !/^\d{10}$/.test(userEditForm.altMobile)) {
            alert('Alternative mobile number must be exactly 10 digits.');
            return;
        }
        if (userEditForm.name && userEditForm.name.length > 29) {
            alert('Name must be 29 characters or less.');
            return;
        }
        if (userEditForm.email && !/\S+@\S+\.\S+/.test(userEditForm.email)) {
            alert('Please enter a valid email address.');
            return;
        }
        if (userEditForm.address && userEditForm.address.length > 150) {
            alert('Address must be 150 characters or less.');
            return;
        }
        if (userEditForm.pincode && !/^\d{6}$/.test(userEditForm.pincode)) {
            alert('Pincode must be exactly 6 digits.');
            return;
        }

        try {
            await api.updateUser(order.user._id, userEditForm);
            setShowUserEditModal(false);
            alert('User profile updated successfully');
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Error updating user:', err);
            alert('Failed to update user profile: ' + err.message);
        }
    };

    // Render action buttons based on status
    const renderActionButtons = () => {
        switch (order.status) {
            case 'Ordered':
                return (
                    <>
                        {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                        <button onClick={handleConfirm} className={styles.btnConfirm}>Confirm</button>
                        <button onClick={handlePause} className={styles.btnPause}>Pause</button>
                        <button onClick={handleCancel} className={styles.btnCancel}>Cancel</button>
                        {isAdmin && !isBalanceTab && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                    </>
                );
            case 'Rate Requested':
                return (
                    <>
                        {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                        {isAdmin && <button onClick={handleApproveRate} className={styles.btnApprove}>Approve Rate</button>}
                        <button onClick={handleCancelRateRequest} className={styles.btnCancel}>Cancel Request</button>
                        {isAdmin && !isBalanceTab && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                    </>
                );
            case 'Rate Approved':
                return (
                    <>
                        {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                        <button onClick={handleConfirm} className={styles.btnConfirm}>Confirm</button>
                        <button onClick={handleHold} className={styles.btnHold}>Hold</button>
                        <button onClick={handleCancelRateRequest} className={styles.btnCancel}>Cancel Request</button>
                        {isAdmin && !isBalanceTab && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                    </>
                );
            case 'Confirmed':
                return (
                    <>
                        {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                        <button onClick={handleMoveToDispatch} className={styles.btnDispatch}>Dispatch</button>
                        <button onClick={handleHold} className={styles.btnHold}>Hold</button>
                        <button onClick={handleCancel} className={styles.btnCancel}>Cancel</button>
                        {isAdmin && !isBalanceTab && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                    </>
                );
            case 'Dispatch':
            case 'Partially Delivered':
                if (allItemsDelivered) {
                    return (
                        <>
                            {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                            <button onClick={handleMarkDelivered} className={styles.btnDeliver}>
                                Mark as Delivered
                            </button>
                            {isAdmin && !isBalanceTab && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                        </>
                    );
                } else {
                    return (
                        <>
                            {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                            {isAdmin && !isBalanceTab && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                        </>
                    );
                }
            case 'Paused':
            case 'Hold':
                return (
                    <>
                        {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                        <button onClick={handleEditReason} className={styles.btnEditSmall}>Edit Reason</button>
                        <button onClick={handleConfirm} className={styles.btnConfirm}>Resume & Confirm</button>
                        <button onClick={handleCancel} className={styles.btnCancel}>Cancel</button>
                        {isAdmin && !isBalanceTab && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                    </>
                );
            case 'Delivered':
            case 'Cancelled':
                return (
                    <>
                        {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                        {isAdmin && !isBalanceTab && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete Order</button>}
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <div className={styles.orderCard} ref={cardRef}>
                <div className={styles.orderCardHeader} onClick={onToggleExpand}>
                    <div>
                        <strong>ID: {order.customOrderId || 'N/A'}</strong> - {order.user?.name || 'N/A'} ({order.user?.mobile || 'N/A'})
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: (isDispatchTab && allItemsDelivered) ? '#3E7400' : getStatusColor(), fontWeight: 'bold' }}>
                            {isDispatchTab && allItemsDelivered ? 'Dispatch Completed' : order.status}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className={styles.orderCardBody}>
                        <div className={styles.orderInfo}>
                            <div style={{ width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); handleEditUser(); }}
                                        style={{ cursor: 'pointer', color: '#007bff' }}
                                        title="Click to edit profile"
                                    >
                                        <strong style={{ color: '#000' }}>Customer:</strong> <span style={{ textDecoration: 'underline' }}>{order.user?.name} ({order.user?.mobile})</span>
                                    </div>
                                    {(order.status === 'Dispatch' || order.status === 'Partially Delivered') && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDispatch(); }}
                                            className={styles.btnEditSmall}
                                            style={{ margin: 0, padding: '4px 8px', fontSize: '12px' }}
                                        >
                                            Assign Dispatch
                                        </button>
                                    )}
                                </div>
                                <div style={{ marginTop: '5px' }}>
                                    <strong>Ordered at:</strong> {formatDate(order.createdAt)}
                                </div>
                            </div>
                        </div>

                        <hr />

                        <ul className={styles.itemList}>
                            {order.items?.filter(item => {
                                if (isBalanceTab && (order.status === 'Dispatch' || order.status === 'Partially Delivered')) {
                                    return item.quantityDelivered > 0;
                                }
                                return true;
                            }).map((item, index) => {
                                const displayQty = (isBalanceTab && (order.status === 'Dispatch' || order.status === 'Partially Delivered')) 
                                    ? item.quantityDelivered 
                                    : item.quantityOrdered;
                                    
                                return (
                                    <li key={index} className={styles.orderItemRow}>
                                        <div className={styles.itemName}>
                                            {item.name}
                                            {item.description && (
                                                <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px', fontWeight: 'normal' }}>
                                                    ({item.description})
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.itemQty}>
                                            {displayQty} {item.unit || ''} × {formatPrice(item.price)}
                                        </div>
                                        <div className={styles.itemPrice}>
                                            {formatPrice(displayQty * item.price)}
                                        </div>
                                    </li>
                                );
                            })}

                            <li className={styles.orderTotal}>
                                <div></div>
                                <div><strong>{isBalanceTab ? 'Total Order Value (Rs):' : 'Total Amount (Rs):'}</strong></div>
                                <div><strong>{formatPrice(totalAmount)}</strong></div>
                            </li>

                            {order.adjustments && order.adjustments.length > 0 && (
                                <>
                                    {order.adjustments.map((adj, index) => {
                                        const isAgentCollection = adj.description?.startsWith('Collection via Delivery Agent:') || adj.description?.startsWith('Collection via Dispatch Agent:');
                                        return (
                                            <li key={index} className={styles.orderTotal} style={{ 
                                                marginTop: 0, 
                                                borderTop: 'none', 
                                                fontWeight: 'bold', 
                                                fontSize: '13px',
                                                backgroundColor: isAgentCollection ? '#f0f9f8' : 'transparent',
                                                borderRadius: isAgentCollection ? '4px' : '0'
                                            }}>
                                                <div></div>
                                                <div style={{ textAlign: 'left', paddingLeft: '100px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {isAgentCollection && <span title="Collection via Dispatch Agent">📦</span>}
                                                    {(() => {
                                                        if (!isAgentCollection) return adj.description;
                                                        const agentCollections = order.adjustments.filter(a => 
                                                            a.description?.startsWith('Collection via Delivery Agent:') || 
                                                            a.description?.startsWith('Collection via Dispatch Agent:')
                                                        );
                                                        const showNumeric = agentCollections.length > 1 || !allItemsDelivered;
                                                        if (!showNumeric) return 'Dispatch';
                                                        const index = agentCollections.findIndex(a => a._id === adj._id);
                                                        return `Dispatch ${index + 1}`;
                                                    })()}
                                                    {adj.isLocked && <span style={{ color: '#6c757d', fontSize: '0.85em' }}> (Locked)</span>}:
                                                </div>
                                                <div style={{
                                                    color: adj.type === 'charge' ? '#dc3545' : '#28a745',
                                                    display: 'flex',
                                                    justifyContent: 'flex-end',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    position: 'relative',
                                                    paddingRight: '130px'
                                                }}>
                                                    {adj.type === 'charge' ? '+' : '-'}{formatPrice(adj.amount)}
                                                    {!adj.isLocked && (
                                                        <button
                                                            onClick={() => handleRemoveAdjustment(adj._id)}
                                                            className={styles.removeAdjustmentBtn}
                                                            title="Remove"
                                                            style={{ position: 'absolute', right: 0, color: '#fff' }}
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </>
                            )}

                            {(() => {
                                const agentCollectionsTotal = order.adjustments?.filter(adj => 
                                    adj.description?.startsWith('Collection via Delivery Agent:') || 
                                    adj.description?.startsWith('Collection via Dispatch Agent:')
                                ).reduce((sum, adj) => sum + adj.amount, 0) || 0;

                                const agentHistory = groupHistoryByAgent(deliveryHistory);
                                let dispatchCards = [];
                                agentHistory.forEach((agentSection, idx) => {
                                    let totalExpected = 0;
                                    let totalReceived = 0;
                                    agentSection.batches.forEach(batch => {
                                        totalExpected += (batch.expectedAmount || 0);
                                        totalReceived += (batch.receivedAmount || 0);
                                    });
                                    if (totalExpected > 0 || totalReceived > 0) {
                                        dispatchCards.push({
                                            label: `Dispatch ${idx + 1}`,
                                            expected: totalExpected,
                                            received: totalReceived
                                        });
                                    }
                                });

                                return (
                                    <>
                                        {dispatchCards.length > 0 && dispatchCards.map((card, idx) => (
                                            <li key={`disp-${idx}`} className={styles.orderTotal} style={{ marginTop: idx === 0 ? '5px' : '0', borderTop: idx === 0 ? '1px dashed #17a2b8' : 'none', padding: '2px 0', fontSize: '13px' }}>
                                                <div></div>
                                                <div style={{ textAlign: 'right', paddingRight: '10px', color: '#17a2b8' }}>
                                                    {card.label} Collection:
                                                </div>
                                                <div style={{ paddingRight: '130px', display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
                                                    <span style={{ color: '#17a2b8' }} title="Expected">Exp: {formatPrice(card.expected)}</span>
                                                    <span style={{ color: '#28a745', fontWeight: 'bold' }}>Rec: {formatPrice(card.received)}</span>
                                                </div>
                                            </li>
                                        ))}

                                        {agentCollectionsTotal > 0 && (
                                            <li className={styles.orderTotal} style={{ marginTop: dispatchCards.length > 0 ? '0' : '5px', borderTop: 'none', borderBottom: '1px dashed #28a745', padding: '5px 0' }}>
                                                <div></div>
                                                <div style={{ textAlign: 'right', paddingRight: '10px', color: '#11998e' }}>
                                                    Total Received via Dispatch:
                                                </div>
                                                <div style={{ color: '#28a745', fontWeight: 'bold', paddingRight: '130px' }}>
                                                    {formatPrice(agentCollectionsTotal)}
                                                </div>
                                            </li>
                                        )}
                                    </>
                                );
                            })()}

                            <li className={styles.orderTotal}>
                                <div></div>
                                <div><strong>{isBalanceTab ? 'Remaining Amount to Collect (Rs):' : 'Balance Amount (Rs):'}</strong></div>
                                <div><strong style={{ color: isBalanceTab ? '#dc3545' : '#007bff' }}>{formatPrice(finalTotal)}</strong></div>
                            </li>
                        </ul>

                        {/* Adjustment Buttons */}
                        {((!['Delivered', 'Cancelled'].includes(order.status)) || (isBalanceTab && order.status === 'Delivered')) && (
                            <div className={styles.adjustmentButtons}>
                                <button onClick={() => handleAddAdjustment('charge')} className={styles.btnAddCharge}>
                                    + Charge
                                </button>
                                <button onClick={() => handleAddAdjustment('discount')} className={styles.btnAddDiscount}>
                                    + Discount
                                </button>
                                <button onClick={() => handleAddAdjustment(isBalanceTab ? 'payment' : 'advance')} className={styles.btnAddAdvance}>
                                    {isBalanceTab ? 'Collect Payment' : '+ Advance'}
                                </button>
                            </div>
                        )}

                        {(order.status === 'Paused' || order.status === 'Hold') && order.pauseReason && (
                            <div className={styles.reasonBox}>
                                <strong>Reason:</strong> {order.pauseReason}
                            </div>
                        )}

                        {/* Delivery Agent Sections */}
                        {(order.status === 'Dispatch' || order.status === 'Partially Delivered' || order.status === 'Delivered') && (
                            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {(() => {
                                    const agentHistory = groupHistoryByAgent(deliveryHistory);
                                    const currentAgentId = order.deliveryAgent?.id || order.deliveryAgent?.name;
                                    
                                    // Separate current agent from history to ensure they're always at the bottom
                                    const previousAgents = agentHistory.filter(ah => 
                                        !((ah.info?.id && ah.info.id === currentAgentId) || 
                                          ah.info?.name === currentAgentId)
                                    ).sort((a, b) => a.earliestDate - b.earliestDate);

                                    const currentAgentInHistory = agentHistory.find(ah => 
                                        (ah.info?.id && ah.info.id === currentAgentId) || 
                                        ah.info?.name === currentAgentId
                                    );

                                    const allSections = [...previousAgents];
                                    if (currentAgentInHistory) {
                                        allSections.push(currentAgentInHistory);
                                    } else if (order.deliveryAgent && order.deliveryAgent.name) {
                                        // Still add current agent section if they haven't made any deliveries
                                        allSections.push({
                                            info: order.deliveryAgent,
                                            batches: [],
                                            isActive: true
                                        });
                                    }

                                    if (allSections.length === 0) return null;

                                    return allSections.map((agentSection, idx) => (
                                        <div key={idx} style={{
                                            padding: '15px',
                                            backgroundColor: '#f8f9fa',
                                            borderRadius: '12px',
                                            border: '1px solid #e9ecef',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                            marginBottom: '15px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                                <h4 style={{ margin: 0, color: '#0056b3', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    📤 Dispatch {idx + 1}
                                                    {agentSection.info?.name === order.deliveryAgent?.name && (
                                                        <>
                                                            <span style={{ fontSize: '10px', backgroundColor: '#e7f3ff', color: '#0d6efd', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>Current</span>
                                                            {!allItemsDelivered && agentSection.batches.length === 0 && (
                                                                <button onClick={handleOpenDeliveryModal} className={styles.btnDeliver} style={{ margin: 0, padding: '4px 12px', fontSize: '13px' }}>
                                                                    Start Delivery
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </h4>
                                            </div>

                                            {agentSection.batches.length > 0 ? (
                                                <div style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                        <thead>
                                                            <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '1px solid #dee2e6' }}>
                                                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Dispatch ID</th>
                                                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Date &amp; Time</th>
                                                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600' }}>Payment</th>
                                                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600' }}>Mode</th>
                                                                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {agentSection.batches.map((batch) => (
                                                                <React.Fragment key={batch.key}>
                                                                    <tr style={{ borderBottom: '1px solid #f1f3f5' }}>
                                                                        <td style={{ padding: '8px 10px' }}>
                                                                            <span 
                                                                                onClick={() => {
                                                                                    setSelectedBatchForItems({ ...batch, agentSection: agentSection });
                                                                                    setShowItemsPopup(true);
                                                                                }}
                                                                                style={{ 
                                                                                    color: '#0d6efd', 
                                                                                    cursor: 'pointer', 
                                                                                    textDecoration: 'underline',
                                                                                    fontWeight: '600'
                                                                                }}
                                                                                title="Click to view items"
                                                                            >
                                                                                {batch.dispatchId}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                                                            <div style={{ fontWeight: '500' }}>
                                                                                {new Date(batch.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                                            </div>
                                                                            <div style={{ fontSize: '10px', color: '#868e96' }}>
                                                                                {new Date(batch.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                                            {batch.isConfirmed ? (
                                                                                <span style={{ color: '#2b8a3e', fontWeight: '600' }}>
                                                                                    {batch.receivedAmount > 0 ? `₹${batch.receivedAmount}` : 'No'}
                                                                                </span>
                                                                            ) : (
                                                                                <span style={{ color: '#e67700', fontWeight: '600' }}>Pending</span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                                            {batch.isConfirmed ? (
                                                                                <span style={{ fontSize: '10px', color: '#495057' }}>
                                                                                    {batch.receivedAmount > 0 ? (batch.items[0]?.paymentMode || 'Cash') : '-'}
                                                                                </span>
                                                                            ) : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                                                            {!batch.isConfirmed && (
                                                                                confirmingBatch?.key === batch.key ? (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                                                            <input
                                                                                                type="number"
                                                                                                placeholder="Amt"
                                                                                                value={confirmAmount}
                                                                                                onChange={(e) => setConfirmAmount(e.target.value)}
                                                                                                style={{ width: '50px', padding: '3px', fontSize: '11px', border: '1px solid #ced4da', borderRadius: '4px' }}
                                                                                            />
                                                                                            <select
                                                                                                value={confirmPaymentMode}
                                                                                                onChange={(e) => setConfirmPaymentMode(e.target.value)}
                                                                                                style={{ padding: '3px', fontSize: '10px', border: '1px solid #ced4da', borderRadius: '4px' }}
                                                                                            >
                                                                                                <option value="Cash">Cash</option>
                                                                                                <option value="GPay">GPay</option>
                                                                                                <option value="PhonePe">PhonePe</option>
                                                                                                <option value="Bank Transfer">Bank</option>
                                                                                                <option value="Other">Other</option>
                                                                                            </select>
                                                                                        </div>
                                                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                                                            <button onClick={() => submitBatchConfirmation(batch, false)} style={{ background: '#2b8a3e', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}>OK</button>
                                                                                            <button onClick={() => setConfirmingBatch(null)} style={{ background: '#868e96', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}>✕</button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                                                        <button
                                                                                            onClick={() => handleConfirmBatchClick(batch)}
                                                                                            style={{ background: '#2b8a3e', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer' }}
                                                                                        >Rec. Amt</button>
                                                                                        <button
                                                                                            onClick={() => submitBatchConfirmation(batch, true)}
                                                                                            style={{ background: '#e03131', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer' }}
                                                                                        >Null</button>
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                            {batch.isConfirmed && (
                                                                                <span style={{ fontSize: '10px', color: '#2b8a3e', fontWeight: 'bold' }}>✓ Done</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                </React.Fragment>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '10px', color: '#868e96', fontSize: '12px', border: '1px dashed #dee2e6', borderRadius: '8px' }}>
                                                    No dispatches recorded for this agent yet.
                                                </div>
                                            )}
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}

                        <div className={styles.orderActions}>
                            {renderActionButtons()}
                            <button onClick={async () => {
                                try {
                                    setIsPayLoading(true);
                                    const settings = await api.getPaymentSettings();
                                    setPaymentSettings(settings || []);
                                    setPaymentModalType('plain');
                                    setShowPaymentModal(true);
                                } catch (err) {
                                    console.error("Error fetching payment settings:", err);
                                    alert("Failed to load payment settings. Generating PDF without QR.");
                                    import('../../utils/generateBill')
                                        .then(({ generateBill }) => {
                                            return generateBill(order, null);
                                        });
                                } finally {
                                    setIsPayLoading(false);
                                }
                            }} className={styles.btnConfirm} style={{ backgroundColor: '#28a745', marginTop: '10px', width: '100%' }} disabled={isPayLoading}>
                                {isPayLoading ? 'Loading Settings...' : 'Print PDF'}
                            </button>
                            <button onClick={async () => {
                                try {
                                    setIsPayLoading(true);
                                    const settings = await api.getPaymentSettings();
                                    setPaymentSettings(settings || []);
                                    setPaymentModalType('withHeader');
                                    setShowPaymentModal(true);
                                } catch (err) {
                                    console.error("Error fetching payment settings:", err);
                                    alert("Failed to load payment settings. Generating PDF with header but without QR.");
                                    import('../../utils/generateBill')
                                        .then(({ generateBillWithHeader }) => {
                                            return generateBillWithHeader(order, null);
                                        });
                                } finally {
                                    setIsPayLoading(false);
                                }
                            }} className={styles.btnConfirm} style={{ backgroundColor: '#0d6efd', marginTop: '6px', width: '100%' }} disabled={isPayLoading}>
                                {isPayLoading ? 'Loading Settings...' : 'Print PDF (with Header)'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Payment Selection Modal */}
            {showPaymentModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
                        <h3>Select Payment Details for PDF</h3>
                        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                            You can select one Primary (UPI) and one Bank detail:
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', maxHeight: '400px', overflowY: 'auto', padding: '10px' }}>
                            <div
                                onClick={() => {
                                    setSelectedPayments({ primary: null, bank: null });
                                }}
                                style={{
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    padding: '10px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    backgroundColor: (!selectedPayments.primary && !selectedPayments.bank) ? '#e7f1ff' : 'transparent',
                                    borderColor: (!selectedPayments.primary && !selectedPayments.bank) ? '#0d6efd' : '#ddd'
                                }}
                            >
                                <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🚫</div>
                                <div style={{ fontWeight: 'bold', marginTop: '5px' }}>None</div>
                            </div>
                            {paymentSettings.map(setting => {
                                const isSelected = (setting.type === 'primary' && selectedPayments.primary?._id === setting._id) || 
                                                 (setting.type === 'bank' && selectedPayments.bank?._id === setting._id);
                                return (
                                    <div
                                        key={setting._id}
                                        onClick={() => {
                                            if (setting.type === 'primary') {
                                                setSelectedPayments(prev => ({ ...prev, primary: prev.primary?._id === setting._id ? null : setting }));
                                            } else {
                                                setSelectedPayments(prev => ({ ...prev, bank: prev.bank?._id === setting._id ? null : setting }));
                                            }
                                        }}
                                        style={{
                                            border: '1px solid #ddd',
                                            borderRadius: '8px',
                                            padding: '10px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            backgroundColor: isSelected ? '#e7f1ff' : 'transparent',
                                            borderColor: isSelected ? '#0d6efd' : '#ddd',
                                            position: 'relative'
                                        }}
                                    >
                                        {isSelected && <div style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '12px', color: '#0d6efd' }}>✅</div>}
                                        {setting.qrCode ? (
                                            <img src={setting.qrCode} alt={setting.name} style={{ width: '100%', height: '60px', objectFit: 'contain' }} />
                                        ) : (
                                            <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>🏦</div>
                                        )}
                                        <div style={{ fontWeight: 'bold', marginTop: '5px', fontSize: '13px' }}>{setting.name}</div>
                                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '5px' }}>{setting.type === 'primary' ? 'Primary' : 'Bank'}</div>
                                        {setting.type === 'bank' && (
                                            <div style={{ fontSize: '9px', color: '#666', textAlign: 'left', borderTop: '1px solid #eee', paddingTop: '5px' }}>
                                                {setting.accountName && <div>A/C Name: {setting.accountName}</div>}
                                                {setting.accountNumber && <div>A/C: {setting.accountNumber}</div>}
                                                {setting.ifsc && <div>IFSC: {setting.ifsc}</div>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className={styles.modalActions} style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowPaymentModal(false)} className={styles.btnCancel}>Cancel</button>
                            <button 
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    import('../../utils/generateBill')
                                        .then((module) => {
                                            const settings = [];
                                            if (selectedPayments.primary) settings.push(selectedPayments.primary);
                                            if (selectedPayments.bank) settings.push(selectedPayments.bank);
                                            
                                            if (paymentModalType === 'withHeader') {
                                                return module.generateBillWithHeader(order, settings);
                                            } else {
                                                return module.generateBill(order, settings);
                                            }
                                        });
                                }} 
                                className={styles.btnConfirm}
                                style={{ backgroundColor: '#0d6efd', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        <h3>{isBalanceTab && adjustmentType === 'advance' ? 'Record Payment Collection' : `Add ${adjustmentType.charAt(0).toUpperCase() + adjustmentType.slice(1)}`}</h3>
                        <div className={styles.formGroup}>
                            <label>{isBalanceTab && adjustmentType === 'advance' ? 'Payment Method / Reference' : 'Description'}</label>
                            <input
                                type="text"
                                value={adjustmentDescription}
                                onChange={(e) => setAdjustmentDescription(e.target.value)}
                                placeholder={isBalanceTab && adjustmentType === 'advance' ? 'e.g. Cash, GPay, Bank Transfer...' : 'Enter description...'}
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>{isBalanceTab && adjustmentType === 'advance' ? 'Amount Collected' : 'Amount'}</label>
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
                            <button onClick={handleSubmitAdjustment} className={styles.btnConfirm}>{isBalanceTab && adjustmentType === 'advance' ? 'Record Collection' : 'Add'}</button>
                            <button onClick={() => setShowAdjustmentModal(false)} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Agent Assignment Modal */}
            {showAgentModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent} style={{ position: 'relative' }}>
                        <button 
                            onClick={() => setShowAgentModal(false)} 
                            className={styles.btnCloseModal}
                            style={{ 
                                position: 'absolute', 
                                top: '10px', 
                                right: '10px', 
                                background: 'transparent', 
                                border: 'none', 
                                fontSize: '20px', 
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            ✕
                        </button>
                        <h3>Assign Dispatch</h3>
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
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    if (value.length <= 10) {
                                        setAgentForm({ ...agentForm, mobile: value });
                                    }
                                }}
                                placeholder="Enter 10-digit mobile number"
                                maxLength="10"
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
                            <button onClick={handleAssignAgent} className={styles.btnConfirm}>Assign</button>
                            <button onClick={() => setShowAgentModal(false)} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Agent Modal */}
            {showEditAgentModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent} style={{ position: 'relative' }}>
                        <button 
                            onClick={() => setShowEditAgentModal(false)} 
                            className={styles.btnCloseModal}
                            style={{ 
                                position: 'absolute', 
                                top: '10px', 
                                right: '10px', 
                                background: 'transparent', 
                                border: 'none', 
                                fontSize: '20px', 
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            ✕
                        </button>
                        <h3>Edit Dispatch Agent</h3>

                        <div className={styles.formGroup}>
                            <label>Agent Name *</label>
                            <input
                                type="text"
                                value={editAgentModalData.form.name}
                                onChange={(e) => setEditAgentModalData({ 
                                    ...editAgentModalData, 
                                    form: { ...editAgentModalData.form, name: e.target.value } 
                                })}
                                placeholder="Enter agent name"
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Agent Mobile</label>
                            <input
                                type="text"
                                value={editAgentModalData.form.mobile}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    if (value.length <= 10) {
                                        setEditAgentModalData({ 
                                            ...editAgentModalData, 
                                            form: { ...editAgentModalData.form, mobile: value } 
                                        });
                                    }
                                }}
                                placeholder="Enter 10-digit mobile number"
                                maxLength="10"
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Description</label>
                            <input
                                type="text"
                                value={editAgentModalData.form.description}
                                onChange={(e) => setEditAgentModalData({ 
                                    ...editAgentModalData, 
                                    form: { ...editAgentModalData.form, description: e.target.value } 
                                })}
                                placeholder="Vehicle, ETA, etc."
                                className={styles.modalInput}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Delivery Address</label>
                            <textarea
                                value={editAgentModalData.form.address}
                                onChange={(e) => setEditAgentModalData({ 
                                    ...editAgentModalData, 
                                    form: { ...editAgentModalData.form, address: e.target.value } 
                                })}
                                placeholder="Enter delivery address"
                                rows="3"
                                className={styles.modalTextarea}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={submitEditAgent} className={styles.btnConfirm}>Update Details</button>
                            <button onClick={() => setShowEditAgentModal(false)} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Start Delivery Modal */}
            {showDeliveryModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent} style={{ maxWidth: '700px' }}>
                        <h3>Start Delivery</h3>
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
                        <div style={{ marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <label style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', color: '#495057' }}>Rent / Agent Charge (Rs)</label>
                            <input
                                type="number"
                                value={deliveryRent}
                                onChange={(e) => setDeliveryRent(e.target.value)}
                                placeholder="0 (optional)"
                                min="0"
                                step="1"
                                style={{ flex: 1, padding: '6px 10px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
                            />
                        </div>
                        <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                            <button onClick={handleStartDelivery} className={styles.btnConfirm}>Start Delivery</button>
                            <button onClick={() => { setShowDeliveryModal(false); setDeliveryRent(''); }} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Order Modal */}
            {showEditModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent} style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Edit Order Items</h3>
                            <button
                                onClick={handleCancelEdit}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#6c757d',
                                    padding: '0 5px',
                                    lineHeight: '1'
                                }}
                                title="Close"
                            >
                                ×
                            </button>
                        </div>

                        {/* Add Product Section */}
                        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                onClick={() => setProductSearch(productSearch === null ? '' : null)}
                            >
                                <h4 style={{ margin: 0, fontSize: '16px', color: '#495057' }}>
                                    {productSearch !== null ? '▼ Select Product to Add' : ''}
                                </h4>
                                {productSearch === null && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setProductSearch(''); }}
                                        className={styles.btnConfirm}
                                        style={{ padding: '5px 10px', fontSize: '13px' }}
                                    >
                                        + Add Product
                                    </button>
                                )}
                            </div>

                            {productSearch !== null && (
                                <div style={{ marginTop: '15px' }}>
                                    <div className="mobile-add-product" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                        <style>{`
                                            @media (max-width: 600px) {
                                                .mobile-add-product {
                                                    flex-direction: column;
                                                    gap: 5px;
                                                }
                                                .mobile-add-product button {
                                                    width: 100%;
                                                }
                                            }
                                        `}</style>
                                        <input
                                            type="text"
                                            placeholder="Search by name or SKU..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            className={styles.modalInput}
                                            style={{ flex: 1 }}
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => setProductSearch(null)}
                                            className={styles.btnCancel}
                                            style={{ padding: '8px 15px', whiteSpace: 'nowrap' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    <div style={{
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        border: '1px solid #ced4da',
                                        borderRadius: '4px',
                                        backgroundColor: 'white'
                                    }}>
                                        {availableProducts.filter(p => p.isVisible).length === 0 ? (
                                            <div style={{ padding: '10px', color: '#6c757d', textAlign: 'center' }}>No products available</div>
                                        ) : (
                                            availableProducts
                                                .filter(p => p.isVisible) // Only show visible products
                                                .filter(p =>
                                                    !productSearch ||
                                                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                                    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                                                )
                                                .map((product, idx) => {
                                                    const isAdded = editItems.some(i => i.productId === product._id);
                                                    return (
                                                        <div
                                                            key={product._id}
                                                            onClick={() => !isAdded && handleAddProductToEdit(product)}
                                                            style={{
                                                                padding: '10px',
                                                                borderBottom: '1px solid #eee',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                cursor: isAdded ? 'default' : 'pointer',
                                                                backgroundColor: isAdded ? '#f8f9fa' : (idx % 2 === 0 ? '#ffffff' : '#f1f3f4'),
                                                                opacity: isAdded ? 0.6 : 1
                                                            }}
                                                            className={!isAdded ? styles.searchResultItem : ''}
                                                        >
                                                            <div>
                                                                <div style={{ fontWeight: '600' }}>{product.name}</div>
                                                                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                                                    SKU: {product.sku || 'N/A'} | Unit: {product.unit}
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontWeight: 'bold', color: '#28a745' }}>{product.price}</div>
                                                                {isAdded && <div style={{ fontSize: '11px', color: '#dc3545' }}>Added</div>}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                        )}
                                        {availableProducts.filter(p => p.isVisible &&
                                            (!productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))).length === 0 && (
                                                <div style={{ padding: '15px', textAlign: 'center', color: '#6c757d' }}>
                                                    No matching products found
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Responsive Edit Items Table/List */}
                        <div className={styles.responsiveTableContainer} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                            <style>{`
                                .edit-item-row {
                                    display: grid;
                                    grid-template-columns: 4fr 1fr 1fr 1.2fr 40px;
                                    gap: 10px;
                                    align-items: center;
                                    padding: 10px;
                                    border-bottom: 1px solid #eee;
                                }
                                .edit-header {
                                    background-color: #f1f1f1;
                                    font-weight: bold;
                                    border-bottom: 2px solid #ddd;
                                }
                                .mobile-label { display: none; }
                                
                                /* Valid for Desktop & Mobile */
                                .edit-item-row > div:first-child {
                                    text-align: left !important;
                                    justify-self: start !important;
                                    width: 100%;
                                }
                                
                                .item-product-name {
                                    text-align: left !important;
                                    padding-left: 10px;
                                    display: block;
                                    width: 100%;
                                }

                                @media (max-width: 900px) {
                                    .edit-header { display: none; }
                                    .edit-item-row {
                                        grid-template-columns: 1fr;
                                        gap: 10px;
                                        padding: 15px;
                                        border: 1px solid #ddd;
                                        margin-bottom: 15px;
                                        border-radius: 8px;
                                        background: white;
                                        position: relative;
                                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                                    }
                                    .edit-item-row > div:first-child {
                                        font-weight: 500;
                                        color: #333;
                                        text-align: left;
                                        padding-left: 10px;
                                    }
                                    .mobile-label {
                                        display: inline-block;
                                        font-weight: 600;
                                        color: #666;
                                        width: 80px;
                                        min-width: 80px;
                                        margin-right: 10px;
                                    }
                                    .item-product-name {
                                        font-size: 16px;
                                        font-weight: bold;
                                        color: #333;
                                        margin-bottom: 10px;
                                        border-bottom: 1px solid #eee;
                                        padding-bottom: 8px;
                                        width: 100%;
                                        text-align: left !important;
                                        padding-left: 10px;
                                    }
                                    .remove-btn-mobile {
                                        position: absolute;
                                        top: 10px;
                                        right: 10px;
                                    }
                                    .edit-input-group {
                                        display: flex;
                                        align-items: center;
                                        justify-content: flex-start !important;
                                        width: 100%;
                                    }
                                }
                            `}</style>

                            <div className="edit-item-row edit-header">
                                <div>Product</div>
                                <div style={{ textAlign: 'center' }}>Qty</div>
                                <div style={{ textAlign: 'center' }}>Price</div>
                                <div style={{ textAlign: 'right' }}>Total</div>
                                <div></div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {editItems.map((item, index) => (
                                    <div
                                        key={index}
                                        className="edit-item-row"
                                        ref={el => itemRefs.current[item.productId] = el}
                                        style={{
                                            backgroundColor: highlightedProductId === item.productId ? '#e8f0fe' : (index % 2 === 0 ? '#ffffff' : '#f1f3f4'),
                                            transition: 'background-color 0.5s ease'
                                        }}
                                    >
                                        <div className="item-product-name">
                                            {item.name}
                                            {item.description && (
                                                <div style={{ fontSize: '11px', color: '#666', fontWeight: 'normal' }}>
                                                    ({item.description})
                                                </div>
                                            )}
                                            <div style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>{item.unit}</div>
                                        </div>

                                        <div className="edit-input-group" style={{ justifyContent: 'center' }}>
                                            <span className="mobile-label">Qty:</span>
                                            <input
                                                type="number"
                                                min="0.1"
                                                step="0.1"
                                                value={item.quantity}
                                                onChange={(e) => handleEditItemChange(index, 'quantity', e.target.value)}
                                                style={{
                                                    width: '70px',
                                                    padding: '8px',
                                                    textAlign: 'center',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '4px',
                                                    fontSize: '14px'
                                                }}
                                            />
                                        </div>

                                        <div className="edit-input-group" style={{ justifyContent: 'center' }}>
                                            <span className="mobile-label">Price:</span>
                                            <div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.price}
                                                    onChange={(e) => handleEditItemChange(index, 'price', e.target.value)}
                                                    style={{
                                                        width: '90px',
                                                        padding: '8px',
                                                        textAlign: 'center',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                                {item.price !== item.originalPrice && (
                                                    <div style={{ fontSize: '11px', color: '#e67e22', marginTop: '2px', textAlign: 'center' }}>
                                                        Modified
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="edit-input-group" style={{ justifyContent: 'flex-end' }}>
                                            <span className="mobile-label">Total:</span>
                                            <span style={{ fontWeight: 'bold' }}>
                                                {formatPrice(item.quantity * item.price)}
                                            </span>
                                        </div>

                                        <div style={{ textAlign: 'center' }} className="remove-btn-mobile">
                                            <button
                                                onClick={() => handleRemoveEditItem(index)}
                                                style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', padding: '5px' }}
                                                title="Remove Item"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '15px',
                                borderTop: '2px solid #ddd',
                                backgroundColor: '#f9f9f9',
                                marginTop: '10px',
                                borderRadius: '0 0 8px 8px'
                            }}>
                                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Grand Total (Rs):</span>
                                <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#28a745' }}>
                                    {formatPrice(calculateEditTotal())}
                                </span>
                            </div>
                        </div>

                        <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                            <button onClick={handleSubmitOrderEdit} className={styles.btnConfirm}>Save Changes</button>
                            <button onClick={handleCancelEdit} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div >
            )
            }

            {/* User Edit Modal */}
            {
                showUserEditModal && (
                    <div className={styles.modal}>
                        <div className={styles.modalContent} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <h3>Edit Customer Profile</h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {/* Mobile - Disabled */}
                                <div className={styles.formGroup}>
                                    <label>Mobile Number</label>
                                    <input
                                        type="text"
                                        value={userEditForm.mobile}
                                        disabled
                                        className={styles.modalInput}
                                        style={{ backgroundColor: '#e9ecef', cursor: 'not-allowed' }}
                                    />
                                </div>

                                {/* Alt Mobile */}
                                <div className={styles.formGroup}>
                                    <label>Alternative Mobile</label>
                                    <input
                                        type="text"
                                        value={userEditForm.altMobile}
                                        onChange={(e) => handleUserInputChange('altMobile', e.target.value)}
                                        maxLength="10"
                                        placeholder="Alternative 10-digit mobile"
                                        className={styles.modalInput}
                                    />
                                </div>

                                {/* Name */}
                                <div className={styles.formGroup}>
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        value={userEditForm.name}
                                        onChange={(e) => handleUserInputChange('name', e.target.value)}
                                        maxLength="29"
                                        placeholder="Customer name"
                                        className={styles.modalInput}
                                    />
                                </div>

                                {/* Email */}
                                <div className={styles.formGroup}>
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={userEditForm.email}
                                        onChange={(e) => handleUserInputChange('email', e.target.value)}
                                        placeholder="so.and.so@example.com"
                                        className={styles.modalInput}
                                    />
                                </div>

                                {/* District */}
                                <div className={styles.formGroup}>
                                    <label>District</label>
                                    <select
                                        value={userEditForm.district}
                                        onChange={(e) => handleUserInputChange('district', e.target.value)}
                                        className={styles.modalSelect}
                                    >
                                        <option value="">Select district</option>
                                        {Object.keys(locations).sort().map(dist => (
                                            <option key={dist} value={dist}>{dist}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Taluk */}
                                <div className={styles.formGroup}>
                                    <label>Taluk</label>
                                    <select
                                        value={userEditForm.taluk}
                                        onChange={(e) => handleUserInputChange('taluk', e.target.value)}
                                        className={styles.modalSelect}
                                        disabled={!userEditForm.district}
                                    >
                                        <option value="">Select taluk</option>
                                        {(userEditForm.district && locations[userEditForm.district] ? locations[userEditForm.district].sort() : []).map(taluk => (
                                            <option key={taluk} value={taluk}>{taluk}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Address - Full Width */}
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Address</label>
                                    <textarea
                                        value={userEditForm.address}
                                        onChange={(e) => handleUserInputChange('address', e.target.value)}
                                        maxLength="150"
                                        placeholder="Full address"
                                        className={styles.modalTextarea}
                                        rows="3"
                                    />
                                </div>

                                {/* Pincode */}
                                <div className={styles.formGroup}>
                                    <label>Pincode</label>
                                    <input
                                        type="text"
                                        value={userEditForm.pincode}
                                        onChange={(e) => handleUserInputChange('pincode', e.target.value)}
                                        maxLength="6"
                                        placeholder="6-digit pincode"
                                        className={styles.modalInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                                <button onClick={handleSubmitUserEdit} className={styles.btnConfirm}>Save Profile</button>
                                <button onClick={() => setShowUserEditModal(false)} className={styles.btnCancel}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )
            }
            <AdminPasswordModal
                show={showDeleteAuthModal}
                title="Delete Order"
                message={`Are you sure you want to delete order ${order.customOrderId}? This action cannot be undone.`}
                onConfirm={confirmDeleteOrder}
                onCancel={() => setShowDeleteAuthModal(false)}
            />

            {showItemsPopup && selectedBatchForItems && (
                <div className={styles.modal} style={{ zIndex: 10002 }}>
                    <div className={styles.modalContent} style={{ maxWidth: '800px', position: 'relative' }}>
                        <button 
                            onClick={() => { setShowItemsPopup(false); setSelectedBatchForItems(null); }}
                            style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
                        >✕</button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                            <h3 style={{ margin: 0 }}>Dispatch Details</h3>
                            {selectedBatchForItems.agentSection && (
                                <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', marginRight: '30px' }}>
                                    <button 
                                        onClick={() => handleAgainDelivery(selectedBatchForItems.agentSection)}
                                        title="Assign same agent for new dispatch"
                                        style={{ background: '#e7f3ff', color: '#0d6efd', border: '1px solid #cfe2ff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', padding: '4px 8px' }}
                                    >🚚 Again Delivery</button>
                                    <button 
                                        onClick={() => { setShowItemsPopup(false); handleEditAgentSection(selectedBatchForItems.agentSection); }}
                                        title="Edit Agent Details"
                                        style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', padding: '4px 8px' }}
                                    >✏️ Edit</button>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => { setShowItemsPopup(false); handleDeleteAgentSection(selectedBatchForItems.dispatchId); }}
                                            title="Delete Dispatch Section"
                                            style={{ background: '#fff0f0', color: '#dc3545', border: '1px solid #ffc9c9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', padding: '4px 8px' }}
                                        >🗑️ Delete</button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '13px' }}>
                            <div>
                                <div style={{ fontWeight: 'bold', color: '#495057' }}>Dispatch ID</div>
                                <div>{selectedBatchForItems.dispatchId}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', color: '#495057' }}>Date & Time</div>
                                <div>{new Date(selectedBatchForItems.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>

                        {selectedBatchForItems.items && selectedBatchForItems.items[0]?.deliveryAgent && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', padding: '12px', backgroundColor: '#e8f4fd', borderRadius: '8px', border: '1px solid #b8d8f0', marginBottom: '20px' }}>
                                {selectedBatchForItems.items[0].deliveryAgent.name && selectedBatchForItems.items[0].deliveryAgent.name !== 'Unknown Agent' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ color: '#5a7a9a', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>👤 Agent:</span>
                                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{selectedBatchForItems.items[0].deliveryAgent.name}</span>
                                    </div>
                                )}
                                {selectedBatchForItems.items[0].deliveryAgent.mobile && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ color: '#5a7a9a', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>📱 Mobile:</span>
                                        <span style={{ fontSize: '13px' }}>{selectedBatchForItems.items[0].deliveryAgent.mobile}</span>
                                    </div>
                                )}
                                {selectedBatchForItems.items[0].deliveryAgent.description && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ color: '#5a7a9a', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>🚚 Vehicle:</span>
                                        <span style={{ fontSize: '13px' }}>{selectedBatchForItems.items[0].deliveryAgent.description}</span>
                                    </div>
                                )}
                                {selectedBatchForItems.items[0].deliveryAgent.address && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ color: '#5a7a9a', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>📍 Address:</span>
                                        <span style={{ fontSize: '13px', color: '#495057' }}>{selectedBatchForItems.items[0].deliveryAgent.address}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#5a7a9a', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>💰 Rent (Rs):</span>
                                    <input 
                                        type="number"
                                        defaultValue={selectedBatchForItems.agentCharge}
                                        onBlur={async (e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            if (val !== selectedBatchForItems.agentCharge) {
                                                try {
                                                    await api.updateAgentCharge(order._id, selectedBatchForItems.date, val);
                                                    if (onRefresh) await onRefresh();
                                                    // Also instantly update local UI so it doesn't snap back before refresh completes
                                                    setSelectedBatchForItems(prev => ({ ...prev, agentCharge: val }));
                                                } catch (err) {
                                                    alert(`Error: ${err.message}`);
                                                }
                                            }
                                        }}
                                        style={{ width: '70px', padding: '4px', fontSize: '13px', border: '1px solid #b8d8f0', borderRadius: '4px', textAlign: 'center' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#5a7a9a', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>💵 Amount (Rs):</span>
                                    <input 
                                        type="number"
                                        defaultValue={selectedBatchForItems.expectedAmount}
                                        onBlur={async (e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            if (val !== selectedBatchForItems.expectedAmount) {
                                                try {
                                                    await api.updateExpectedAmount(order._id, selectedBatchForItems.date, val);
                                                    if (onRefresh) await onRefresh();
                                                    // Also instantly update local UI so it doesn't snap back before refresh completes
                                                    setSelectedBatchForItems(prev => ({ ...prev, expectedAmount: val }));
                                                } catch (err) {
                                                    alert(`Error: ${err.message}`);
                                                }
                                            }
                                        }}
                                        style={{ width: '70px', padding: '4px', fontSize: '13px', border: '1px solid #b8d8f0', borderRadius: '4px', textAlign: 'center' }}
                                    />
                                </div>
                            </div>
                        )}

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee', backgroundColor: '#f8f9fa' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Product</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedBatchForItems.items.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ fontWeight: '600' }}>{item.product?.name || item.name}</div>
                                            {item.product?.description && (
                                                <div style={{ fontSize: '11px', color: '#6c757d' }}>({item.product.description})</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#2b8a3e' }}>
                                            {item.quantityDelivered} {item.product?.unit || item.unit}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                            <span style={{ fontWeight: 'bold' }}>Total Items:</span>
                            <span style={{ fontWeight: 'bold' }}>{selectedBatchForItems.items.length}</span>
                        </div>

                        <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                            <button 
                                onClick={() => { setShowItemsPopup(false); setSelectedBatchForItems(null); }} 
                                className={styles.btnConfirm}
                                style={{ width: '100%' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
