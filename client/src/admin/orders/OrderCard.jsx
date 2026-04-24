
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
    isBalanceTab, 
    isDispatchTab,
    refreshTrigger = 0
}) {
    const navigate = useNavigate();
    // Helper to render standard Rupee symbol
    const Rupee = () => <span className={styles.rupee}>₹</span>;

    const getTabForStatus = (status, isAdmin) => {
        const base = isAdmin ? '/admin' : '/staff';
        switch (status) {
            case 'Ordered': return `${base}/pending`;
            case 'Rate Requested': return `${base}/rate-requested`;
            case 'Rate Approved': return `${base}/rate-approved`;
            case 'Confirmed': return `${base}/confirmed`;
            case 'Dispatch':
            case 'Partially Delivered': return `${base}/dispatch`;
            case 'Delivered': return `${base}/delivered`;
            case 'Paused': return `${base}/paused`;
            case 'Hold': return `${base}/hold`;
            case 'Cancelled': return `${base}/cancelled`;
            case 'Completed': return `${base}/delivered`;
            default: return base;
        }
    };

    const handleIdClick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent card from toggling expand
        const path = getTabForStatus(order.status, isAdmin);
        navigate(`${path}#${order._id}`);
    };

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
    const [deliveryDateTime, setDeliveryDateTime] = useState('');
    const [popupDeliveryQuantities, setPopupDeliveryQuantities] = useState({});
    const [popupDeliveryRent, setPopupDeliveryRent] = useState('');
    const [popupDeliveryDateTime, setPopupDeliveryDateTime] = useState('');
    const [showItemsPopup, setShowItemsPopup] = useState(false);
    const [selectedBatchForItems, setSelectedBatchForItems] = useState(null);

    // Delivery History Modal State
    const [deliveryHistory, setDeliveryHistory] = useState([]);
    const [confirmingBatch, setConfirmingBatch] = useState(null); // { key, date }
    const [confirmAmount, setConfirmAmount] = useState('');
    const [confirmPaymentMode, setConfirmPaymentMode] = useState('Cash'); // Default to Cash
    const [popupCollectionAmount, setPopupCollectionAmount] = useState('');
    const [popupCollectionMode, setPopupCollectionMode] = useState('Cash');
    const [isSavingCollection, setIsSavingCollection] = useState(false);
    const [isEditingCollection, setIsEditingCollection] = useState(false);
    const [isEditingRent, setIsEditingRent] = useState(false);
    const [isSavingRent, setIsSavingRent] = useState(false);

    const openBatchPopup = (batch, agentSection) => {
        if (batch.isPending) {
            const fullItemsForPopup = order.items.map(orderItem => {
                const productId = orderItem.product?._id || orderItem.product || orderItem._id;
                const totalDeliveredSoFar = orderItem.quantityDelivered || 0;
                const available = orderItem.quantityOrdered - totalDeliveredSoFar;
                return {
                    product: productId,
                    name: orderItem.product?.name || orderItem.name,
                    unit: orderItem.product?.unit || orderItem.unit,
                    totalOrdered: orderItem.quantityOrdered,
                    totalRemaining: available,
                    quantity: 0,
                    price: orderItem.price || 0,
                    isCustom: orderItem.isCustom,
                    isQtyNotSpecified: orderItem.isQtyNotSpecified,
                    _id: orderItem._id
                };
            });
            setPopupDeliveryQuantities({});
            setPopupDeliveryRent('');
            setPopupCollectionAmount('');
            setPopupCollectionMode('Cash');
            // Default dispatch datetime to now
            const nowLocal = new Date();
            setPopupDeliveryDateTime(new Date(nowLocal - nowLocal.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
            setSelectedBatchForItems({ 
                dispatchId: batch.dispatchId, 
                date: new Date(), 
                items: fullItemsForPopup,
                agentSection: agentSection,
                isPending: true 
            });
        } else {
            const fullItemsForPopup = order.items.map(orderItem => {
                const productId = orderItem.product?._id || orderItem.product || orderItem._id;
                const thisBatchItem = batch.items?.find(bi => (bi.product?._id || bi.product) === productId);
                const thisBatchQty = thisBatchItem?.quantityDelivered || 0;
                const totalDeliveredSoFar = orderItem.quantityDelivered || 0;
                const remaining = orderItem.quantityOrdered - totalDeliveredSoFar;
                return {
                    product: productId,
                    name: orderItem.product?.name || orderItem.name,
                    unit: orderItem.product?.unit || orderItem.unit,
                    totalOrdered: orderItem.quantityOrdered,
                    totalRemaining: remaining,
                    quantity: thisBatchQty,
                    price: orderItem.price || 0,
                    isCustom: orderItem.isCustom,
                    isQtyNotSpecified: orderItem.isQtyNotSpecified,
                    _id: orderItem._id
                };
            });
            setSelectedBatchForItems({ ...batch, items: fullItemsForPopup, agentSection: agentSection, isPending: false });
            setPopupCollectionAmount(batch.receivedAmount > 0 ? batch.receivedAmount : '');
            setPopupCollectionMode(batch.items[0]?.paymentMode || 'Cash');
        }
        setIsEditingCollection(false);
        setIsEditingRent(false);
        setShowItemsPopup(true);
    };

    // Edit Order Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editItems, setEditItems] = useState([]); // { productId, name, unit, price, quantity, type: 'existing'|'new' }
    const [availableProducts, setAvailableProducts] = useState([]);
    const [productSearch, setProductSearch] = useState(null); // null means collapsed, '' means expanded showing all
    const [highlightedProductId, setHighlightedProductId] = useState(null);
    const itemRefs = useRef({});

    // Custom Product Form State
    const [showCustomProductForm, setShowCustomProductForm] = useState(false);
    const [customProductForm, setCustomProductForm] = useState({ name: '', quantity: '', price: '', unit: '' });
    const [isAddingCustomProduct, setIsAddingCustomProduct] = useState(false);

    // Custom Product Editing State
    const [showEditCustomProductModal, setShowEditCustomProductModal] = useState(false);
    const [editingCustomProduct, setEditingCustomProduct] = useState(null); // { _id, name, quantityOrdered, price, unit, description }
    const [isUpdatingCustomProduct, setIsUpdatingCustomProduct] = useState(false);

    // Auth Modal State
    const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);
    const [showCollectionEditAuthModal, setShowCollectionEditAuthModal] = useState(false);
    const [showEditAuthModal, setShowEditAuthModal] = useState(false);

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

    // Date Editing State
    const [isEditingDate, setIsEditingDate] = useState(false);
    const [editedDate, setEditedDate] = useState('');
    const [isSavingDate, setIsSavingDate] = useState(false);

    // Adjustment Date Editing State
    const [editingAdjId, setEditingAdjId] = useState(null);
    const [editedAdjDate, setEditedAdjDate] = useState('');
    const [isSavingAdjDate, setIsSavingAdjDate] = useState(false);

    // Dispatch Batch Date Editing State (Admin only)
    const [editingBatchKey, setEditingBatchKey] = useState(null);
    const [editedBatchDate, setEditedBatchDate] = useState('');
    const [isSavingBatchDate, setIsSavingBatchDate] = useState(false);

    const cardRef = useRef(null);

    // Global App Settings
    const [appController, setAppController] = useState({ isChargesEnabledAdmin: true, isChargesEnabledStaff: true });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settings = await api.getAppController();
                setAppController(settings);
            } catch (err) {
                console.error('Error fetching app settings in OrderCard:', err);
            }
        };
        if (isExpanded) {
            fetchSettings();
        }
    }, [isExpanded, api, refreshTrigger]);

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
            if (isExpanded && (order.status === 'Dispatch' || order.status === 'Partially Delivered' || order.status === 'Delivered' || order.status === 'Completed')) {
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
        // If it's a custom item and quantity is 0, treat it as 1 for total weight/amount calculation
        const effectiveQty = (item.isCustom && qty === 0) ? 1 : qty;
        return sum + (effectiveQty * item.price);
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

    const handleUpdateAdjDate = async (adjId) => {
        if (!editedAdjDate) return;
        setIsSavingAdjDate(true);
        try {
            const res = await api.updateAdjustmentDate(order._id, adjId, editedAdjDate);
            if (res.ok && res.order) {
                if (onOrderUpdate) onOrderUpdate(res.order);
                else if (onRefresh) await onRefresh();
                setEditingAdjId(null);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsSavingAdjDate(false);
        }
    };

    const handleSaveBatchDate = async (batchKey) => {
        if (!editedBatchDate) return;
        setIsSavingBatchDate(true);
        try {
            await adminApi.updateDispatchBatchDate(order._id, batchKey, editedBatchDate);
            setEditingBatchKey(null);
            if (onRefresh) await onRefresh();
        } catch (err) {
            alert(`Error updating dispatch date: ${err.message}`);
        } finally {
            setIsSavingBatchDate(false);
        }
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
            'Completed': '#28a745',
            'Paused': '#ffc107',
            'Hold': '#dc3545',
            'Cancelled': '#6c757d'
        };
        return colors[order.status] || '#000';
    };

    // --- Edit Order Handlers ---
    const handleEditOrder = async () => {
        const isOrderProtected = order.status === 'Delivered' || 
                                 order.status === 'Completed' || 
                                 order.status === 'Cancelled' || 
                                 ((order.status === 'Dispatch' || order.status === 'Partially Delivered') && allItemsDelivered);

        if (isOrderProtected) {
            setShowEditAuthModal(true);
            return;
        }
        
        openEditOrderProcess();
    };

    const openEditOrderProcess = async () => {
        try {
            // Load available products for adding new items
            const res = await api.getProducts();
            setAvailableProducts(res.products || []);

            // Initialize edit items from order
            const items = order.items.map(item => ({
                productId: (item.product && typeof item.product === 'object') ? (item.product._id || item.product.id) : item.product,
                name: item.name,
                description: item.description,
                unit: item.unit,
                price: item.price,
                quantity: item.quantityOrdered,
                originalPrice: item.price, // Track for price change detection
                isCustom: item.isCustom || false
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
        return editItems.reduce((sum, item) => {
            const qty = (item.isCustom && (item.quantity === 0 || item.quantity === '')) ? 1 : (parseFloat(item.quantity) || 0);
            return sum + (qty * item.price);
        }, 0);
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
                quantity: (item.isCustom && (item.quantity === 0 || item.quantity === '')) ? 1 : (item.quantity || 0),
                price: item.price,
                isCustom: item.isCustom,
                name: item.name,
                unit: item.unit,
                description: item.description
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
            // Show the specific error from the API if available
            alert(`Failed to update order: ${err.message}`);
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

    // --- Custom Product Handlers ---
    const handleAddCustomProduct = async () => {
        const { name, quantity, price, unit } = customProductForm;
        if (!name.trim()) { alert('Please enter a product name.'); return; }
        const parsedQty = quantity === '' ? 1 : (parseFloat(quantity) || 0);
        const parsedPrice = parseFloat(price) || 0;
        if (parsedQty < 0) { alert('Quantity cannot be negative.'); return; }
        if (parsedPrice < 0) { alert('Price cannot be negative.'); return; }
        
        let confirmMsg = `Add "${name.trim()}" to this order?`;
        if (parsedQty > 0 && parsedPrice > 0) confirmMsg = `Add "${name.trim()}" (${parsedQty} × ₹${parsedPrice}) to this order?`;
        else if (parsedQty > 0) confirmMsg = `Add "${name.trim()}" (${parsedQty} ${unit || ''}) to this order?`;
        else if (parsedPrice > 0) confirmMsg = `Add "${name.trim()}" (₹${parsedPrice}) to this order?`;
        
        if (!window.confirm(confirmMsg)) return;

        setIsAddingCustomProduct(true);
        try {
            const result = await api.addCustomItem(order._id, { name, quantity: parsedQty, price: parsedPrice, unit });
            setCustomProductForm({ name: '', quantity: '', price: '', unit: '' });
            setShowCustomProductForm(false);
            if (result.order && onOrderUpdate) {
                onOrderUpdate(result.order);
            } else if (onRefresh) {
                await onRefresh();
            }
            alert('Custom product added successfully!');
        } catch (err) {
            alert(`Failed to add custom product: ${err.message}`);
        } finally {
            setIsAddingCustomProduct(false);
        }
    };

    const handleEditCustomItemClick = (item) => {
        setEditingCustomProduct({
            _id: item._id,
            name: item.name,
            quantity: item.quantityOrdered,
            price: item.price,
            unit: item.unit || '',
            description: item.description || ''
        });
        setShowEditCustomProductModal(true);
    };

    const handleSubmitCustomItemUpdate = async () => {
        if (!editingCustomProduct.name.trim()) { alert('Please enter a product name.'); return; }
        const parsedQty = editingCustomProduct.quantity === '' ? 1 : (parseFloat(editingCustomProduct.quantity) || 0);
        const parsedPrice = parseFloat(editingCustomProduct.price) || 0;
        if (parsedQty < 0) { alert('Quantity cannot be negative.'); return; }
        if (parsedPrice < 0) { alert('Price cannot be negative.'); return; }

        setIsUpdatingCustomProduct(true);
        try {
            const result = await api.updateCustomItem(order._id, editingCustomProduct._id, {
                name: editingCustomProduct.name,
                quantity: parsedQty,
                price: parsedPrice,
                unit: editingCustomProduct.unit,
                description: editingCustomProduct.description
            });
            setShowEditCustomProductModal(false);
            setEditingCustomProduct(null);
            if (result.order && onOrderUpdate) {
                onOrderUpdate(result.order);
            } else if (onRefresh) {
                await onRefresh();
            }
            alert('Custom product updated successfully!');
        } catch (err) {
            alert(`Failed to update custom product: ${err.message}`);
        } finally {
            setIsUpdatingCustomProduct(false);
        }
    };

    const handleDeleteCustomItem = async (itemId, itemName) => {
        if (!window.confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) return;

        try {
            const result = await api.deleteCustomItem(order._id, itemId);
            if (result.order && onOrderUpdate) {
                onOrderUpdate(result.order);
            } else if (onRefresh) {
                await onRefresh();
            }
            alert('Custom product deleted successfully!');
        } catch (err) {
            alert(`Failed to delete custom product: ${err.message}`);
        }
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
            rent: '',
            dispatchDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
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
                agentForm.address,
                agentForm.dispatchDate
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
        // Default dispatch datetime to now
        const nowLocal = new Date();
        setDeliveryDateTime(new Date(nowLocal - nowLocal.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
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

    const handleEditAgentSection = (sectionBatch, specificBatch = null) => {
        const currentDispatchId = specificBatch?.dispatchId || sectionBatch.batches[0]?.dispatchId || sectionBatch.info?.dispatchId;
        
        // Prepare ALL ordered items for editing with context (Total, Remaining, This Dispatch)
        const itemsToEdit = order.items.map(orderItem => {
            const productId = orderItem.product?._id || orderItem.product || orderItem._id;
            
            // Find quantity delivered in THIS specific batch
            const thisBatchItem = specificBatch?.items?.find(bi => (bi.product?._id || bi.product) === productId);
            const thisBatchQty = thisBatchItem?.quantityDelivered || 0;
            
            // Calculate how much was delivered in OTHER batches (Total - This Batch)
            const totalDeliveredSoFar = orderItem.quantityDelivered || 0;
            const otherDelivered = totalDeliveredSoFar - thisBatchQty;
            
            // Remaining amount available to assign to this batch = Total Ordered - Amount in Other Batches
            const availableRemaining = orderItem.quantityOrdered - otherDelivered;

            return {
                product: productId,
                name: orderItem.product?.name || orderItem.name,
                unit: orderItem.product?.unit || orderItem.unit,
                totalOrdered: orderItem.quantityOrdered,
                totalRemaining: availableRemaining,
                quantity: thisBatchQty
            };
        });

        const fDate = specificBatch?.date || sectionBatch.batches?.[0]?.date || Date.now();
        const localDateStr = new Date(new Date(fDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

        setEditAgentModalData({
            dispatchId: currentDispatchId,
            form: {
                newDispatchId: currentDispatchId || '',
                name: sectionBatch.info?.name || '',
                mobile: sectionBatch.info?.mobile || '',
                description: sectionBatch.info?.description || '',
                address: sectionBatch.info?.address || '',
                rent: sectionBatch.agentCharge || '',
                dispatchDate: localDateStr,
                items: itemsToEdit
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
            // Prepare items for backend: filter for non-zero and map to backend expected keys
            const cleanedItems = (editAgentModalData.form.items || [])
                .filter(item => item.quantity > 0)
                .map(item => ({
                    product: item.product,
                    quantityDelivered: item.quantity
                }));

            const payload = {
                ...editAgentModalData.form,
                items: cleanedItems
            };

            await api.updateDispatchAgent(order._id, editAgentModalData.dispatchId, payload);
            alert('Dispatch updated successfully.');
            setShowEditAgentModal(false);
            if (onRefresh) await onRefresh();
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
            await api.recordDelivery(order._id, deliveries, deliveryRent, deliveryDateTime);
            setDeliveryRent('');
            setDeliveryDateTime('');
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
            const batchKey = `${new Date(record.deliveredAt || record.deliveryDate || record.createdAt).getTime()}`;
            
            let batch = batches.find(b => b.key === batchKey);
            if (!batch) {
                batch = {
                    key: batchKey,
                    date: record.deliveredAt || record.deliveryDate || record.createdAt,
                    latestUpdate: record.updatedAt || record.deliveredAt || record.deliveryDate || record.createdAt,
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

            // Track latest update time
            const recordUpdate = record.updatedAt || record.deliveredAt || record.deliveryDate || record.createdAt;
            if (new Date(recordUpdate) > new Date(batch.latestUpdate)) {
                batch.latestUpdate = recordUpdate;
            }
        });
        return batches;
    };

    const groupHistoryByDispatch = (history) => {
        const dispatchesMap = {};
        
        // Group records by dispatch session first
        history.forEach(record => {
            const dispatchId = record.dispatchId || 'N/A';
            if (!dispatchesMap[dispatchId]) {
                dispatchesMap[dispatchId] = {
                    info: record.deliveryAgent,
                    records: [],
                    dispatchId
                };
            }
            dispatchesMap[dispatchId].records.push(record);
        });

        // Convert to array and group each dispatch's records by batch
        return Object.values(dispatchesMap).map(dispatchData => {
            const batches = groupDeliveriesByBatch(dispatchData.records);
            // Track earliest date for sorting dispatches by their first delivery
            const earliestDate = Math.min(...batches.map(b => new Date(b.date).getTime()));
            return {
                info: dispatchData.info,
                batches,
                earliestDate,
                dispatchId: dispatchData.dispatchId
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



    // Date Edit Handlers
    const handleDateEditClick = (e) => {
        e.stopPropagation();
        if (!isAdmin) return;
        // Format: YYYY-MM-DDTHH:mm
        const date = new Date(order.createdAt);
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = new Date(date - offset).toISOString().slice(0, 16);
        setEditedDate(localISOTime);
        setIsEditingDate(true);
    };

    const handleCancelDateEdit = (e) => {
        e.stopPropagation();
        setIsEditingDate(false);
    };

    const handleSaveDate = async (e) => {
        e.stopPropagation();
        if (!editedDate) return;
        
        try {
            setIsSavingDate(true);
            const result = await api.updateOrderDate(order._id, editedDate);
            setIsEditingDate(false);
            
            if (result.order && onOrderUpdate) {
                onOrderUpdate(result.order);
            } else if (onRefresh) {
                await onRefresh();
            }
            alert('Order date updated successfully');
        } catch (err) {
            alert(`Error updating date: ${err.message}`);
        } finally {
            setIsSavingDate(false);
        }
    };

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

    const renderBalanceTableView = () => {
        return (
            <div className={styles.orderCardBody} style={{ width: '100%', boxSizing: 'border-box' }}>
                <div className={styles.balanceHeader}>
                    <h4>📋 Order Summary</h4>
                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                        ID: <span style={{ fontWeight: 800, color: '#1e3a8a' }}>{order.customOrderId || 'N/A'}</span> <span style={{ opacity: 0.4 }}>|</span> 
                        Date: <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatDate(order.createdAt)}</span>
                    </div>
                </div>

                <table className={styles.balanceTable}>
                    <thead>
                        <tr>
                            <th style={{ width: '45%' }}>Item Details</th>
                            <th style={{ textAlign: 'center', width: '15%' }}>Quantity</th>
                            <th style={{ textAlign: 'right', width: '20%' }}>Rate</th>
                            <th style={{ textAlign: 'right', width: '20%' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
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
                                <tr key={index}>
                                    <td>
                                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>{item.name}</div>
                                        {item.description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{item.description}</div>}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#334155' }}>{displayQty} {item.unit || ''}</td>
                                    <td style={{ 
                                        textAlign: 'right', 
                                        color: item.isPriceModified 
                                            ? (item.price < (item.catalogPrice || item.price) ? '#ef4444' : '#22c55e') 
                                            : '#64748b' 
                                    }}>
                                        {formatPrice(item.price)}
                                    </td>
                                    <td style={{ 
                                        textAlign: 'right', 
                                        fontWeight: 700, 
                                        color: item.isPriceModified 
                                            ? (item.price < (item.catalogPrice || item.price) ? '#ef4444' : '#22c55e') 
                                            : '#0f172a' 
                                    }}>
                                        {formatPrice(displayQty * item.price)}
                                    </td>
                                </tr>
                            );
                        })}
                        <tr className={styles.balanceTotalRow}>
                            <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Sub-Total:</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatPrice(totalAmount)}</td>
                        </tr>
                        
                        {order.adjustments && order.adjustments.length > 0 && (
                            <>
                                <tr>
                                    <td colSpan="4" style={{ padding: '0' }}>
                                        <div style={{ 
                                            backgroundColor: '#f8fafc', 
                                            padding: '12px 24px', 
                                            fontSize: '11px', 
                                            fontWeight: 800, 
                                            color: '#64748b', 
                                            textTransform: 'uppercase', 
                                            letterSpacing: '0.1em',
                                            borderTop: '1px solid #f1f5f9',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            Adjustments & Payments
                                        </div>
                                    </td>
                                </tr>
                                {order.adjustments.map((adj, index) => (
                                    <tr key={`adj-${index}`} className={`${styles.balanceAdjustmentRow} ${styles[adj.type] || ''}`}>
                                        <td style={{ paddingLeft: '32px' }}>
                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                                                {adj.date ? new Date(adj.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                                            </div>
                                            <div style={{ fontWeight: 600 }}>{adj.description}</div>
                                        </td>
                                        <td colSpan="2" style={{ textAlign: 'right', textTransform: 'capitalize', fontSize: '12px', fontWeight: 700, opacity: 0.8 }}>{adj.type}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                            <span style={{ fontSize: '12px', marginRight: '4px' }}>{adj.type === 'charge' ? '+' : '-'}</span>
                                            {formatPrice(adj.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
                        <tr className={styles.balanceTotalRow}>
                            <td colSpan="3" style={{ textAlign: 'right', fontSize: '16px', fontWeight: 600, color: '#475569' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                    <span>Balance Due</span>
                                    <span style={{ fontSize: '12px', opacity: 0.6 }}>(Net Payable)</span>
                                </div>
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '20px', color: '#ef4444', fontWeight: 900 }}>
                                {formatPrice(finalTotal)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Dispatch Detail in table format if applicable */}
                {deliveryHistory.length > 0 && (
                    <div style={{ marginTop: '40px' }}>
                        <div className={styles.balanceHeader}>
                            <h4>🚚 Dispatch History</h4>
                        </div>
                        <table className={styles.balanceTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: '30%' }}>Dispatch ID & Date</th>
                                    <th style={{ textAlign: 'center', width: '40%' }}>Items Delivered</th>
                                    <th style={{ textAlign: 'center', width: '15%' }}>Payment</th>
                                    <th style={{ textAlign: 'right', width: '15%' }}>Collected</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupDeliveriesByBatch(deliveryHistory).map((batch, bIndex) => (
                                    <tr key={batch.key}>
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>#{batch.dispatchId}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                                                {new Date(batch.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ 
                                                fontSize: '13px', 
                                                color: '#334155', 
                                                lineHeight: '1.5',
                                                backgroundColor: '#f8fafc',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                display: 'inline-block'
                                            }}>
                                                {batch.items.map(i => `${i.product?.name || 'Item'}: ${i.quantityDelivered}`).join(', ')}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ 
                                                fontSize: '11px', 
                                                padding: '4px 10px', 
                                                borderRadius: '20px',
                                                backgroundColor: batch.items[0]?.paymentMode === 'Cash' ? '#ecfdf5' : '#eff6ff',
                                                color: batch.items[0]?.paymentMode === 'Cash' ? '#059669' : '#2563eb',
                                                fontWeight: 800,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                border: `1px solid ${batch.items[0]?.paymentMode === 'Cash' ? '#d1fae5' : '#dbeafe'}`
                                            }}>
                                                {batch.items[0]?.paymentMode || 'N/A'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>
                                            {formatPrice(batch.receivedAmount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className={styles.orderActions} style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
                            import('../../utils/generateBill').then(({ generateBill }) => generateBill(order, null));
                        } finally {
                            setIsPayLoading(false);
                        }
                    }} className={styles.btnConfirm} style={{ backgroundColor: '#28a745', margin: 0 }} disabled={isPayLoading}>
                        {isPayLoading ? 'Loading...' : 'Print Bill'}
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
                            alert("Failed to load payment settings.");
                            import('../../utils/generateBill').then(({ generateBillWithHeader }) => generateBillWithHeader(order, null));
                        } finally {
                            setIsPayLoading(false);
                        }
                    }} className={styles.btnConfirm} style={{ backgroundColor: '#0d6efd', margin: 0 }} disabled={isPayLoading}>
                        {isPayLoading ? 'Loading...' : 'Print Bill (Header)'}
                    </button>
                </div>
            </div>
        );
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
                        {isAdmin && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                    </>
                );
            case 'Rate Approved':
                return (
                    <>
                        {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                        <button onClick={handleConfirm} className={styles.btnConfirm}>Confirm</button>
                        <button onClick={handleHold} className={styles.btnHold}>Hold</button>
                        <button onClick={handleCancelRateRequest} className={styles.btnCancel}>Cancel Request</button>
                        {isAdmin && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                    </>
                );
            case 'Confirmed':
                return (
                    <>
                        {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                        <button onClick={handleMoveToDispatch} className={styles.btnDispatch}>Dispatch</button>
                        <button onClick={handleHold} className={styles.btnHold}>Hold</button>
                        <button onClick={handleCancel} className={styles.btnCancel}>Cancel</button>
                        {isAdmin && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
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
                            {isAdmin && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                        </>
                    );
                } else {
                    return (
                        <>
                            {!isBalanceTab && <button onClick={handleEditOrder} className={styles.btnEditSmall} style={{ marginRight: '5px', width: '40%' }}>Edit Order</button>}
                            {isAdmin && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
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
                        {isAdmin && <button onClick={handleDelete} className={styles.btnDelete} style={{ backgroundColor: '#dc3545', color: '#fff' }}>Delete</button>}
                    </>
                );
            case 'Delivered':
            case 'Completed':
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
            <div className={styles.orderCard} ref={cardRef} id={order._id}>
                <div className={styles.orderCardHeader} onClick={onToggleExpand}>
                    <div>
                        <strong>ID: <a href="#" onClick={handleIdClick} style={{ color: '#007bff', textDecoration: 'underline' }}>{order.customOrderId || 'N/A'}</a></strong> - {order.user?.name || 'N/A'} ({order.user?.mobile || 'N/A'})
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: (isDispatchTab && allItemsDelivered) ? '#3E7400' : getStatusColor(), fontWeight: 'bold' }}>
                            {(() => {
                                if (isDispatchTab && allItemsDelivered) return 'Dispatch Completed';
                                if ((order.status === 'Dispatch' || order.status === 'Partially Delivered') && order.deliveryAgent?.name) {
                                    const activeDispatchId = order.deliveryAgent?.dispatchId;
                                    const hasActiveDelivery = deliveryHistory?.some(h => h.dispatchId === activeDispatchId);
                                    if (!hasActiveDelivery) return 'Ready Dispatch';
                                }
                                return order.status;
                            })()}
                        </div>
                    </div>
                </div>

                {isExpanded && isBalanceTab && (
                    renderBalanceTableView()
                )}
                
                {isExpanded && !isBalanceTab && (
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
                                <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong>Ordered at:</strong> 
                                    {isEditingDate ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={e => e.stopPropagation()}>
                                            <input 
                                                type="datetime-local" 
                                                value={editedDate}
                                                onChange={(e) => setEditedDate(e.target.value)}
                                                style={{ 
                                                    padding: '2px 5px', 
                                                    fontSize: '12px', 
                                                    border: '1px solid #ced4da', 
                                                    borderRadius: '4px' 
                                                }}
                                            />
                                            <button 
                                                onClick={handleSaveDate} 
                                                disabled={isSavingDate}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}
                                                title="Save"
                                            >✅</button>
                                            <button 
                                                onClick={handleCancelDateEdit}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}
                                                title="Cancel"
                                            >❌</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{formatDate(order.createdAt)}</span>
                                            {isAdmin && (
                                                <span 
                                                    onClick={handleDateEditClick}
                                                    style={{ cursor: 'pointer', fontSize: '14px', opacity: 0.7 }}
                                                    title="Edit Date"
                                                >✏️</span>
                                            )}
                                        </div>
                                    )}
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {item.isCustom && (
                                                    <div style={{ display: 'flex', gap: '8px', marginRight: '5px' }}>
                                                        <span 
                                                            onClick={(e) => { e.stopPropagation(); handleEditCustomItemClick(item); }}
                                                            style={{ cursor: 'pointer', fontSize: '14px', filter: 'grayscale(1)', transition: 'all 0.2s' }}
                                                            className={styles.hoverScale}
                                                            title="Edit Custom Product"
                                                        >✏️</span>
                                                        <span 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteCustomItem(item._id, item.name); }}
                                                            style={{ cursor: 'pointer', fontSize: '14px', filter: 'grayscale(1)', transition: 'all 0.2s' }}
                                                            className={styles.hoverScale}
                                                            title="Delete Custom Product"
                                                        >🗑️</span>
                                                    </div>
                                                )}
                                                <span>{item.name}</span>
                                            </div>
                                            {item.description && (
                                                <span style={{ fontSize: '12px', color: '#666', marginLeft: '35px', fontWeight: 'normal', display: 'block' }}>
                                                    ({item.description})
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.itemQty}>
                                            {item.isCustom ? (
                                                <>
                                                    {(!item.isCustom || displayQty > 1) && displayQty > 0 && `${displayQty} ${item.unit || ''}`}
                                                    {(!item.isCustom || displayQty > 1) && displayQty > 0 && item.price > 0 && ' × '}
                                                    {item.price > 0 && (
                                                        <span style={{ 
                                                            color: item.isPriceModified 
                                                                ? (item.price < (item.catalogPrice || item.price) ? '#ef4444' : '#22c55e') 
                                                                : 'inherit' 
                                                        }}>
                                                            {formatPrice(item.price)}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <>{displayQty} {item.unit || ''} × <span style={{ 
                                                    color: item.isPriceModified 
                                                        ? (item.price < (item.catalogPrice || item.price) ? '#ef4444' : '#22c55e') 
                                                        : 'inherit' 
                                                }}>{formatPrice(item.price)}</span></>
                                            )}
                                        </div>
                                        <div className={styles.itemPrice} style={{ 
                                            color: item.isPriceModified 
                                                ? (item.price < (item.catalogPrice || item.price) ? '#ef4444' : '#22c55e') 
                                                : 'inherit' 
                                        }}>
                                            {formatPrice((item.isCustom && displayQty === 0) ? item.price : (displayQty * item.price))}
                                        </div>
                                    </li>
                                );
                            })}

                            <li className={styles.orderTotal}>
                                <div></div>
                                <div><strong>{isBalanceTab ? <>Total Order Value ({Rupee()}):</> : <>Total Amount ({Rupee()}):</>}</strong></div>
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
                                                <div style={{ textAlign: 'left', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#666' }}>
                                                        {adj.type === 'payment' && (
                                                            <>
                                                                📅 {adj.date ? new Date(adj.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                            </>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        {isAgentCollection && <span title="Collection via Dispatch Agent">📦</span>}
                                                    {(() => {
                                                        if (!isAgentCollection) return adj.description;
                                                        const agentCollections = order.adjustments.filter(a => 
                                                            a.description?.startsWith('Collection via Delivery Agent:') || 
                                                            a.description?.startsWith('Collection via Dispatch Agent:')
                                                        );
                                                        const showNumeric = agentCollections.length > 1 || !allItemsDelivered;
                                                        const label = (() => {
                                                            const allBatches = groupDeliveriesByBatch(order.deliveries || []);
                                                            const batchTimestamp = adj.batchId || (adj.description?.match(/\[BatchID:\s*(\d+)\]/)?.[1]);
                                                            const targetBatch = allBatches.find(b => b.key === batchTimestamp);
                                                            const pMode = targetBatch?.items?.[0]?.paymentMode || targetBatch?.paymentMode;
                                                            const modeStr = pMode ? ` (${pMode})` : '';

                                                            if (!showNumeric) return `Dispatch${modeStr}`;
                                                            const idx = agentCollections.findIndex(a => a._id === adj._id);
                                                            return `Dispatch ${idx + 1}${modeStr}`;
                                                        })();

                                                        return (
                                                            <span 
                                                                onClick={() => {
                                                                    const allBatches = groupDeliveriesByBatch(order.deliveries || []);
                                                                    const batchTimestamp = adj.batchId || (adj.description?.match(/\[BatchID:\s*(\d+)\]/)?.[1]);
                                                                    const targetBatch = allBatches.find(b => b.key === batchTimestamp);
                                                                    if (targetBatch) {
                                                                        const history = groupHistoryByDispatch(deliveryHistory);
                                                                        const section = history.find(h => h.dispatchId === targetBatch.dispatchId) || { info: order.deliveryAgent };
                                                                        openBatchPopup(targetBatch, section);
                                                                    } else {
                                                                        alert("Could not find dispatch details for this adjustment.");
                                                                    }
                                                                }}
                                                                style={{ 
                                                                    color: '#0d6efd', 
                                                                    cursor: 'pointer', 
                                                                    textDecoration: 'underline',
                                                                    textDecorationStyle: 'dotted'
                                                                }}
                                                                title="Click to edit this dispatch collection"
                                                            >
                                                                {label}
                                                            </span>
                                                        );
                                                    })()}
                                                    </div>
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
                                                    {!adj.isLocked && !isAgentCollection && (
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



                            <li className={styles.orderTotal}>
                                <div></div>
                                <div><strong>{isBalanceTab ? <>Remaining Amount to Collect ({Rupee()}):</> : <>Balance Amount ({Rupee()}):</>}</strong></div>
                                <div><strong style={{ color: isBalanceTab ? '#dc3545' : '#007bff' }}>{formatPrice(finalTotal)}</strong></div>
                            </li>
                        </ul>

                        {/* Custom Product Section - moved above adjustment buttons */}
                        {!isBalanceTab && (
                            <div style={{
                                width: '100%',
                                marginTop: '10px',
                                border: '1.5px dashed #11998e',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                backgroundColor: showCustomProductForm ? '#f0fdf9' : 'transparent',
                                marginBottom: '10px'
                            }}>
                                <button
                                    onClick={() => {
                                        setShowCustomProductForm(prev => !prev);
                                        if (showCustomProductForm) {
                                            setCustomProductForm({ name: '', quantity: '', price: '', unit: '' });
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        background: showCustomProductForm
                                            ? 'linear-gradient(135deg, #11998e, #0d8a80)'
                                            : 'transparent',
                                        border: 'none',
                                        color: showCustomProductForm ? '#fff' : '#11998e',
                                        padding: '8px 14px',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                        letterSpacing: '0.3px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span>✦ Add Custom Product</span>
                                    <span style={{ fontSize: '18px', lineHeight: 1, fontWeight: '400' }}>
                                        {showCustomProductForm ? '×' : '+'}
                                    </span>
                                </button>

                                {showCustomProductForm && (
                                    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#064e3b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product Name *</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Custom Steel Rods"
                                                    value={customProductForm.name}
                                                    onChange={e => setCustomProductForm(prev => ({ ...prev, name: e.target.value }))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        border: '1.5px solid #a7f3d0',
                                                        borderRadius: '7px',
                                                        fontSize: '13px',
                                                        outline: 'none',
                                                        background: 'rgba(255,255,255,0.9)',
                                                        color: '#1e293b',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#064e3b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quantity</label>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min="0"
                                                    step="any"
                                                    value={customProductForm.quantity}
                                                    onChange={e => setCustomProductForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        border: '1.5px solid #a7f3d0',
                                                        borderRadius: '7px',
                                                        fontSize: '13px',
                                                        outline: 'none',
                                                        background: 'rgba(255,255,255,0.9)',
                                                        color: '#1e293b',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#064e3b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price (₹)</label>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    min="0"
                                                    step="any"
                                                    value={customProductForm.price}
                                                    onChange={e => setCustomProductForm(prev => ({ ...prev, price: e.target.value }))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        border: '1.5px solid #a7f3d0',
                                                        borderRadius: '7px',
                                                        fontSize: '13px',
                                                        outline: 'none',
                                                        background: 'rgba(255,255,255,0.9)',
                                                        color: '#1e293b',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#064e3b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit (optional)</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. kg, pcs, m"
                                                    value={customProductForm.unit}
                                                    onChange={e => setCustomProductForm(prev => ({ ...prev, unit: e.target.value }))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        border: '1.5px solid #a7f3d0',
                                                        borderRadius: '7px',
                                                        fontSize: '13px',
                                                        outline: 'none',
                                                        background: 'rgba(255,255,255,0.9)',
                                                        color: '#1e293b',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Live preview of total - show if price is present even if quantity is missing */}
                                        {customProductForm.price && (
                                            <div style={{
                                                padding: '8px 12px',
                                                background: 'rgba(17,153,142,0.08)',
                                                borderRadius: '7px',
                                                fontSize: '13px',
                                                color: '#064e3b',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span>Item Total:</span>
                                        <strong>₹{(() => {
                                            const q = parseFloat(customProductForm.quantity);
                                            const p = parseFloat(customProductForm.price || 0);
                                            if (isNaN(q) || q === 0) return p.toFixed(2);
                                            return (q * p).toFixed(2);
                                        })()}</strong>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleAddCustomProduct}
                                            disabled={isAddingCustomProduct}
                                            style={{
                                                background: 'linear-gradient(135deg, #11998e, #0d8a80)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                fontWeight: '700',
                                                fontSize: '14px',
                                                cursor: isAddingCustomProduct ? 'not-allowed' : 'pointer',
                                                opacity: isAddingCustomProduct ? 0.7 : 1,
                                                width: '100%',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 2px 8px rgba(17,153,142,0.3)'
                                            }}
                                        >
                                            {isAddingCustomProduct ? 'Adding...' : '✓ Add to Order'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Adjustment Buttons */}
                        {(order.status !== 'Cancelled' && !isBalanceTab) && (
                            <div className={styles.adjustmentButtons}>
                                {(isAdmin ? appController.isChargesEnabledAdmin : appController.isChargesEnabledStaff) && (
                                    <button onClick={() => handleAddAdjustment('charge')} className={styles.btnAddCharge}>
                                        + Charge
                                    </button>
                                )}
                                <button onClick={() => handleAddAdjustment('discount')} className={styles.btnAddDiscount}>
                                    + Discount
                                </button>
                                <button 
                                    onClick={() => handleAddAdjustment('advance')} 
                                    className={styles.btnAddAdvance}
                                >
                                    Advance
                                </button>
                            </div>
                        )}

                        {(order.status === 'Paused' || order.status === 'Hold') && order.pauseReason && (
                            <div className={styles.reasonBox}>
                                <strong>Reason:</strong> {order.pauseReason}
                            </div>
                        )}

                        {/* Delivery Agent Sections */}
                        {(order.status === 'Dispatch' || order.status === 'Partially Delivered' || order.status === 'Delivered' || order.status === 'Completed') && (
                            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {(() => {
                                    const dispatchHistory = groupHistoryByDispatch(deliveryHistory);
                                    const currentDispatchId = order.deliveryAgent?.dispatchId;
                                    
                                    // Separate current dispatch from history to ensure it's always at the bottom
                                    const previousDispatches = dispatchHistory.filter(dh => 
                                        dh.dispatchId !== currentDispatchId
                                    ).sort((a, b) => a.earliestDate - b.earliestDate);

                                    const currentDispatchInHistory = dispatchHistory.find(dh => 
                                        dh.dispatchId === currentDispatchId
                                    );

                                    const allSections = [...previousDispatches];
                                    if (currentDispatchInHistory) {
                                        allSections.push(currentDispatchInHistory);
                                    } else if (order.deliveryAgent && order.deliveryAgent.name) {
                                        // Still add current agent section if they haven't made any deliveries
                                        allSections.push({
                                            info: order.deliveryAgent,
                                            batches: [],
                                            isActive: true,
                                            dispatchId: currentDispatchId
                                        });
                                    }

                                    if (allSections.length === 0) return null;

                                    return allSections.map((agentSection, idx) => (
                                        <div key={agentSection.dispatchId || idx} style={{
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
                                                    {agentSection.dispatchId === currentDispatchId && (
                                                        <span style={{ fontSize: '10px', backgroundColor: '#e7f3ff', color: '#0d6efd', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>Current</span>
                                                    )}
                                                </h4>
                                                {order.status !== 'Delivered' && (
                                                    <button 
                                                        onClick={() => handleAgainDelivery(agentSection)}
                                                        title={isDispatchTab && allItemsDelivered ? "All items delivered" : "Again Delivery"}
                                                        disabled={isDispatchTab && allItemsDelivered}
                                                        style={{ 
                                                            background: isDispatchTab && allItemsDelivered ? '#f8f9fa' : '#e7f3ff', 
                                                            color: isDispatchTab && allItemsDelivered ? '#adb5bd' : '#0d6efd', 
                                                            border: '1px solid ' + (isDispatchTab && allItemsDelivered ? '#dee2e6' : '#cfe2ff'), 
                                                            borderRadius: '6px', 
                                                            cursor: isDispatchTab && allItemsDelivered ? 'default' : 'pointer', 
                                                            fontSize: '13px', 
                                                            padding: '6px 14px', 
                                                            fontWeight: 'bold', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '6px',
                                                            opacity: isDispatchTab && allItemsDelivered ? 0.7 : 1
                                                        }}
                                                    >🚚 Again Delivery</button>
                                                )}
                                            </div>



                                            {(() => {
                                                // Prepare batches to show, including a potential pending one
                                                let batchesToShow = [...agentSection.batches];
                                                const isCurrentDispatch = agentSection.dispatchId === currentDispatchId;
                                                const activeDispatchId = order.deliveryAgent?.dispatchId;
                                                
                                                // Check if the current dispatch ID already has recorded deliveries
                                                const hasActiveDeliveryForThisId = agentSection.batches.some(b => b.dispatchId === activeDispatchId);
                                                
                                                // If this is the current dispatch session and it hasn't finished, show pending row
                                                if (isCurrentDispatch && !allItemsDelivered && activeDispatchId && !hasActiveDeliveryForThisId) {
                                                    batchesToShow.push({
                                                        dispatchId: currentDispatchId,
                                                        date: null, // Indicates pending
                                                        isPending: true,
                                                        key: `pending-${currentDispatchId}-${order._id}`,
                                                        isConfirmed: false
                                                    });
                                                }

                                                if (batchesToShow.length === 0) {
                                                    return (
                                                        <div style={{ textAlign: 'center', padding: '15px', color: '#868e96', fontSize: '12px', border: '1px dashed #dee2e6', borderRadius: '8px', backgroundColor: '#fff' }}>
                                                            No dispatches recorded for this agent yet.
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div style={{ 
                                                        border: '1px solid #e9ecef', 
                                                        borderRadius: '12px', 
                                                        overflow: 'hidden', 
                                                        backgroundColor: '#fff',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                                        marginBottom: '10px'
                                                    }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                            <thead>
                                                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
                                                                    <th style={{ padding: '12px 15px', textAlign: 'left', fontWeight: '700', fontSize: '11px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dispatch Info</th>
                                                                    <th style={{ padding: '12px 15px', textAlign: 'center', fontWeight: '700', fontSize: '11px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Mode</th>
                                                                    <th style={{ padding: '12px 15px', textAlign: 'center', fontWeight: '700', fontSize: '11px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection Time</th>
                                                                    <th style={{ padding: '12px 15px', textAlign: 'center', fontWeight: '700', fontSize: '11px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {batchesToShow.map((batch, bIndex) => (
                                                                    <React.Fragment key={batch.key}>
                                                                        <tr style={{ 
                                                                            borderBottom: bIndex === batchesToShow.length - 1 ? 'none' : '1px solid #f1f3f5', 
                                                                            backgroundColor: batch.isPending ? 'rgba(255, 249, 219, 0.5)' : (bIndex % 2 === 0 ? '#fff' : '#fafbfc'),
                                                                            transition: 'all 0.2s ease',
                                                                            cursor: 'default'
                                                                        }}>
                                                                            <td style={{ padding: '12px 15px' }}>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        <span 
                                                                                            onClick={() => {
                                                                                                openBatchPopup(batch, agentSection);
                                                                                            }}
                                                                                            style={{ 
                                                                                                color: '#007bff', 
                                                                                                cursor: 'pointer', 
                                                                                                textDecoration: 'none',
                                                                                                fontWeight: '700',
                                                                                                backgroundColor: '#e7f3ff',
                                                                                                padding: '4px 10px',
                                                                                                borderRadius: '6px',
                                                                                                fontSize: '11px',
                                                                                                display: 'inline-flex',
                                                                                                alignItems: 'center',
                                                                                                border: '1px solid #cce5ff'
                                                                                            }}
                                                                                            title="Click to view details"
                                                                                        >
                                                                                            #{batch.dispatchId}{!batch.isPending && batch.receivedAmount > 0 && ` (${batch.items[0]?.paymentMode || 'Cash'})`}
                                                                                        </span>
                                                                                        {batch.isPending && (
                                                                                            <span style={{ fontSize: '9px', backgroundColor: '#fff3bf', color: '#947600', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>PENDING</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div style={{ fontSize: '11px', color: '#868e96', fontWeight: 'bold' }}>
                                                                                        {!batch.isPending && (
                                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                {new Date(batch.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                                                                                {batch.isPending ? '-' : (
                                                                                    batch.receivedAmount > 0 ? (
                                                                                        <span style={{ 
                                                                                            backgroundColor: batch.items[0]?.paymentMode === 'Cash' ? '#e6fffa' : '#ebf8ff',
                                                                                            color: batch.items[0]?.paymentMode === 'Cash' ? '#00a3c4' : '#3182ce',
                                                                                            padding: '4px 12px',
                                                                                            borderRadius: '20px',
                                                                                            fontSize: '11px',
                                                                                            fontWeight: '700',
                                                                                            textTransform: 'uppercase',
                                                                                            letterSpacing: '0.02em',
                                                                                            border: `1px solid ${batch.items[0]?.paymentMode === 'Cash' ? '#b2f5ea' : '#bee3f8'}`
                                                                                        }}>
                                                                                            {batch.items[0]?.paymentMode || 'Cash'}
                                                                                        </span>
                                                                                    ) : <span style={{ color: '#adb5bd', fontSize: '11px', fontStyle: 'italic' }}>Pending</span>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                                                                                {batch.isPending || batch.receivedAmount <= 0 ? '-' : (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                        <div style={{ fontWeight: '600', color: '#495057' }}>
                                                                                            {new Date(batch.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                                        </div>
                                                                                        <div style={{ fontSize: '11px', color: '#868e96' }}>
                                                                                            {batch.latestUpdate ? new Date(batch.latestUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 
                                                                                            (batch.receivedAmount > 0 ? new Date(batch.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-')}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                                                                                {batch.isPending ? '-' : (
                                                                                    batch.receivedAmount > 0 ? (
                                                                                        <div style={{ 
                                                                                            backgroundColor: '#eef2ff', 
                                                                                            padding: '6px 12px', 
                                                                                            borderRadius: '10px',
                                                                                            display: 'inline-block',
                                                                                            border: '1px solid #e0e7ff'
                                                                                        }}>
                                                                                            <span style={{ color: '#4f46e5', fontSize: '15px' }}><Rupee /><span style={{ fontWeight: '800' }}>{batch.receivedAmount.toLocaleString()}</span></span>
                                                                                        </div>
                                                                                    ) : <span style={{ color: '#adb5bd', fontSize: '11px' }}>—</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    </React.Fragment>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}

                        <div className={styles.orderActions}>
                            {renderActionButtons()}


                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
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
                                }} className={styles.btnConfirm} style={{ backgroundColor: '#28a745', width: 'auto', padding: '10px 20px' }} disabled={isPayLoading}>
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
                                }} className={styles.btnConfirm} style={{ backgroundColor: '#0d6efd', width: 'auto', padding: '10px 20px' }} disabled={isPayLoading}>
                                    {isPayLoading ? 'Loading Settings...' : 'Print PDF (with Header)'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Payment Selection Modal */}
            {showPaymentModal && (
                <div className={styles.modal} onClick={() => setShowPaymentModal(false)}>
                    <div className={styles.modalContent} style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
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
                <div className={styles.modal} onClick={closeReasonModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
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
                <div className={styles.modal} onClick={() => setShowAdjustmentModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
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
                <div className={styles.modal} onClick={() => setShowAgentModal(false)}>
                    <div className={styles.modalContent} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
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
                            <label>Dispatch Date &amp; Time *</label>
                            <input
                                type="datetime-local"
                                value={agentForm.dispatchDate || ''}
                                onChange={(e) => setAgentForm({ ...agentForm, dispatchDate: e.target.value })}
                                className={styles.modalInput}
                            />
                        </div>
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
                <div className={styles.modal} onClick={() => setShowEditAgentModal(false)}>
                    <div className={styles.modalContent} style={{ position: 'relative', maxWidth: '1000px', width: '95%' }} onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setShowEditAgentModal(false)} 
                            className={styles.btnCloseModal}
                            style={{ 
                                position: 'absolute', 
                                top: '15px', 
                                right: '15px', 
                                background: 'transparent', 
                                border: 'none', 
                                fontSize: '20px', 
                                cursor: 'pointer',
                                color: '#666',
                                zIndex: 10
                            }}
                        >
                            ✕
                        </button>
                        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Edit Dispatch Agent</h3>

                        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
                            {/* Left Side: Agent Details */}
                            <div style={{ flex: '1' }}>

                        <div className={styles.formGroup}>
                            <label>Dispatch Date &amp; Time *</label>
                            <input
                                type="datetime-local"
                                value={editAgentModalData.form.dispatchDate || ''}
                                onChange={(e) => setEditAgentModalData({ 
                                    ...editAgentModalData, 
                                    form: { ...editAgentModalData.form, dispatchDate: e.target.value } 
                                })}
                                className={styles.modalInput}
                            />
                        </div>
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
                                rows="2"
                                className={styles.modalTextarea}
                            />
                        </div>

                        </div> {/* Close Left Column */}

                        {/* Right Side: Products Status & Dispatch */}
                        <div style={{ flex: '1.2' }}>
                            {/* Comprehensive Editable Products Section */}
                        {editAgentModalData.form.items && editAgentModalData.form.items.length > 0 && (
                            <div className={styles.formGroup} style={{ marginTop: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#0d6efd', fontSize: '14px' }}>📦 Products Status & Dispatch</label>
                                <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                                            <tr style={{ borderBottom: '2px solid #eee' }}>
                                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Product</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Total</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Remaining</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Dispatch</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {editAgentModalData.form.items.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '8px 10px', fontWeight: '500' }}>{item.name}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#666' }}>{item.totalOrdered}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: (item.totalRemaining - (item.quantity || 0)) > 0 ? '#d63384' : '#6c757d' }}>{item.totalRemaining - (item.quantity || 0)}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                            <input 
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => {
                                                                    const newVal = parseFloat(e.target.value) || 0;
                                                                    const newItems = [...editAgentModalData.form.items];
                                                                    newItems[idx] = { ...newItems[idx], quantity: Math.min(Math.max(0, newVal), item.totalRemaining) };
                                                                    setEditAgentModalData({
                                                                        ...editAgentModalData,
                                                                        form: { ...editAgentModalData.form, items: newItems }
                                                                    });
                                                                }}
                                                                style={{ width: '55px', padding: '4px', border: '1px solid #ced4da', borderRadius: '4px', textAlign: 'right' }}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                            </div>
                        </div>

                        <div className={styles.modalActions} style={{ marginTop: '25px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                            <button onClick={submitEditAgent} className={styles.btnConfirm}>Update Details</button>
                            <button onClick={() => setShowEditAgentModal(false)} className={styles.btnCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Start Delivery Modal */}
            {showDeliveryModal && (
                <div className={styles.modal} onClick={() => { setShowDeliveryModal(false); setDeliveryRent(''); }}>
                    <div className={styles.modalContent} style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
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
                                            {Math.max(0, item.remainingQty - (item.toDeliver || 0)).toFixed(2)} {item.unit}
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
                            <label style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', color: '#495057' }}>Rent / Agent Charge ({Rupee()})</label>
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
                        <div style={{ marginTop: '12px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <label style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', color: '#495057' }}>📅 Dispatch Date &amp; Time</label>
                            <input
                                type="datetime-local"
                                value={deliveryDateTime}
                                onChange={(e) => setDeliveryDateTime(e.target.value)}
                                style={{ flex: 1, minWidth: '180px', padding: '6px 10px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
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
                <div className={styles.modal} onClick={handleCancelEdit}>
                    <div className={styles.modalContent} style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
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
                                                value={item.isCustom && (item.quantity === 1 || item.quantity === '') ? '' : item.quantity}
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
                                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Grand Total ({Rupee()}):</span>
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
                    <div className={styles.modal} onClick={() => setShowUserEditModal(false)}>
                        <div className={styles.modalContent} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
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
                title="Authorize Delete"
                message={`Please enter the unique ADMIN_ACTION_PASSWORD to delete order ${order.customOrderId}.`}
                onConfirm={confirmDeleteOrder}
                onCancel={() => setShowDeleteAuthModal(false)}
            />
            <AdminPasswordModal
                show={showCollectionEditAuthModal}
                title="Authorize Collection Edit"
                message="Please enter the unique ADMIN_ACTION_PASSWORD to edit the collection amount."
                onConfirm={() => {
                    setShowCollectionEditAuthModal(false);
                    setIsEditingCollection(true);
                }}
                onCancel={() => setShowCollectionEditAuthModal(false)}
            />
            <AdminPasswordModal
                show={showEditAuthModal}
                title="Authorize Order Edit"
                message={`Order ${order.customOrderId} is in a completed or final state. Please enter the unique ADMIN_ACTION_PASSWORD to proceed.`}
                onConfirm={() => {
                    setShowEditAuthModal(false);
                    openEditOrderProcess();
                }}
                onCancel={() => setShowEditAuthModal(false)}
            />

            {/* Edit Custom Product Modal */}
            {showEditCustomProductModal && editingCustomProduct && (
                <div className={styles.modal} onClick={() => setShowEditCustomProductModal(false)}>
                    <div className={styles.modalContent} style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Custom Product</h3>
                        <div className={styles.formGroup}>
                            <label>Product Name</label>
                            <input
                                type="text"
                                value={editingCustomProduct.name}
                                onChange={(e) => setEditingCustomProduct({ ...editingCustomProduct, name: e.target.value })}
                                placeholder="Enter product name"
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Quantity</label>
                                <input
                                    type="number"
                                    value={editingCustomProduct.quantity}
                                    onChange={(e) => setEditingCustomProduct({ ...editingCustomProduct, quantity: e.target.value })}
                                    placeholder="0"
                                    className={styles.modalInput}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Price (₹)</label>
                                <input
                                    type="number"
                                    value={editingCustomProduct.price}
                                    onChange={(e) => setEditingCustomProduct({ ...editingCustomProduct, price: e.target.value })}
                                    placeholder="0"
                                    className={styles.modalInput}
                                />
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Unit (Optional)</label>
                            <input
                                type="text"
                                value={editingCustomProduct.unit}
                                onChange={(e) => setEditingCustomProduct({ ...editingCustomProduct, unit: e.target.value })}
                                placeholder="e.g. Kg, Box, Pcs"
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Description (Optional)</label>
                            <input
                                type="text"
                                value={editingCustomProduct.description}
                                onChange={(e) => setEditingCustomProduct({ ...editingCustomProduct, description: e.target.value })}
                                placeholder="Small notes..."
                                className={styles.modalInput}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                onClick={handleSubmitCustomItemUpdate}
                                className={styles.btnConfirm}
                                disabled={isUpdatingCustomProduct}
                            >
                                {isUpdatingCustomProduct ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                onClick={() => setShowEditCustomProductModal(false)}
                                className={styles.btnCancel}
                                disabled={isUpdatingCustomProduct}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showItemsPopup && selectedBatchForItems && (
                <div className={styles.modal} style={{ zIndex: 10002 }} onClick={() => { setShowItemsPopup(false); setSelectedBatchForItems(null); }}>
                    <div className={styles.modalContent} style={{ maxWidth: '800px', position: 'relative', padding: '25px' }} onClick={e => e.stopPropagation()}>
                        {/* Top Right Action Buttons */}
                        <div style={{ position: 'absolute', top: '20px', right: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedBatchForItems.agentSection && (
                                <>
                                    <button 
                                        onClick={() => { setShowItemsPopup(false); handleEditAgentSection(selectedBatchForItems.agentSection, selectedBatchForItems); }}
                                        title="Edit Agent/Products"
                                        style={{ background: '#e7f3ff', color: '#0d6efd', border: '1px solid #cfe2ff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', padding: '5px 12px', fontWeight: 'bold' }}
                                    >✏️ Edit</button>
                                    <button 
                                        onClick={() => { setShowItemsPopup(false); handleDeleteAgentSection(selectedBatchForItems.dispatchId); }}
                                        title="Delete Dispatch"
                                        style={{ background: '#fff0f0', color: '#dc3545', border: '1px solid #ffc9c9', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', padding: '5px 12px', fontWeight: 'bold' }}
                                    >🗑️ Delete</button>
                                </>
                            )}
                            <button 
                                onClick={() => { setShowItemsPopup(false); setSelectedBatchForItems(null); }}
                                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#adb5bd', padding: '0 5px 0 10px', display: 'flex', alignItems: 'center' }}
                            >✕</button>
                        </div>
                        
                        <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px', paddingRight: '220px' }}>
                            <h3 style={{ margin: 0, color: '#212529' }}>Dispatch Details</h3>
                            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>ID: <span style={{ fontWeight: 'bold' }}>{selectedBatchForItems.dispatchId}</span> | Date: <span style={{ fontWeight: 'bold' }}>{new Date(selectedBatchForItems.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                        </div>

                         <div style={{ paddingBottom: '20px' }}>
                            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', marginBottom: '20px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8f9fa' }}>
                                        <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Product</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>Rate</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>Total</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>Remaining</th>
                                            <th style={{ padding: '10px', textAlign: 'right' }}>{selectedBatchForItems.isPending ? 'Dispatch Now' : 'Dispatched'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedBatchForItems.items.map((item, idx) => {
                                            const itemUniqueId = item._id; // Always use item._id for unique mapping
                                            return (
                                                <tr key={idx} style={{ 
                                                    borderBottom: '1px solid #f1f3f5',
                                                    opacity: (item.quantity === 0 && (selectedBatchForItems.isPending ? item.totalRemaining === 0 : true)) ? 0.6 : 1,
                                                    backgroundColor: (item.quantity > 0) ? '#D6F1FF' : (idx % 2 === 0 ? '#E7FFEC' : 'transparent')
                                                }}>
                                                    <td style={{ padding: '10px', fontWeight: '500' }}>{item.name}</td>
                                                    <td style={{ padding: '10px', textAlign: 'center', color: '#666' }}><Rupee />{(item.price || 0).toLocaleString()}</td>
                                                    <td style={{ padding: '10px', textAlign: 'center', color: '#6c757d' }}>{item.totalOrdered}</td>
                                                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: (selectedBatchForItems.isPending ? (item.totalRemaining - (popupDeliveryQuantities[itemUniqueId] || 0)) : item.totalRemaining) > 0 ? '#d63384' : '#6c757d' }}>
                                                        {selectedBatchForItems.isPending ? (item.totalRemaining - (popupDeliveryQuantities[itemUniqueId] || 0)) : item.totalRemaining}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                                        {selectedBatchForItems.isPending ? (
                                                            (item.isCustom && item.isQtyNotSpecified) ? (
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={!!popupDeliveryQuantities[itemUniqueId]}
                                                                    onChange={(e) => {
                                                                        setPopupDeliveryQuantities(prev => ({
                                                                            ...prev,
                                                                            [itemUniqueId]: e.target.checked ? 1 : 0
                                                                        }));
                                                                    }}
                                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                                />
                                                            ) : (
                                                                <input 
                                                                    type="number"
                                                                    value={popupDeliveryQuantities[itemUniqueId] || ''}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        const max = item.totalRemaining; 
                                                                        setPopupDeliveryQuantities(prev => ({
                                                                            ...prev,
                                                                            [itemUniqueId]: Math.min(Math.max(0, val), max)
                                                                        }));
                                                                    }}
                                                                    placeholder="0"
                                                                    style={{ width: '60px', padding: '5px', border: '1px solid #ced4da', borderRadius: '4px', textAlign: 'right' }}
                                                                />
                                                            )
                                                        ) : (
                                                            <span style={{ fontWeight: 'bold', color: item.quantity > 0 ? '#0d6efd' : '#adb5bd' }}>
                                                                {item.quantity} {item.unit}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {(() => {
                                let itemsTotal = 0;
                                selectedBatchForItems.items.forEach(item => {
                                    const key = item._id;
                                    const qty = selectedBatchForItems.isPending ? (popupDeliveryQuantities[key] || 0) : (item.quantity || 0);
                                    itemsTotal += qty * (item.price || 0);
                                });

                                return (
                                    <div style={{ 
                                        backgroundColor: '#f8f9fa', 
                                        borderRadius: '10px 10px 0 0', 
                                        padding: '15px', 
                                        border: '1px solid #e9ecef',
                                        borderBottom: 'none'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{ color: '#495057', fontWeight: '500' }}>Items Total:</span>
                                            <span style={{ fontWeight: 'bold', color: '#0d6efd', fontSize: '18px' }}><Rupee />{itemsTotal.toLocaleString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#495057', fontWeight: '500' }}>Delivery Rent:</span>
                                            {selectedBatchForItems.isPending || isEditingRent ? (
                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                    <input 
                                                        type="number" 
                                                        value={popupDeliveryRent}
                                                        onChange={(e) => setPopupDeliveryRent(e.target.value)}
                                                        placeholder="Enter rent"
                                                        style={{ width: '100px', padding: '6px', border: '1px solid #ced4da', borderRadius: '4px', textAlign: 'right', fontWeight: 'bold' }}
                                                    />
                                                    {!selectedBatchForItems.isPending && (
                                                        <button 
                                                            onClick={async () => {
                                                                setIsSavingRent(true);
                                                                try {
                                                                    await api.updateAgentCharge(order._id, selectedBatchForItems.date, popupDeliveryRent);
                                                                    alert('Rent updated successfully');
                                                                    if (onRefresh) await onRefresh();
                                                                    setIsEditingRent(false);
                                                                } catch (err) {
                                                                    alert(`Error updating rent: ${err.message}`);
                                                                } finally {
                                                                    setIsSavingRent(false);
                                                                }
                                                            }}
                                                            disabled={isSavingRent}
                                                            style={{ padding: '6px 10px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                        >
                                                            {isSavingRent ? 'Saving...' : 'Save'}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 'bold', color: '#212529' }}><Rupee />{(selectedBatchForItems.agentCharge || 0).toLocaleString()}</span>
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={() => {
                                                                setPopupDeliveryRent(selectedBatchForItems.agentCharge || '');
                                                                setIsEditingRent(true);
                                                            }}
                                                            style={{ backgroundColor: 'transparent', color: '#0d6efd', border: '1px solid #0d6efd', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                                                        >
                                                            ✏️ Edit
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {selectedBatchForItems.isPending && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                                <span style={{ color: '#495057', fontWeight: '500' }}>📅 Dispatch Date &amp; Time:</span>
                                                <input
                                                    type="datetime-local"
                                                    value={popupDeliveryDateTime}
                                                    onChange={e => setPopupDeliveryDateTime(e.target.value)}
                                                    style={{ padding: '5px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Collection amount Feature (REFINED) */}
                            {!selectedBatchForItems.isPending && (
                                <div style={{ 
                                    border: '1px solid #d0ebff', 
                                    borderRadius: '12px', 
                                    padding: '15px', 
                                    backgroundColor: '#f1faff', 
                                    marginTop: '15px',
                                    marginBottom: '15px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h4 style={{ margin: 0, color: '#0d6efd', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                                            💰 Collection amount
                                        </h4>
                                        {(!isEditingCollection && selectedBatchForItems.isConfirmed && isAdmin) && (
                                            <button 
                                                onClick={() => setShowCollectionEditAuthModal(true)}
                                                style={{
                                                    backgroundColor: 'transparent',
                                                    color: '#0d6efd',
                                                    border: '1px solid #0d6efd',
                                                    borderRadius: '4px',
                                                    padding: '2px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ✏️ Edit
                                            </button>
                                        )}
                                    </div>

                                    {(!isEditingCollection && selectedBatchForItems.isConfirmed) ? (
                                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: '600' }}>AMOUNT</span>
                                                <span style={{ fontSize: '18px', fontWeight: '800', color: '#212529' }}><Rupee />{(selectedBatchForItems.receivedAmount || 0).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: '600' }}>PAYMENT METHOD</span>
                                                <span style={{ 
                                                    backgroundColor: selectedBatchForItems.paymentMode === 'Cash' ? '#e6fffa' : '#ebf8ff',
                                                    color: selectedBatchForItems.paymentMode === 'Cash' ? '#116e11' : '#0056b3',
                                                    padding: '2px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    border: `1px solid ${selectedBatchForItems.paymentMode === 'Cash' ? '#b7e4c7' : '#b2d4ff'}`
                                                }}>
                                                    {selectedBatchForItems.paymentMode || 'Cash'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '12px', alignItems: 'flex-end' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '10px', color: '#495057', fontWeight: '700', textTransform: 'uppercase' }}>Amount</label>
                                                <div style={{ position: 'relative' }}>
                                                    <span className={styles.rupee} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: '14px' }}>₹</span>
                                                    <input 
                                                        type="number"
                                                        value={popupCollectionAmount}
                                                        onChange={(e) => setPopupCollectionAmount(e.target.value)}
                                                        placeholder="0"
                                                        style={{ width: '100%', padding: '8px 8px 8px 25px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '10px', color: '#495057', fontWeight: '700', textTransform: 'uppercase' }}>Payment method</label>
                                                <select 
                                                    value={popupCollectionMode}
                                                    onChange={(e) => setPopupCollectionMode(e.target.value)}
                                                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', backgroundColor: '#fff', fontWeight: '500' }}
                                                >
                                                    <option value="None">None</option>
                                                    <option value="Cash">Cash</option>
                                                    <option value="GPay">GPay</option>
                                                    <option value="PhonePe">PhonePe</option>
                                                    <option value="Paytm">Paytm</option>
                                                    <option value="Bank Transfer">Bank Transfer</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    if (popupCollectionAmount === '' || isNaN(parseFloat(popupCollectionAmount))) {
                                                        alert('Please enter a valid amount');
                                                        return;
                                                    }
                                                    setIsSavingCollection(true);
                                                    console.log("[DEBUG] Saving Collection for batch:", {
                                                        date: selectedBatchForItems.date,
                                                        dispatchId: selectedBatchForItems.dispatchId,
                                                        isPending: selectedBatchForItems.isPending
                                                    });
                                                    try {
                                                        await api.confirmDeliveryBatch(
                                                            order._id,
                                                            selectedBatchForItems.date,
                                                            parseFloat(popupCollectionAmount),
                                                            parseFloat(popupCollectionAmount) === 0,
                                                            popupCollectionMode
                                                        );
                                                        alert('Collection saved successfully!');
                                                        if (onRefresh) await onRefresh();
                                                        setShowItemsPopup(false);
                                                        setIsEditingCollection(false);
                                                    } catch (err) {
                                                        alert(`Error: ${err.message}`);
                                                    } finally {
                                                        setIsSavingCollection(false);
                                                    }
                                                }}
                                                disabled={isSavingCollection}
                                                style={{ 
                                                    backgroundColor: '#0d6efd', 
                                                    color: '#fff', 
                                                    border: 'none', 
                                                    borderRadius: '6px', 
                                                    padding: '9px 15px', 
                                                    fontSize: '13px', 
                                                    fontWeight: 'bold', 
                                                    cursor: 'pointer',
                                                    opacity: isSavingCollection ? 0.7 : 1,
                                                    minHeight: '38px',
                                                    boxShadow: '0 2px 4px rgba(13, 110, 253, 0.2)'
                                                }}
                                            >
                                                {isSavingCollection ? 'Saving...' : 'Save Collection'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Agent Information (BOTTOM SECTION BELOW TOTAL) */}
                            {selectedBatchForItems.agentSection?.info && (
                                <div style={{ border: '1px solid #e9ecef', borderRadius: '0 0 10px 10px', padding: '15px', backgroundColor: '#fff', borderTop: '1px dashed #dee2e6' }}>
                                    <h4 style={{ margin: '0 0 15px 0', color: '#6c757d', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>🚚 Delivery Agent</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span style={{ fontSize: '10px', color: '#adb5bd', fontWeight: '700' }}>AGENT NAME</span>
                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#212529' }}>{selectedBatchForItems.agentSection.info.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span style={{ fontSize: '10px', color: '#adb5bd', fontWeight: '700' }}>MOBILE NUMBER</span>
                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#212529' }}>{selectedBatchForItems.agentSection.info.mobile || 'N/A'}</span>
                                        </div>
                                        {selectedBatchForItems.agentSection.info.description && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ fontSize: '10px', color: '#adb5bd', fontWeight: '700' }}>VEHICLE / ETA</span>
                                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#212529' }}>{selectedBatchForItems.agentSection.info.description}</span>
                                            </div>
                                        )}
                                        {selectedBatchForItems.agentSection.info.address && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', gridColumn: '1 / -1' }}>
                                                <span style={{ fontSize: '10px', color: '#adb5bd', fontWeight: '700' }}>DELIVERY ADDRESS</span>
                                                <span style={{ fontSize: '13px', fontWeight: '500', color: '#495057', lineHeight: '1.4' }}>{selectedBatchForItems.agentSection.info.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            {selectedBatchForItems.isPending ? (
                                <>
                                    <button 
                                        onClick={async () => {
                                            const deliveries = Object.entries(popupDeliveryQuantities)
                                                .filter(([_, qty]) => qty > 0)
                                                .map(([id, qty]) => ({ productId: id, quantity: qty }));
                                            
                                            if (deliveries.length === 0) {
                                                alert('Please enter quantities to deliver');
                                                return;
                                            }
                                            if (!window.confirm('Start delivery with selected items?')) return;
                                            
                                            try {
                                                await api.recordDelivery(order._id, deliveries, popupDeliveryRent, popupDeliveryDateTime);
                                                setShowItemsPopup(false);
                                                setSelectedBatchForItems(null);
                                                if (onRefresh) await onRefresh();
                                            } catch (err) { alert(`Error: ${err.message}`); }
                                        }} 
                                        className={styles.btnConfirm}
                                        style={{ flex: 2, padding: '12px', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#28a745', border: 'none' }}
                                    >🚀 Start Delivery Now</button>
                                    <button 
                                        onClick={() => { setShowItemsPopup(false); setSelectedBatchForItems(null); }} 
                                        className={styles.btnCancel}
                                        style={{ flex: 1, padding: '12px' }}
                                    >Cancel</button>
                                </>
                            ) : (
                                <button 
                                    onClick={() => { setShowItemsPopup(false); setSelectedBatchForItems(null); }} 
                                    className={styles.btnConfirm}
                                    style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                                >Close</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
