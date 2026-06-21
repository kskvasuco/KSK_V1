import React, { useState, useEffect, useRef } from 'react';
import { logoBase64 } from './logoBase64';
import { useParams, useNavigate } from 'react-router-dom';
import { io as socketIO } from 'socket.io-client';
import adminApi from './adminApi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Date / Currency Helpers ───────────────────────────────────────────────
function isSameDay(d1, d2) {
    if (!d1 || !d2) return false;
    const a = new Date(d1), b = new Date(d2);
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
}

function formatDateOnly(dateVal) {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function formatNextDateOnly(dateVal) {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + 1);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function formatDateHyphenated(dateVal) {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatTimeOnly(dateVal) {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

function getFriendlyDayLabel(dateVal) {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const todayMid  = new Date(); todayMid.setHours(0,0,0,0);
    const dMid      = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays  = Math.round((todayMid - dMid) / 86400000);
    const dateStr   = formatDateOnly(d);
    if (diffDays === 0) return `${dateStr} · Today`;
    if (diffDays === 1) return `${dateStr} · 1 day ago`;
    if (diffDays < 30)  return `${dateStr} · ${diffDays} days ago`;
    if (diffDays < 365) { const m = Math.floor(diffDays/30); return `${dateStr} · ${m} month${m>1?'s':''} ago`; }
    const y = Math.floor(diffDays/365); return `${dateStr} · ${y} year${y>1?'s':''} ago`;
}

function formatCurrencyNoDecimals(amount) {
    if (amount === undefined || amount === null) return '0';
    const num = Number(amount);
    if (isNaN(num)) return '0';
    const abs = Math.abs(num).toFixed(0);
    let last3 = abs.slice(-3);
    const rest = abs.slice(0, -3);
    if (rest) last3 = ',' + last3;
    return (num < 0 ? '-' : '') + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3;
}
// ────────────────────────────────────────────────────────────────────────────

function formatSkuLine(skuLine, returnAsArray = false) {
    if (!skuLine) return returnAsArray ? [] : '';
    const parts = skuLine.split(',').map(part => {
        return part.trim()
            .replace(/\s*\(₹([\d.,]+)\)\s*×\s*(\d+)/g, ' - $2 X ₹$1')
            .replace(/\s*-\s*₹([\d.,\s]+)\s*X\s*([\d.,\s]+)/g, ' - $2 X ₹$1');
    }).filter(Boolean);
    if (returnAsArray) return parts;
    return parts.join('\n');
}

function CustomerLedger() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [closeBalanceHistory, setCloseBalanceHistory] = useState([]);
    const [paymentSettings, setPaymentSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal states
    const [isDrModalOpen, setIsDrModalOpen] = useState(false); // You Gave
    const [isCrModalOpen, setIsCrModalOpen] = useState(false); // You Got
    const [isQrModalOpen, setIsQrModalOpen] = useState(false); // QR Code Overlay

    // Edit Profile modal state
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [duplicateName, setDuplicateName] = useState('');
    const [duplicateMobile, setDuplicateMobile] = useState('');
    const [duplicateSubmitting, setDuplicateSubmitting] = useState(false);

    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editMobile, setEditMobile] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editAltMobile, setEditAltMobile] = useState('');
    const [editPincode, setEditPincode] = useState('');
    const [editOpeningBalance, setEditOpeningBalance] = useState('');
    const [editOpeningBalanceType, setEditOpeningBalanceType] = useState('debit');
    const [editSubmitting, setEditSubmitting] = useState(false);

    // Scoped Report Date Range & View states
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportFromDate, setReportFromDate] = useState('');
    const [reportToDate, setReportToDate] = useState('');
    const [isReportActive, setIsReportActive] = useState(false);
    const [isPdfOptionsModalOpen, setIsPdfOptionsModalOpen] = useState(false);
    const [pdfOptionsStep, setPdfOptionsStep] = useState('select_totals'); // 'select_totals' or 'select_date'
    const [finalTotalDate, setFinalTotalDate] = useState('');

    // Close Balance date-range states
    const [isCloseBalanceOpen, setIsCloseBalanceOpen] = useState(false);
    const [closeFromDate, setCloseFromDate] = useState('');
    const [closeToDate, setCloseToDate] = useState('');
    const [closeSubmitting, setCloseSubmitting] = useState(false);

    // Edit Transaction modal state
    const [isEditTxOpen, setIsEditTxOpen] = useState(false);
    const [editTx, setEditTx] = useState(null);
    const [editTxAmount, setEditTxAmount] = useState('');
    const [editTxDescription, setEditTxDescription] = useState('');
    const [editTxSubmitting, setEditTxSubmitting] = useState(false);
    const [editTxDate, setEditTxDate] = useState('');

    // Specific User Recycle Bin states
    const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
    const [recycleBinTxns, setRecycleBinTxns] = useState([]);
    const [recycleBinLoading, setRecycleBinLoading] = useState(false);

    // Edit Transaction product picker (separate from add to avoid conflicts)
    const [editUseProductPicker, setEditUseProductPicker] = useState(false);
    const [editSelectedProducts, setEditSelectedProducts] = useState([]); // [{product, qty}]

    // Form inputs state
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [transactionDate, setTransactionDate] = useState('');

    // QR selection state
    const [selectedPaymentSetting, setSelectedPaymentSetting] = useState(null);
    const [customQrAmount, setCustomQrAmount] = useState('');

    // Submitting state
    const [submitting, setSubmitting] = useState(false);

    // Synchronous execution locks to prevent double-clicks under slow networks
    const submittingRef = useRef(false);
    const editSubmittingRef = useRef(false);
    const closeSubmittingRef = useRef(false);
    const editTxSubmittingRef = useRef(false);

    // Product picker state (for You Got modal)
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]); // [{product, qty}]
    const [useProductPicker, setUseProductPicker] = useState(false);

    // Custom product states (shared between You Gave / You Got modals)
    const [showCustomProductForm, setShowCustomProductForm] = useState(false);
    const [customProductName, setCustomProductName] = useState('');
    const [customProductPrice, setCustomProductPrice] = useState('');
    const [customProductQty, setCustomProductQty] = useState('');

    // Custom product states for Edit Transaction modal
    const [showEditCustomProductForm, setShowEditCustomProductForm] = useState(false);
    const [editCustomProductName, setEditCustomProductName] = useState('');
    const [editCustomProductPrice, setEditCustomProductPrice] = useState('');
    const [editCustomProductQty, setEditCustomProductQty] = useState('');

    // Form input sanitization and limitation handlers
    const handleAmountChange = (e) => {
        const val = e.target.value;
        const sanitized = val.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        if (parts.length > 2) return;
        if (parts[1] && parts[1].length > 2) return;
        if (parts[0] && parts[0].length > 9) return;
        setAmount(sanitized);
    };

    const handleQrAmountChange = (e) => {
        const val = e.target.value;
        const sanitized = val.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        if (parts.length > 2) return;
        if (parts[1] && parts[1].length > 2) return;
        if (parts[0] && parts[0].length > 9) return;
        setCustomQrAmount(sanitized);
    };

    const hasEnteredQty = (qty) => qty !== '' && qty !== null && qty !== undefined && Number(qty) > 0;
    const calculateSelectedProductsTotal = (items) =>
        items.reduce((sum, { product, qty, price }) => {
            const effectiveQty = (qty === '' || qty == null || Number(qty) <= 0) ? 1 : Number(qty);
            return sum + ((price !== undefined ? price : (product?.price || 0)) * effectiveQty);
        }, 0);
    const syncAmountFromSelectedProducts = (items) => {
        const total = calculateSelectedProductsTotal(items);
        setAmount(total > 0 ? total.toFixed(2) : '');
    };
    const availableProductsForPicker = products.filter(
        p => !selectedProducts.some(item => item.product._id === p._id)
    );

    // Open modal handlers with safe form resetting
    const openDrModal = async () => {
        setAmount('');
        setDescription('');
        setTransactionDate('');
        setSelectedProducts([]);
        setProductSearch('');
        setUseProductPicker(false);
        setIsDrModalOpen(true);
        // Fetch products for picker
        try {
            const prods = await adminApi.getVisibleProducts();
            setProducts(prods || []);
        } catch (e) {
            console.error('Failed to load products:', e);
        }
    };

    const openCrModal = async () => {
        setAmount('');
        setDescription('');
        setTransactionDate('');
        setSelectedProducts([]);
        setProductSearch('');
        setUseProductPicker(false);
        setIsCrModalOpen(true);
        // Fetch products for picker
        try {
            const prods = await adminApi.getVisibleProducts();
            setProducts(prods || []);
        } catch (e) {
            console.error('Failed to load products:', e);
        }
    };

    const openQrModal = () => {
        setCustomQrAmount('');
        setIsQrModalOpen(true);
    };

    const openDuplicateModal = () => {
        if (!profile) return;
        setDuplicateName(`Copy of ${profile.name || ''}`);
        setDuplicateMobile('');
        setIsDuplicateModalOpen(true);
    };

    const handleDuplicateCustomer = async (e) => {
        e.preventDefault();
        if (!duplicateName.trim()) {
            alert('Name is required.');
            return;
        }
        if (!/^\d{10}$/.test(duplicateMobile.trim())) {
            alert('Mobile number must be a 10-digit number.');
            return;
        }
        setDuplicateSubmitting(true);
        try {
            const res = await adminApi.duplicateCustomer(userId, {
                name: duplicateName.trim(),
                mobile: duplicateMobile.trim()
            });
            alert('Customer duplicated successfully!');
            setIsDuplicateModalOpen(false);
            if (res && res.user && res.user._id) {
                navigate(`${basePath}/ledger/${res.user._id}`);
            } else {
                navigate(`${basePath}/ledger`);
            }
        } catch (err) {
            alert('Failed to duplicate customer: ' + err.message);
        } finally {
            setDuplicateSubmitting(false);
        }
    };

    // Symmetrical base path
    const isStaff = window.location.pathname.startsWith('/staff');
    const basePath = isStaff ? '/staff' : '/admin';

    useEffect(() => {
        fetchLedgerData();
        fetchPaymentSettings();
        // Preload products so Edit Transaction dropdown is ready immediately
        (async () => {
            try {
                const prods = await adminApi.getVisibleProducts();
                setProducts(prods || []);
            } catch (e) {
                console.error('Failed to preload products:', e);
            }
        })();
    }, [userId]);

    // ── Socket.io real-time sync ─────────────────────────────────────────
    useEffect(() => {
        const socket = socketIO(window.location.origin, { transports: ['websocket', 'polling'] });
        socket.on('ledger:updated', ({ userId: updatedId }) => {
            if (updatedId === userId) {
                fetchLedgerData();
            }
        });
        return () => socket.disconnect();
    }, [userId]);
    // ───────────────────────────────────────────────────────────────

    const fetchLedgerData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminApi.getCustomerLedger(userId);
            setProfile(data.customer);
            setCloseBalanceHistory(data.closeBalanceHistory || []);
            // Sort transactions chronologically (ascending for running balance calculations, then we can display descending or ascending)
            const sortedTx = (data.transactions || []).sort((a, b) => new Date(a.date) - new Date(b.date));

            // The customer.openingBalance is the carry-forward value AFTER all closed transactions.
            // Closed transactions are already baked into it, so we must NOT double-count them.
            // Strategy:
            //   - For the closed transactions block: compute their own internal running balance starting from 0
            //     so the closed period still shows meaningful historical balances.
            //   - For unclosed transactions (+ the carry-forward opening balance seed): accumulate on top
            //     of the openingBalance carry-forward value so the live balance column is correct.

            // Seed for unclosed transactions = openingBalance carry-forward (negative = customer owes us)
            const openingCarryForward = data.customer
                ? (data.customer.openingBalanceType === 'credit'
                    ? (data.customer.openingBalance || 0)
                    : -(data.customer.openingBalance || 0))
                : 0;

            // First pass: calculate the running balance for closed transactions (historical view, from 0)
            let closedRunning = 0;
            const closedRunningMap = {};
            for (const t of sortedTx) {
                if (!t.isClosed) continue;
                if (t.type === 'cr') {
                    closedRunning += (t.amount || 0);
                } else if (t.type === 'dr') {
                    closedRunning -= (t.amount || 0);
                }
                closedRunningMap[t._id] = closedRunning;
            }

            // Second pass: calculate the running balance for unclosed transactions seeded from carry-forward
            let unclosedRunning = openingCarryForward;
            const unclosedRunningMap = {};
            for (const t of sortedTx) {
                if (t.isClosed) continue;
                if (t.type === 'cr') {
                    unclosedRunning += (t.amount || 0);
                } else if (t.type === 'dr') {
                    unclosedRunning -= (t.amount || 0);
                }
                unclosedRunningMap[t._id] = unclosedRunning;
            }

            // Assign per-transaction runningBalance
            const calculatedTx = sortedTx.map(t => ({
                ...t,
                runningBalance: t.isClosed
                    ? (closedRunningMap[t._id] ?? 0)
                    : (unclosedRunningMap[t._id] ?? openingCarryForward)
            }));

            // Display newest first in the statement UI, excluding the virtual opening balance row
            setTransactions(calculatedTx.reverse().filter(t => !t.isOpeningBalance));
        } catch (err) {
            console.error('Error fetching customer ledger:', err);
            setError(err.message || 'Failed to load customer ledger.');
        } finally {
            setLoading(false);
        }
    };

    const fetchPaymentSettings = async () => {
        try {
            const res = await fetch('/api/admin/payment-settings', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setPaymentSettings(data || []);
                if (data && data.length > 0) {
                    setSelectedPaymentSetting(data[0]);
                }
            }
        } catch (err) {
            console.error('Error fetching payment settings:', err);
        }
    };

    const handleAddTransaction = async (type) => {
        if (submittingRef.current) return;

        // Amount is always taken from user input (now editable even with products)
        let finalAmount = amount;
        let productItems = [];
            if (useProductPicker && selectedProducts.length > 0) {
                productItems = selectedProducts
                .map(({ product, qty, price }) => ({
                    productId: product._id,
                    name: product.name,
                    sku: product.sku || '',
                    qty: (qty === '' || qty == null || Number(qty) <= 0) ? null : parseFloat(qty),
                    unitPrice: price !== undefined ? price : product.price
                }));
            }

        const numAmount = parseFloat(finalAmount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert('Please enter a valid amount greater than 0.');
            return;
        }
        if (numAmount > 999999999.99) {
            alert('Amount cannot exceed ₹99,99,99,999.99.');
            return;
        }

        // Do not auto-build description from product names
        let finalDescription = description;
        if (!finalDescription.trim()) finalDescription = '';

        submittingRef.current = true;
        setSubmitting(true);
        try {
            await adminApi.addLedgerTransaction({
                userId,
                type,
                amount: numAmount,
                description: finalDescription,
                date: transactionDate ? new Date(transactionDate) : new Date(),
                productItems: productItems.length > 0 ? productItems : undefined
            });

            setAmount('');
            setDescription('');
            setTransactionDate('');
            setSelectedProducts([]);
            setUseProductPicker(false);
            setIsDrModalOpen(false);
            setIsCrModalOpen(false);

            await fetchLedgerData();
        } catch (err) {
            alert('Failed to add transaction: ' + err.message);
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    };


    const handleDeleteTransaction = async (txId) => {
        const confirmMsg = isStaff 
            ? 'Request deletion of this ledger entry? This request requires Admin approval.'
            : 'Are you sure you want to delete this ledger entry? Outstanding balances will be recalculated immediately.';
            
        if (!window.confirm(confirmMsg)) return;
        try {
            setIsEditTxOpen(false);
            const res = await adminApi.deleteLedgerTransaction(txId);
            if (res && res.pendingApproval) {
                alert('Deletion request sent to Admin successfully.');
            } else {
                alert('Transaction deleted successfully.');
            }
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to delete transaction: ' + err.message);
        }
    };

    const handleApproveDelete = async (txId) => {
        if (!window.confirm('Are you sure you want to approve this deletion request? The entry will be permanently removed.')) return;
        try {
            setIsEditTxOpen(false);
            await adminApi.approveLedgerDelete(txId);
            alert('Deletion approved.');
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to approve deletion: ' + err.message);
        }
    };

    const handleRejectDelete = async (txId) => {
        if (!window.confirm('Are you sure you want to reject this deletion request? The entry will remain active.')) return;
        try {
            setIsEditTxOpen(false);
            await adminApi.rejectLedgerDelete(txId);
            alert('Deletion request rejected.');
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to reject deletion: ' + err.message);
        }
    };

    const handleSwitchLedgerType = async () => {
        const currentType = (profile.ledgerType || 'Customer').toLowerCase();
        const nextType = currentType === 'supplier' ? 'Customer' : 'Supplier';
        if (!window.confirm(`Are you sure you want to convert this account to a ${nextType}?`)) return;
        try {
            await adminApi.switchLedgerType(userId, nextType);
            alert(`Account converted to ${nextType} successfully!`);
            setIsEditProfileOpen(false);
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to switch type: ' + err.message);
        }
    };

    const handleRemoveFromLedger = async () => {
        const userName = profile?.name || 'this user';
        const msg = `Are you sure you want to permanently remove ${userName} from the ledger?\n\nThis will reset their ledger balance to zero and permanently delete all their ledger transactions. This action CANNOT be undone.`;
        if (!window.confirm(msg)) return;
        setLoading(true);
        try {
            await adminApi.removeFromLedger(userId);
            alert(`Successfully removed ${userName} from the ledger.`);
            navigate(`${basePath}/ledger`);
        } catch (err) {
            alert("Failed to remove user: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCustomerProfile = async () => {
        const userName = profile?.name || 'this user';
        const msg = `Are you sure you want to delete ${userName}? This will move this customer to the Recycle Bin.`;
        if (!window.confirm(msg)) return;
        setLoading(true);
        try {
            await adminApi.deleteUser(userId);
            alert(`${userName} moved to Recycle Bin.`);
            navigate(`${basePath}/ledger`);
        } catch (err) {
            alert("Failed to delete customer: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const openEditProfile = () => {
        if (!profile) return;
        setEditName(profile.name || '');
        setEditMobile(profile.mobile || '');
        setEditEmail(profile.email || '');
        setEditAddress(profile.address || '');
        setEditAltMobile(profile.altMobile || '');
        setEditPincode(profile.pincode || '');
        setEditOpeningBalance(profile.openingBalance !== undefined ? String(profile.openingBalance) : '0');
        setEditOpeningBalanceType(profile.openingBalanceType || 'debit');
        setIsEditProfileOpen(true);
    };

    const handleSaveProfile = async () => {
        if (editSubmittingRef.current) return;
        if (!editName.trim()) { alert('Name is required.'); return; }
        if (!editMobile || !/^\d{10}$/.test(editMobile)) { alert('Valid 10-digit mobile is required.'); return; }
        editSubmittingRef.current = true;
        setEditSubmitting(true);
        try {
            await adminApi.updateUser(userId, {
                name: editName.trim(),
                mobile: editMobile.trim(),
                email: editEmail.trim(),
                address: editAddress.trim(),
                altMobile: editAltMobile.trim(),
                pincode: editPincode.trim(),
                openingBalance: Number(editOpeningBalance) || 0,
                openingBalanceType: editOpeningBalanceType
            });
            setIsEditProfileOpen(false);
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to update profile: ' + err.message);
        } finally {
            editSubmittingRef.current = false;
            setEditSubmitting(false);
        }
    };

    const openCloseBalance = () => {
        if (transactions.length > 0) {
            const oldestDate = transactions[transactions.length - 1].date;
            setCloseFromDate(new Date(oldestDate).toISOString().split('T')[0]);
        } else {
            setCloseFromDate(new Date().toISOString().split('T')[0]);
        }
        setCloseToDate(new Date().toISOString().split('T')[0]);
        setIsCloseBalanceOpen(true);
    };

    const handleCloseBalance = async () => {
        if (closeSubmittingRef.current) return;
        if (!closeFromDate || !closeToDate) {
            alert('Both From and To dates are required.');
            return;
        }
        
        const confirmed = window.confirm(
            `⚠️ RECONCILE & CLOSE LEDGER?\n\n` +
            `This will close out all active transactions from ${closeFromDate} to ${closeToDate} and add their net outstanding to the user's Opening Balance.\n\n` +
            `The reconciled transactions will NOT be deleted, but will be displayed in a dull color and locked. Proceed?`
        );
        if (!confirmed) return;

        closeSubmittingRef.current = true;
        setCloseSubmitting(true);
        try {
            const res = await fetch(`/api/admin/ledger/close-balance/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromDate: closeFromDate, toDate: closeToDate }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                alert('Ledger transactions in specified range successfully closed and carried forward!');
                setIsCloseBalanceOpen(false);
                await fetchLedgerData();
            } else {
                alert('Failed to close balance: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Error closing balance: ' + err.message);
        } finally {
            closeSubmittingRef.current = false;
            setCloseSubmitting(false);
        }
    };

    const handleClearStatements = async () => {
        const userName = profile?.name || 'this user';
        const msg = `Clear all ledger statements for ${userName}?\n\nThis will permanently delete all statement entries for this user, reset their ledger balance to zero, and keep the user profile in ledger. This action CANNOT be undone.`;
        if (!window.confirm(msg)) return;
        setLoading(true);
        try {
            await adminApi.clearLedgerStatements(userId);
            alert(`All statements cleared for ${userName}.`);
            setIsEditProfileOpen(false);
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to clear statements: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRevertCloseBalance = async (closeId) => {
        const confirmed = window.confirm('Revert this close balance? This will un-lock those closed entries and restore opening balance.');
        if (!confirmed) return;
        setCloseSubmitting(true);
        try {
            await adminApi.revertCloseBalance(userId, closeId);
            alert('Close balance reverted successfully.');
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to revert close balance: ' + err.message);
        } finally {
            setCloseSubmitting(false);
        }
    };

    const handleDeleteCloseBalance = async (closeId) => {
        const confirmed = window.confirm('Delete this close balance? This will restore opening balance and permanently delete the closed transactions in that batch.');
        if (!confirmed) return;
        setCloseSubmitting(true);
        try {
            await adminApi.deleteCloseBalance(userId, closeId);
            alert('Close balance deleted successfully.');
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to delete close balance: ' + err.message);
        } finally {
            setCloseSubmitting(false);
        }
    };

    const openEditTransaction = async (tx) => {
        setEditTx(tx);
        setEditTxAmount(String(tx.amount || ''));
        setEditTxDescription(tx.description || '');
        const toLocalISOString = (dateObj) => {
            const tzOffset = dateObj.getTimezoneOffset() * 60000;
            return (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
        };
        setEditTxDate(tx.date ? toLocalISOString(new Date(tx.date)) : '');

        // Ensure products are loaded for the inventory dropdown in Edit Transaction
        if (products.length === 0) {
            try {
                const prods = await adminApi.getVisibleProducts();
                setProducts(prods || []);
            } catch (e) {
                console.error('Failed to load products for Edit Transaction:', e);
            }
        }

        // Load existing productItems into editable picker format (use historical snapshot)
        if (Array.isArray(tx.productItems) && tx.productItems.length > 0) {
            const loaded = tx.productItems.map(item => ({
                product: {
                    _id: item.productId || item._id || '',
                    name: item.name || 'Unknown',
                    sku: item.sku || '',
                    price: item.unitPrice || 0
                },
                qty: item.qty || 1,
                price: item.unitPrice || 0
            }));
            setEditSelectedProducts(loaded);
            setEditUseProductPicker(true);
        } else {
            setEditSelectedProducts([]);
            setEditUseProductPicker(false);
        }

        setIsEditTxOpen(true);
    };

    // Helper: update edit products + sync the Amount field to the new product total
    // This ensures that changes to qty / unit price / adding products in Edit Tx
    // are reflected in the main transaction amount (and thus the Chronological Statement values).
    const syncEditProductsAndAmount = (newList) => {
        setEditSelectedProducts(newList);
        const total = newList.reduce((sum, { product, qty, price }) => sum + ((price !== undefined ? price : (product.price || 0)) * (parseFloat(qty) || 0)), 0);
        setEditTxAmount(total.toFixed(2));
    };

    const handleSaveTransaction = async () => {
        if (!editTx) return;
        if (editTxSubmittingRef.current) return;

        // If using product picker and all items are deleted, treat it as a deletion request
        if (editUseProductPicker && editSelectedProducts.length === 0) {
            const confirmMsg = isStaff 
                ? 'You have removed all items from this entry. Request deletion of this ledger entry? This request requires Admin approval.'
                : 'You have removed all items from this entry. Are you sure you want to delete this ledger entry? Outstanding balances will be recalculated immediately.';
            
            if (!window.confirm(confirmMsg)) return;

            editTxSubmittingRef.current = true;
            setEditTxSubmitting(true);
            try {
                setIsEditTxOpen(false);
                const res = await adminApi.deleteLedgerTransaction(editTx._id);
                if (res && res.pendingApproval) {
                    alert('Deletion request sent to Admin successfully.');
                } else {
                    alert('Transaction deleted successfully.');
                }
                setEditTx(null);
                setEditSelectedProducts([]);
                setEditUseProductPicker(false);
                await fetchLedgerData();
            } catch (err) {
                alert('Failed to delete transaction: ' + err.message);
            } finally {
                editTxSubmittingRef.current = false;
                setEditTxSubmitting(false);
            }
            return;
        }

        const numAmount = parseFloat(editTxAmount);
        if (isNaN(numAmount) || numAmount <= 0) { alert('Please enter a valid amount.'); return; }
        editTxSubmittingRef.current = true;
        setEditTxSubmitting(true);
        try {
            let productItems = [];
            let finalDescription = editTxDescription.trim() || editTx.description || '';

            if (editUseProductPicker && editSelectedProducts.length > 0) {
                productItems = editSelectedProducts
                    .map(({ product, qty, price }) => ({
                        productId: product._id,
                        name: product.name,
                        sku: product.sku || '',
                        qty: (qty === '' || qty == null || Number(qty) <= 0) ? null : parseFloat(qty),
                        unitPrice: price !== undefined ? price : product.price
                    }));
                // Do not auto-populate description from product names
            }

            await adminApi.updateLedgerTransaction(editTx._id, {
                amount: numAmount,
                description: finalDescription,
                date: editTxDate ? new Date(editTxDate).toISOString() : undefined,
                productItems: productItems.length > 0 ? productItems : undefined
            });

            setIsEditTxOpen(false);
            setEditTx(null);
            setEditSelectedProducts([]);
            setEditUseProductPicker(false);
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to update transaction: ' + err.message);
        } finally {
            editTxSubmittingRef.current = false;
            setEditTxSubmitting(false);
        }
    };

    const openRecycleBin = async () => {
        setIsRecycleBinOpen(true);
        setRecycleBinLoading(true);
        try {
            const data = await adminApi.getRecycleBin(userId);
            setRecycleBinTxns(data || []);
        } catch (err) {
            alert("Failed to load bin: " + err.message);
        } finally {
            setRecycleBinLoading(false);
        }
    };

    const handleRestoreTransaction = async (txId) => {
        if (!window.confirm("Are you sure you want to restore this statement back to the active ledger? Outstanding balances will be recalculated.")) return;
        try {
            await adminApi.revertRecycleBin(txId);
            alert("Statement restored successfully!");
            await fetchLedgerData();
            const data = await adminApi.getRecycleBin(userId);
            setRecycleBinTxns(data || []);
        } catch (err) {
            alert("Failed to restore transaction: " + err.message);
        }
    };

    const handlePermanentDeleteTransaction = async (txId) => {
        if (!window.confirm("WARNING: This action CANNOT be undone! This statement will be permanently erased from the database. Proceed?")) return;
        try {
            await adminApi.permanentDeleteRecycleBin(txId);
            alert("Statement permanently deleted.");
            const data = await adminApi.getRecycleBin(userId);
            setRecycleBinTxns(data || []);
        } catch (err) {
            alert("Failed to delete transaction: " + err.message);
        }
    };

    // Formulates deep-linked WhatsApp reminder link
    const handleSendWhatsApp = () => {
        if (!profile) return;
        const net = profile.netBalance || 0;
        const phone = profile.mobile || '';
        const name = profile.name || 'Customer';
        
        let messageText = '';
        if (net < 0) {
            // They owe us
            const absBal = Math.abs(net).toFixed(2);
            messageText = `Dear ${name},\n\nThis is a friendly reminder from KSK VASU & Co. Your current outstanding balance is *₹${absBal}*.\n\nPlease clear the pending amount at your earliest convenience.\n\nThank you for your business!`;
        } else if (net > 0) {
            // They have advance
            messageText = `Dear ${name},\n\nGreeting from KSK VASU & Co. You have an advance credit balance of *₹${net.toFixed(2)}* with us.\n\nThank you for your continued support!`;
        } else {
            messageText = `Dear ${name},\n\nGreeting from KSK VASU & Co. Your ledger account is fully settled with ₹0.00 outstanding.\n\nThank you!`;
        }

        const encodedText = encodeURIComponent(messageText);
        // Normalize mobile for international formatting (e.g. prefix 91 if 10 digit Indian number)
        const cleanPhone = phone.length === 10 ? '91' + phone : phone;
        window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
    };

    const openReportModal = () => {
        if (!reportFromDate) {
            const sorted = [...transactions].reverse();
            const startingOrder = sorted.find(t => t.orderId) || sorted[0];
            let targetDate = new Date();
            if (startingOrder && startingOrder.date) {
                targetDate = new Date(startingOrder.date);
            }
            const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
            const yyyy = startOfMonth.getFullYear();
            const mm = String(startOfMonth.getMonth() + 1).padStart(2, '0');
            const dd = '01';
            setReportFromDate(`${yyyy}-${mm}-${dd}`);
        }
        if (!reportToDate) {
            setReportToDate(new Date().toISOString().split('T')[0]);
        }
        setIsReportModalOpen(true);
    };

    const handleGenerateReport = async () => {
        if (!reportFromDate || !reportToDate) {
            alert('Both From and To dates are required.');
            return;
        }

        if (reportFromDate > reportToDate) {
            alert('Start Date cannot be after End Date.');
            return;
        }
        
        const todayStr = new Date().toISOString().split('T')[0];
        if (reportFromDate > todayStr || reportToDate > todayStr) {
            alert('Future dates are not allowed for report generation.');
            return;
        }

        setIsReportModalOpen(false);
        setIsReportActive(true);
    };

    const handleDownloadReportPDF = (fromDate, toDate, openingBal, totalDr, totalCr, closingBal, scopedTx, includeMonthlyTotals, finalTotalDate) => {
        const customerName = profile?.name ? profile.name.replace(/[^a-zA-Z0-9_ -]/g, '_') : 'Customer';
        const _dCurrent = new Date();
        const dateStr = `${String(_dCurrent.getDate()).padStart(2, '0')}-${String(_dCurrent.getMonth() + 1).padStart(2, '0')}-${_dCurrent.getFullYear()}`;
        const downloadFilename = `${customerName}_${dateStr}.pdf`;
        if (!profile) return;

        let activeOpeningBal = openingBal;
        let activeTotalDr = totalDr;
        let activeTotalCr = totalCr;
        let activeClosingBal = closingBal;
        let activeScopedTx = scopedTx;

        if (finalTotalDate) {
            const endDateLimit = new Date(finalTotalDate + 'T23:59:59');
            activeScopedTx = scopedTx.filter(t => {
                const d = new Date(t.date);
                return d <= endDateLimit;
            });

            // Recalculate totals based on activeScopedTx starting from activeOpeningBal
            let runningVal = activeOpeningBal;
            activeTotalDr = 0;
            activeTotalCr = 0;
            activeScopedTx.forEach(t => {
                if (t.type === 'dr') {
                    activeTotalDr += (t.amount || 0);
                    runningVal -= (t.amount || 0);
                } else {
                    activeTotalCr += (t.amount || 0);
                    runningVal += (t.amount || 0);
                }
            });
            activeClosingBal = runningVal;
        }

        const baseOB = profile.openingBalanceType === 'credit' ? (profile.openingBalance || 0) : -(profile.openingBalance || 0);
        let unclosedAdjustment = 0;
        const start = new Date(fromDate + 'T00:00:00');
        const chronological = [...transactions].reverse();
        chronological.forEach(t => {
            if (t.isOpeningBalance) return;
            const d = new Date(t.date);
            if (d < start && !t.isClosed) {
                if (t.type === 'dr') {
                    unclosedAdjustment -= (t.amount || 0);
                } else {
                    unclosedAdjustment += (t.amount || 0);
                }
            }
        });

        const formatPDFCurrency = (num) => {
            const parsed = Math.abs(num || 0);
            if (parsed % 1 === 0) {
                return parsed.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            } else {
                return parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        };
        
        const generatedAtStr = new Date().toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
        const balanceLabel = activeClosingBal === 0 ? 'Settled' : activeClosingBal < 0 ? 'Due' : 'Advance';
        const balanceColor = activeClosingBal >= 0 ? '#059669' : '#dc2626';

        // Group transactions by month
        const groupTransactionsByMonth = (txList) => {
            const groups = [];
            txList.forEach(t => {
                const d = new Date(t.date);
                const monthName = d.toLocaleString('en-IN', { month: 'long' });
                const year = d.getFullYear();
                const monthKey = `${monthName} ${year}`;
                
                let group = groups.find(g => g.monthKey === monthKey);
                if (!group) {
                    group = { monthKey, monthName, year, transactions: [], totalDebit: 0, totalCredit: 0 };
                    groups.push(group);
                }
                group.transactions.push(t);
                if (t.type === 'dr') {
                    group.totalDebit += (t.amount || 0);
                } else {
                    group.totalCredit += (t.amount || 0);
                }
            });
            return groups;
        };

        const monthGroups = groupTransactionsByMonth(activeScopedTx);
        let runningBal = activeOpeningBal;
        let rowsHtml = '';

        // Add explicit Opening Balance row to PDF table
        if (activeOpeningBal !== undefined) {
            const isOBDr = activeOpeningBal < 0;
            const obDrHtml = isOBDr ? `&#8377;${formatPDFCurrency(Math.abs(activeOpeningBal))}` : '—';
            const obCrHtml = !isOBDr ? `&#8377;${formatPDFCurrency(Math.abs(activeOpeningBal))}` : '—';
            const obColor = isOBDr ? '#dc2626' : '#059669';
            rowsHtml += `
              <tr style="background-color: #f8fafc; font-weight: bold;">
                <td style="padding: 10px 8px; font-size: 12px; color: #000000; white-space: nowrap; vertical-align: top; border: 1.5px solid #000000; font-weight: bold;">
                  ${formatDateOnly(fromDate)}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; color: #000000; vertical-align: top; border: 1.5px solid #000000; font-weight: bold;">
                  OPENING BALANCE
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626; vertical-align: top; white-space: nowrap; padding-right: 30px; border: 1.5px solid #000000;">
                  ${obDrHtml}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #059669; vertical-align: top; white-space: nowrap; padding-right: 30px; border: 1.5px solid #000000;">
                  ${obCrHtml}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: ${obColor}; vertical-align: top; white-space: nowrap; padding-right: 30px; border: 1.5px solid #000000;">
                  &#8377;${formatPDFCurrency(Math.abs(activeOpeningBal))}
                </td>
              </tr>
            `;
        }

        monthGroups.forEach(group => {
            // Month header row
            rowsHtml += `
              <tr style="background-color: #e8f4f8; font-weight: bold; page-break-after: avoid; break-after: avoid;">
                <td colspan="5" style="padding: 8px 8px 0 8px; font-size: 14px; color: #0f172a; text-align: left; font-weight: bold; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: 0.5px; text-transform: uppercase;">
                  ${group.monthKey}
                </td>
              </tr>
              <tr style="background-color: #e8f4f8; page-break-after: avoid; break-after: avoid;">
                <td colspan="5" style="padding: 0 8px 6px 8px;">
                  <div style="border-bottom: 2px solid #0f52ba; width: 100%;"></div>
                </td>
              </tr>
            `;

            // Transactions rows
            group.transactions.forEach((t, index) => {
                if (t.type === 'dr') {
                    runningBal -= (t.amount || 0);
                } else {
                    runningBal += (t.amount || 0);
                }

                let productLinesHtml = '';
                if (t.productItems && t.productItems.length > 0) {
                    productLinesHtml = t.productItems.map(p => 
                        `<div style="font-size: 12px; color: #000000; margin-top: 2px; padding-left: 0px; font-weight: bold;">${p.sku || p.name} - ${p.qty} X &#8377;${formatPDFCurrency(p.unitPrice)}</div>`
                    ).join('');
                } else if (t.skuLine) {
                    productLinesHtml = `<div style="font-size: 12px; color: #000000; margin-top: 2px; padding-left: 0px; font-weight: bold;">${formatSkuLine(t.skuLine).replace(/\n/g, '<br />')}</div>`;
                }

                const source = t.orderId ? '<span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 1px 4px; border-radius: 3px; font-weight: bold; margin-left: 6px;">ORDER</span>' : '';

                const isDr = t.type === 'dr';
                const drValHtml = isDr 
                    ? `&#8377;${formatPDFCurrency(t.amount)}` 
                    : '';
                const crValHtml = !isDr 
                    ? `&#8377;${formatPDFCurrency(t.amount)}` 
                    : '';

                rowsHtml += `
                  <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};${index === 0 ? ' page-break-before: avoid; break-before: avoid;' : ''}">
                    <td style="padding: 10px 8px; font-size: 12px; color: #000000; white-space: nowrap; vertical-align: top; border: 1.5px solid #000000;">
                      ${formatDateOnly(t.date)}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; color: #000000; vertical-align: top; border: 1.5px solid #000000;">
                      <div style="font-weight: bold; color: #000000;">${t.description || ''} ${source}</div>
                      ${productLinesHtml}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626; vertical-align: top; white-space: nowrap; padding-right: 30px; background-color: #fff5f5; border: 1.5px solid #000000;">
                      ${drValHtml}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #059669; vertical-align: top; white-space: nowrap; padding-right: 30px; background-color: #f0fdf4; border: 1.5px solid #000000;">
                      ${crValHtml}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: ${runningBal >= 0 ? '#059669' : '#dc2626'}; vertical-align: top; white-space: nowrap; padding-right: 30px; border: 1.5px solid #000000;">
                      &#8377;${formatPDFCurrency(Math.abs(runningBal))}
                    </td>
                  </tr>
                `;
            });

            // Month total row
            if (includeMonthlyTotals) {
                rowsHtml += `
                  <tr style="font-weight: bold; background-color: #ffffff;">
                    <td style="padding: 10px 8px; font-size: 13px; color: #000000; font-weight: bold; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border: 1.5px solid #000000;">
                      ${group.monthName} Total
                    </td>
                    <td style="border: 1.5px solid #000000;"></td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626; padding-right: 30px; background-color: #fff5f5; border: 1.5px solid #000000;">
                      &#8377;${formatPDFCurrency(group.totalDebit)}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #059669; padding-right: 30px; background-color: #f0fdf4; border: 1.5px solid #000000;">
                      &#8377;${formatPDFCurrency(group.totalCredit)}
                    </td>
                    <td style="border: 1.5px solid #000000;"></td>
                  </tr>
                `;
            }
        });

        if (finalTotalDate) {
            rowsHtml += `
              <tr style="font-weight: bold; background-color: #e2e8f0; border-top: 2px double #000000; border-bottom: 2px double #000000;">
                <td style="padding: 10px 8px; font-size: 12px; color: #000000; font-weight: bold; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border: 1.5px solid #000000; white-space: nowrap;">
                  Total on ${formatDateOnly(finalTotalDate)}
                </td>
                <td style="padding: 10px 8px; font-size: 12px; color: #000000; font-weight: bold; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border: 1.5px solid #000000;">
                  Calculated totals (Debit, Credit & Balance) up to this date
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626; padding-right: 30px; background-color: #fff5f5; border: 1.5px solid #000000; white-space: nowrap;">
                  &#8377;${formatPDFCurrency(activeTotalDr)}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #059669; padding-right: 30px; background-color: #f0fdf4; border: 1.5px solid #000000; white-space: nowrap;">
                  &#8377;${formatPDFCurrency(activeTotalCr)}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: ${activeClosingBal >= 0 ? '#059669' : '#dc2626'}; padding-right: 30px; border: 1.5px solid #000000; white-space: nowrap;">
                  &#8377;${formatPDFCurrency(Math.abs(activeClosingBal))} (${activeClosingBal >= 0 ? 'Advance' : 'Due'})
                </td>
              </tr>
            `;
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${profile.name} (${fromDate} to ${finalTotalDate || toDate})</title>
            <style>
              @page {
                size: auto;
                margin: 0;
              }
              body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #1e293b;
                margin: 0;
                padding: 0;
                font-size: 11px;
                line-height: 1.4;
                background-color: #fff;
              }

              .container {
                width: 100%;
                box-sizing: border-box;
                padding: 0 30px;
              }
              .header-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 60px;
                background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);
                color: #ffffff;
                padding: 12px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 0;
                border-radius: 0;
                z-index: 1000;
              }
              .footer-banner {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 32px;
                background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);
                color: #ffffff;
                padding: 6px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 0;
                border-radius: 0;
                z-index: 1000;
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              }
              .book-now-btn {
                display: inline-block;
                background-color: #ffffff;
                color: #0f52ba;
                font-weight: bold;
                padding: 4px 12px;
                border-radius: 4px;
                text-decoration: none;
                font-size: 11px;
                transition: all 0.2s ease;
                border: 1px solid #ffffff;
              }
              .book-now-btn:hover {
                background-color: #0f52ba;
                color: #ffffff;
                border-color: #ffffff;
              }
              .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
              }
              .header-left h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: 0.5px;
                text-transform: uppercase;
              }
              .header-left p {
                margin: 4px 0 0 0;
                font-size: 11px;
                opacity: 0.9;
                font-weight: 500;
              }
              .header-right {
                text-align: right;
                font-size: 10px;
                font-weight: 500;
              }
              .header-right div {
                margin-bottom: 3px;
              }
              .footer-left-content {
                font-size: 11.5px;
                font-weight: bold;
                letter-spacing: 0.3px;
                text-align: left;
              }
              .footer-right-content {
                font-size: 10.5px;
                font-weight: 500;
                opacity: 0.9;
                text-align: right;
              }
              .profile-section {
                display: flex;
                justify-content: space-between;
                gap: 20px;
                margin-bottom: 20px;
              }
              .profile-card {
                flex: 1;
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
              }
              .profile-card h3 {
                margin: 0 0 10px 0;
                font-size: 12px;
                font-weight: 700;
                color: #0f172a;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 1.5px solid #cbd5e1;
                padding-bottom: 6px;
              }
              .meta-item {
                display: flex;
                margin-bottom: 6px;
              }
              .meta-label {
                width: 100px;
                font-weight: 600;
                color: #64748b;
              }
              .meta-value {
                flex: 1;
                color: #1e293b;
                font-weight: 700;
              }
              .summary-card {
                background-color: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
              }
              .summary-item {
                text-align: center;
                flex: 1;
              }
              .summary-item:not(:last-child) {
                border-right: 1.5px solid #cbd5e1;
              }
              .summary-label {
                font-size: 12px;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
                margin-bottom: 4px;
                letter-spacing: 0.3px;
                white-space: nowrap;
              }
              .summary-value {
                font-size: 18px;
                font-weight: 800;
              }
              .summary-value.dr {
                color: #dc2626;
              }
              .summary-value.cr {
                color: #059669;
              }
              .table-container {
                margin-bottom: 30px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                text-align: left;
              }
              th {
                background-color: #f1f5f9;
                color: #475569;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                padding: 12px 8px;
                border-bottom: 2px solid #cbd5e1;
              }
              td {
                padding: 12px 8px;
                border-bottom: 1px solid #e2e8f0;
                vertical-align: top;
              }
              .preview-bar {
                background-color: #0f172a;
                color: #f8fafc;
                padding: 14px 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #334155;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                margin-bottom: 24px;
                border-radius: 8px;
              }
              .preview-info {
                display: flex;
                align-items: center;
                gap: 12px;
                text-align: left;
              }
              .preview-icon {
                font-size: 24px;
              }
              .preview-info strong {
                font-size: 14px;
                color: #f1f5f9;
              }
              .preview-info p {
                margin: 2px 0 0 0;
                font-size: 12px;
                color: #94a3b8;
              }
              .preview-actions {
                display: flex;
                gap: 8px;
              }
              .preview-btn {
                padding: 8px 16px;
                font-size: 12px;
                font-weight: 700;
                border-radius: 6px;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
              }
              .preview-btn.primary {
                background-color: #2563eb;
                color: white;
              }
              .preview-btn.primary:hover {
                background-color: #1d4ed8;
              }
              .preview-btn.secondary {
                background-color: #334155;
                color: #f1f5f9;
                border: 1px solid #475569;
              }
              .preview-btn.secondary:hover {
                background-color: #475569;
              }
              @media print {
                .no-print {
                  display: none !important;
                }
                body {
                  padding: 0;
                }
                .header-banner {
                  background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%) !important;
                  color: #fff !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .footer-banner {
                  background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%) !important;
                  color: #fff !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                th {
                  background-color: #f1f5f9 !important;
                  color: #475569 !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .profile-card {
                  background-color: #f8fafc !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .summary-card {
                  background-color: #f8fafc !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                tr {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            </style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <script>
              function downloadPDFDirectly() {
                const element = document.body;
                const opt = {
                  margin:       [10, 10, 10, 10],
                  filename:     "${downloadFilename}",
                  image:        { type: 'jpeg', quality: 0.98 },
                  html2canvas:  { 
                    scale: 2, 
                    useCORS: true,
                    ignoreElements: (el) => el.classList.contains('no-print')
                  },
                  jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                html2pdf().from(element).set(opt).save();
              }
            </script>
          </head>
          <body onload="setTimeout(function(){ window.print(); }, 500)">
            <div class="header-banner">
              <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                <img src="${logoBase64}" style="height: 56px; width: auto; object-fit: contain; display: block; flex-shrink: 0;" alt="KSK VASU Co Logo" />
                <div>
                  <h1>KSK VASU &amp; Co</h1>
                  <p>Building Materials Service Center &amp; Logistics</p>
                </div>
              </div>
              <div class="header-right">
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-bottom: 3px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"/></svg>
                  <span>+91 94433 50464</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-bottom: 3px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"/></svg>
                  <span>+91 95665 30464</span>
                </div>
                <div style="margin-top: 4px;"><a href="https://www.kskvasu.co.in" target="_blank" style="color: #ffffff; font-weight: 850; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; letter-spacing: 0.3px;">www.kskvasu.co.in</a></div>
              </div>
            </div>
            <div class="footer-banner">
              <div class="footer-left-content">
                <strong>This is the Authorized Digital Statement From KSK VASU &amp; Co</strong>
              </div>
              <div class="footer-right-content">
                <a href="https://order.kskvasu.co.in/" target="_blank" class="book-now-btn">Book Now</a>
              </div>
            </div>

            <div class="preview-bar no-print">
              <div class="preview-info">
                <span class="preview-icon">📄</span>
                <div>
                  <strong>Scoped Ledger Statement Report Preview</strong>
                  <p>Statement from ${formatDateOnly(fromDate)} to ${formatDateOnly(toDate)}.</p>
                </div>
              </div>
              <div class="preview-actions">
                <button class="preview-btn primary" onclick="downloadPDFDirectly()">
                  📥 Download PDF
                </button>
                <button class="preview-btn secondary" style="margin-left: 8px;" onclick="window.print()">
                  🖨️ Print
                </button>
              </div>
            </div>
            <div class="container">
              <table style="width: 100%; border: none; border-collapse: collapse;">
                <thead>
                  <tr>
                    <td style="border: none; padding: 0; height: 85px;"></td>
                  </tr>
                </thead>
                <tfoot>
                  <tr>
                    <td style="border: none; padding: 0; height: 65px;"></td>
                  </tr>
                </tfoot>
                <tbody>
                  <tr>
                    <td style="border: none; padding: 0;">
                      <div class="profile-section">
                        <div class="profile-card">
                          <h3>Statement Details</h3>
                          <div class="meta-item">
                            <span class="meta-label">Customer Name:</span>
                            <span class="meta-value">${profile.name}</span>
                          </div>
                          <div class="meta-item">
                            <span class="meta-label">Mobile Number:</span>
                            <span class="meta-value">+91 ${profile.mobile || 'N/A'}</span>
                          </div>
                          ${profile.altMobile ? `
                            <div class="meta-item">
                              <span class="meta-label">Alt Mobile:</span>
                              <span class="meta-value">+91 ${profile.altMobile}</span>
                            </div>
                          ` : ''}
                          <div class="meta-item">
                            <span class="meta-label">Address:</span>
                            <span class="meta-value">${profile.address || 'N/A'}</span>
                          </div>
                        </div>
                        <div class="profile-card">
                          <h3>Account Context</h3>
                          <div class="meta-item">
                            <span class="meta-label">Account Type:</span>
                            <span class="meta-value">${profile.ledgerType || 'Customer'}</span>
                          </div>

                          <div class="meta-item">
                            <span class="meta-label">Statement Range:</span>
                            <span class="meta-value">${formatDateOnly(fromDate)} to ${formatDateOnly(finalTotalDate || toDate)}</span>
                          </div>
                          <div class="meta-item">
                            <span class="meta-label">Generated At:</span>
                            <span class="meta-value">${generatedAtStr}</span>
                          </div>
                        </div>
                      </div>

                      <div class="summary-card">
                        <div class="summary-item" style="flex: 1.45; text-align: left; padding-left: 15px;">
                          <div class="summary-label" style="white-space: nowrap;">OPENING BALANCE (${formatDateOnly(fromDate)})</div>
                          <div class="summary-value" style="color: ${activeOpeningBal >= 0 ? '#059669' : '#dc2626'}; font-size: 14px;">&#8377;${formatPDFCurrency(Math.abs(activeOpeningBal))} (${activeOpeningBal >= 0 ? 'Credit' : 'Debit'})</div>
                          ${unclosedAdjustment !== 0 ? `
                            <div style="font-size: 8.5px; color: #475569; margin-top: 3px; font-weight: 500; line-height: 1.25; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                              (Base OB: &#8377;${formatPDFCurrency(Math.abs(baseOB))} ${baseOB >= 0 ? 'Cr' : 'Dr'} ${unclosedAdjustment >= 0 ? '+' : '-'} Unclosed: &#8377;${formatPDFCurrency(Math.abs(unclosedAdjustment))})
                            </div>
                          ` : `
                            <div style="font-size: 8.5px; color: #475569; margin-top: 3px; font-weight: 500; line-height: 1.25; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                              (Base OB: &#8377;${formatPDFCurrency(Math.abs(baseOB))} ${baseOB >= 0 ? 'Cr' : 'Dr'} + No Prior Unclosed)
                            </div>
                          `}
                        </div>
                        <div class="summary-item" style="flex: 0.85;">
                          <div class="summary-label">TOTAL DEBIT</div>
                          <div class="summary-value dr">&#8377;${formatPDFCurrency(activeTotalDr)}</div>
                        </div>
                        <div class="summary-item" style="flex: 0.85;">
                          <div class="summary-label">TOTAL CREDIT</div>
                          <div class="summary-value cr">&#8377;${formatPDFCurrency(activeTotalCr)}</div>
                        </div>
                        <div class="summary-item" style="flex: 0.85;">
                          <div class="summary-label">NET BALANCE</div>
                          <div class="summary-value" style="color: ${balanceColor};">&#8377;${formatPDFCurrency(Math.abs(activeClosingBal))} (${balanceLabel})</div>
                          <div style="font-size: 11px; font-weight: bold; color: statColor || balanceColor; margin-top: 4px;">${activeClosingBal === 0 ? 'Settled' : activeClosingBal < 0 ? `${profile.name} Will Give` : `${profile.name} Got`}</div>
                        </div>
                      </div>

                      <div class="table-container">
                        <div style="font-size: 11.5px; font-weight: bold; margin-bottom: 8px; color: #1e293b; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">No. of Entries: ${activeScopedTx.length} (All)</div>
                        <table>
                          <thead>
                            <tr>
                              <th style="width: 15%;">Date</th>
                              <th style="width: 45%;">Details</th>
                              <th style="width: 13%; text-align: right; padding-right: 30px;">Debit</th>
                              <th style="width: 13%; text-align: right; padding-right: 30px;">Credit</th>
                              <th style="width: 14%; text-align: right; padding-right: 30px;">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${rowsHtml}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.opener = null; // Detach to prevent blocking parent event loop
    };

    const handleDownloadPDF = () => {
        const customerName = profile?.name ? profile.name.replace(/[^a-zA-Z0-9_ -]/g, '_') : 'Customer';
        const _dCurrent = new Date();
        const dateStr = `${String(_dCurrent.getDate()).padStart(2, '0')}-${String(_dCurrent.getMonth() + 1).padStart(2, '0')}-${_dCurrent.getFullYear()}`;
        const downloadFilename = `${customerName}_${dateStr}.pdf`;
        if (!profile) return;
        
        const formatPDFCurrency = (num) => {
            const parsed = Math.abs(num || 0);
            if (parsed % 1 === 0) {
                return parsed.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            } else {
                return parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        };

        const netVal = profile.netBalance || 0;
        const generatedAtStr = new Date().toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
        const balanceLabel = netVal === 0 ? 'Settled' : netVal < 0 ? 'Due' : 'Advance';
        const balanceColor = netVal >= 0 ? '#059669' : '#dc2626';

        // 1. Compile Transaction Rows (reverse to chronological ascending order) and filter out closed transactions
        const chronological = [...transactions].reverse().filter(t => !t.isClosed);
        const oldestTxDate = chronological.length > 0 ? formatDateOnly(chronological[0].date) : 'Start';
        const newestTxDate = chronological.length > 0 ? formatDateOnly(chronological[chronological.length - 1].date) : 'End';
        const statementRangeStr = chronological.length > 0 ? `${oldestTxDate} to ${newestTxDate}` : 'All-Time';
        
        // Group transactions by month
        const groupTransactionsByMonth = (txList) => {
            const groups = [];
            txList.forEach(t => {
                const d = new Date(t.date);
                const monthName = d.toLocaleString('en-IN', { month: 'long' });
                const year = d.getFullYear();
                const monthKey = `${monthName} ${year}`;
                
                let group = groups.find(g => g.monthKey === monthKey);
                if (!group) {
                    group = { monthKey, monthName, year, transactions: [], totalDebit: 0, totalCredit: 0 };
                    groups.push(group);
                }
                group.transactions.push(t);
                if (t.type === 'dr') {
                    group.totalDebit += (t.amount || 0);
                } else {
                    group.totalCredit += (t.amount || 0);
                }
            });
            return groups;
        };

        const monthGroups = groupTransactionsByMonth(chronological);
        const baseOB = profile.openingBalanceType === 'debit' ? (profile.openingBalance || 0) : -(profile.openingBalance || 0);
        let runningBal = baseOB;
        let rowsHtml = '';

        // Add explicit Opening Balance row to PDF table
        if (profile.openingBalance !== undefined) {
            const isOBDr = profile.openingBalanceType === 'debit';
            const obDrHtml = isOBDr ? `&#8377;${formatPDFCurrency(Math.abs(profile.openingBalance))}` : '—';
            const obCrHtml = !isOBDr ? `&#8377;${formatPDFCurrency(Math.abs(profile.openingBalance))}` : '—';
            const obColor = isOBDr ? '#dc2626' : '#059669';
            rowsHtml += `
              <tr style="background-color: #f8fafc; font-weight: bold;">
                <td style="padding: 10px 8px; font-size: 12px; color: #000000; white-space: nowrap; vertical-align: top; border: 1.5px solid #000000; font-weight: bold;">
                  ${formatDateOnly(profile.createdAt || new Date())}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; color: #000000; vertical-align: top; border: 1.5px solid #000000; font-weight: bold;">
                  OPENING BALANCE
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626; vertical-align: top; white-space: nowrap; padding-right: 30px; border: 1.5px solid #000000;">
                  ${obDrHtml}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #059669; vertical-align: top; white-space: nowrap; padding-right: 30px; border: 1.5px solid #000000;">
                  ${obCrHtml}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: ${obColor}; vertical-align: top; white-space: nowrap; padding-right: 30px; border: 1.5px solid #000000;">
                  &#8377;${formatPDFCurrency(Math.abs(profile.openingBalance))}
                </td>
              </tr>
            `;
        }

        monthGroups.forEach(group => {
            // Month header row
            rowsHtml += `
              <tr style="background-color: #e8f4f8; font-weight: bold; page-break-after: avoid; break-after: avoid;">
                <td colspan="5" style="padding: 8px 8px 0 8px; font-size: 14px; color: #0f172a; text-align: left; font-weight: bold; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: 0.5px; text-transform: uppercase;">
                  ${group.monthKey}
                </td>
              </tr>
              <tr style="background-color: #e8f4f8; page-break-after: avoid; break-after: avoid;">
                <td colspan="5" style="padding: 0 8px 6px 8px;">
                  <div style="border-bottom: 2px solid #0f52ba; width: 100%;"></div>
                </td>
              </tr>
            `;

            // Transactions rows
            group.transactions.forEach((t, index) => {
                if (t.type === 'dr') {
                    runningBal += (t.amount || 0);
                } else {
                    runningBal -= (t.amount || 0);
                }

                let productLinesHtml = '';
                if (t.productItems && t.productItems.length > 0) {
                    productLinesHtml = t.productItems.map(p => 
                        `<div style="font-size: 12px; color: #000000; margin-top: 2px; padding-left: 0px; font-weight: bold;">${p.sku || p.name} - ${p.qty} X &#8377;${formatPDFCurrency(p.unitPrice)}</div>`
                    ).join('');
                } else if (t.skuLine) {
                    productLinesHtml = `<div style="font-size: 12px; color: #000000; margin-top: 2px; padding-left: 0px; font-weight: bold;">${formatSkuLine(t.skuLine).replace(/\n/g, '<br />')}</div>`;
                }

                const source = t.orderId ? '<span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 1px 4px; border-radius: 3px; font-weight: bold; margin-left: 6px;">ORDER</span>' : '';

                const isDr = t.type === 'dr';
                const drValHtml = isDr 
                    ? `&#8377;${formatPDFCurrency(t.amount)}` 
                    : '';
                const crValHtml = !isDr 
                    ? `&#8377;${formatPDFCurrency(t.amount)}` 
                    : '';

                rowsHtml += `
                  <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};${index === 0 ? ' page-break-before: avoid; break-before: avoid;' : ''}">
                    <td style="padding: 10px 8px; font-size: 12px; color: #000000; white-space: nowrap; vertical-align: top; border: 1.5px solid #000000;">
                      ${formatDateOnly(t.date)}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; color: #000000; vertical-align: top; border: 1.5px solid #000000;">
                      <div style="font-weight: bold; color: #000000;">${t.description || ''} ${source}</div>
                      ${productLinesHtml}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626; vertical-align: top; white-space: nowrap; padding-right: 30px; background-color: #fff5f5; border: 1.5px solid #000000;">
                      ${drValHtml}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #059669; vertical-align: top; white-space: nowrap; padding-right: 30px; background-color: #f0fdf4; border: 1.5px solid #000000;">
                      ${crValHtml}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: ${runningBal >= 0 ? '#059669' : '#dc2626'}; vertical-align: top; white-space: nowrap; padding-right: 30px; border: 1.5px solid #000000;">
                      &#8377;${formatPDFCurrency(Math.abs(runningBal))}
                    </td>
                  </tr>
                `;
            });

            // Month total row
            rowsHtml += `
              <tr style="font-weight: bold; background-color: #ffffff;">
                <td style="padding: 10px 8px; font-size: 13px; color: #000000; font-weight: bold; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border: 1.5px solid #000000;">
                  ${group.monthName} Total
                </td>
                <td style="border: 1.5px solid #000000;"></td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626; padding-right: 30px; background-color: #fff5f5; border: 1.5px solid #000000;">
                  &#8377;${formatPDFCurrency(group.totalDebit)}
                </td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; text-align: right; color: #059669; padding-right: 30px; background-color: #f0fdf4; border: 1.5px solid #000000;">
                  &#8377;${formatPDFCurrency(group.totalCredit)}
                </td>
                <td style="border: 1.5px solid #000000;"></td>
              </tr>
            `;
        });

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${profile.name} (${statementRangeStr})</title>
            <style>
              @page {
                size: auto;
                margin: 0;
              }
              body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #1e293b;
                margin: 0;
                padding: 0;
                font-size: 11px;
                line-height: 1.4;
                background-color: #fff;
              }

              .container {
                width: 100%;
                box-sizing: border-box;
                padding: 0 30px;
              }
              .header-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 60px;
                background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);
                color: #ffffff;
                padding: 12px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 0;
                border-radius: 0;
                z-index: 1000;
              }
              .footer-banner {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 32px;
                background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);
                color: #ffffff;
                padding: 6px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 0;
                border-radius: 0;
                z-index: 1000;
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              }
              .book-now-btn {
                display: inline-block;
                background-color: #ffffff;
                color: #0f52ba;
                font-weight: bold;
                padding: 4px 12px;
                border-radius: 4px;
                text-decoration: none;
                font-size: 11px;
                transition: all 0.2s ease;
                border: 1px solid #ffffff;
              }
              .book-now-btn:hover {
                background-color: #0f52ba;
                color: #ffffff;
                border-color: #ffffff;
              }
              .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
              }
              .header-left h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: 0.5px;
                text-transform: uppercase;
              }
              .header-left p {
                margin: 4px 0 0 0;
                font-size: 11px;
                opacity: 0.9;
                font-weight: 500;
              }
              .header-right {
                text-align: right;
                font-size: 10px;
                font-weight: 500;
              }
              .header-right div {
                margin-bottom: 3px;
              }
              .footer-left-content {
                font-size: 11.5px;
                font-weight: bold;
                letter-spacing: 0.3px;
                text-align: left;
              }
              .footer-right-content {
                font-size: 10.5px;
                font-weight: 500;
                opacity: 0.9;
                text-align: right;
              }
              .profile-section {
                display: flex;
                justify-content: space-between;
                gap: 20px;
                margin-bottom: 20px;
              }
              .profile-card {
                flex: 1;
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
              }
              .profile-card h3 {
                margin: 0 0 10px 0;
                font-size: 12px;
                font-weight: 700;
                color: #0f172a;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 1.5px solid #cbd5e1;
                padding-bottom: 6px;
              }
              .meta-item {
                display: flex;
                margin-bottom: 6px;
              }
              .meta-label {
                width: 100px;
                font-weight: 600;
                color: #64748b;
              }
              .meta-value {
                flex: 1;
                color: #1e293b;
                font-weight: 700;
              }
              .summary-card {
                background-color: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
              }
              .summary-item {
                text-align: center;
                flex: 1;
              }
              .summary-item:not(:last-child) {
                border-right: 1.5px solid #cbd5e1;
              }
              .summary-label {
                font-size: 12px;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
                margin-bottom: 4px;
                letter-spacing: 0.3px;
                white-space: nowrap;
              }
              .summary-value {
                font-size: 18px;
                font-weight: 800;
              }
              .summary-value.dr {
                color: #dc2626;
              }
              .summary-value.cr {
                color: #059669;
              }
              .table-container {
                margin-bottom: 30px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                text-align: left;
              }
              th {
                background-color: #f1f5f9;
                color: #475569;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                padding: 12px 8px;
                border-bottom: 2px solid #cbd5e1;
              }
              td {
                padding: 12px 8px;
                border-bottom: 1px solid #e2e8f0;
                vertical-align: top;
              }
              .footer-section {
                margin-top: 50px;
                border-top: 1px dashed #cbd5e1;
                padding-top: 16px;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                color: #64748b;
              }
              .footer-left {
                font-size: 9.5px;
                line-height: 1.5;
              }
              .footer-right {
                text-align: right;
              }
              .authorized-sig {
                border-top: 1.5px solid #64748b;
                width: 220px;
                text-align: center;
                padding-top: 6px;
                font-size: 11px;
                font-weight: bold;
                color: #1e293b;
                margin-left: auto;
              }
              .preview-bar {
                background-color: #0f172a;
                color: #f8fafc;
                padding: 14px 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #334155;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                margin-bottom: 24px;
                border-radius: 8px;
              }
              .preview-info {
                display: flex;
                align-items: center;
                gap: 12px;
                text-align: left;
              }
              .preview-icon {
                font-size: 24px;
              }
              .preview-info strong {
                font-size: 14px;
                color: #f1f5f9;
              }
              .preview-info p {
                margin: 2px 0 0 0;
                font-size: 12px;
                color: #94a3b8;
              }
              .preview-actions {
                display: flex;
                gap: 8px;
              }
              .preview-btn {
                padding: 8px 16px;
                font-size: 12px;
                font-weight: 700;
                border-radius: 6px;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
              }
              .preview-btn.primary {
                background-color: #2563eb;
                color: white;
              }
              .preview-btn.primary:hover {
                background-color: #1d4ed8;
              }
              .preview-btn.secondary {
                background-color: #334155;
                color: #f1f5f9;
                border: 1px solid #475569;
              }
              .preview-btn.secondary:hover {
                background-color: #475569;
              }
              @media print {
                .no-print {
                  display: none !important;
                }
                body {
                  padding: 0;
                }
                .header-banner {
                  background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%) !important;
                  color: #fff !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .footer-banner {
                  background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%) !important;
                  color: #fff !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                th {
                  background-color: #f1f5f9 !important;
                  color: #475569 !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .profile-card {
                  background-color: #f8fafc !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .summary-card {
                  background-color: #f8fafc !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                tr {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            </style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <script>
              function downloadPDFDirectly() {
                const element = document.body;
                const opt = {
                  margin:       [10, 10, 10, 10],
                  filename:     "${downloadFilename}",
                  image:        { type: 'jpeg', quality: 0.98 },
                  html2canvas:  { 
                    scale: 2, 
                    useCORS: true,
                    ignoreElements: (el) => el.classList.contains('no-print')
                  },
                  jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                html2pdf().from(element).set(opt).save();
              }
            </script>
          </head>
          <body onload="window.print()">
            <div class="header-banner">
              <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                <img src="${logoBase64}" style="height: 56px; width: auto; object-fit: contain; display: block; flex-shrink: 0;" alt="KSK VASU Co Logo" />
                <div>
                  <h1>KSK VASU &amp; Co</h1>
                  <p>Building Materials Service Center &amp; Logistics</p>
                </div>
              </div>
              <div class="header-right">
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-bottom: 3px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"/></svg>
                  <span>+91 94433 50464</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-bottom: 3px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"/></svg>
                  <span>+91 95665 30464</span>
                </div>
                <div style="margin-top: 4px;"><a href="https://www.kskvasu.co.in" target="_blank" style="color: #ffffff; font-weight: 850; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; letter-spacing: 0.3px;">www.kskvasu.co.in</a></div>
              </div>
            </div>
            <div class="footer-banner">
              <div class="footer-left-content">
                <strong>This is the Authorized Digital Statement From KSK VASU &amp; Co</strong>
              </div>
              <div class="footer-right-content">
                <a href="https://order.kskvasu.co.in/" target="_blank" class="book-now-btn">Book Now</a>
              </div>
            </div>

            <div class="preview-bar no-print">
              <div class="preview-info">
                <span class="preview-icon">📄</span>
                <div>
                  <strong>Ledger Statement Preview</strong>
                  <p>This is a certified digital account ledger. You can print, save as PDF, or copy a share link.</p>
                </div>
              </div>
              <div class="preview-actions">
                <button class="preview-btn primary" onclick="downloadPDFDirectly()">
                  📥 Download PDF
                </button>
                <button class="preview-btn secondary" onclick="window.print()">
                  🖨️ Print
                </button>
                <button class="preview-btn secondary" onclick="copyShareLink()">
                  🔗 Copy Share Link
                </button>
              </div>
            </div>
            <div class="container">
              <table style="width: 100%; border: none; border-collapse: collapse;">
                <thead>
                  <tr>
                    <td style="border: none; padding: 0; height: 85px;"></td>
                  </tr>
                </thead>
                <tfoot>
                  <tr>
                    <td style="border: none; padding: 0; height: 65px;"></td>
                  </tr>
                </tfoot>
                <tbody>
                  <tr>
                    <td style="border: none; padding: 0;">
                      <div class="profile-section">
                        <div class="profile-card">
                          <h3>Statement Details</h3>
                          <div class="meta-item">
                            <span class="meta-label">Customer Name:</span>
                            <span class="meta-value">${profile.name}</span>
                          </div>
                          <div class="meta-item">
                            <span class="meta-label">Mobile Number:</span>
                            <span class="meta-value">+91 ${profile.mobile || 'N/A'}</span>
                          </div>
                          ${profile.altMobile ? `
                            <div class="meta-item">
                              <span class="meta-label">Alt Mobile:</span>
                              <span class="meta-value">+91 ${profile.altMobile}</span>
                            </div>
                          ` : ''}
                          <div class="meta-item">
                            <span class="meta-label">Address:</span>
                            <span class="meta-value">${profile.address || 'N/A'}</span>
                          </div>
                        </div>
                        <div class="profile-card">
                          <h3>Account Context</h3>
                          <div class="meta-item">
                            <span class="meta-label">Account Type:</span>
                            <span class="meta-value">${profile.ledgerType || 'Customer'}</span>
                          </div>

                          <div class="meta-item">
                            <span class="meta-label">Statement Date:</span>
                            <span class="meta-value">${generatedAtStr}</span>
                          </div>
                          <div class="meta-item">
                            <span class="meta-label">Statement Range:</span>
                            <span class="meta-value">${statementRangeStr}</span>
                          </div>
                        </div>
                      </div>

                      <div class="summary-card">
                        <div class="summary-item" style="flex: 1.45;">
                          <div class="summary-label">OPENING BALANCE</div>
                          <div class="summary-value" style="color: ${profile.openingBalanceType === 'credit' ? '#059669' : '#dc2626'};">&#8377;${formatPDFCurrency(profile.openingBalance || 0)} (${profile.openingBalanceType === 'credit' ? 'Credit' : 'Debit'})</div>
                        </div>
                        <div class="summary-item" style="flex: 0.85;">
                          <div class="summary-label">TOTAL DEBIT</div>
                          <div class="summary-value dr">&#8377;${formatPDFCurrency(profile.totalYouGave || 0)}</div>
                        </div>
                        <div class="summary-item" style="flex: 0.85;">
                          <div class="summary-label">TOTAL CREDIT</div>
                          <div class="summary-value cr">&#8377;${formatPDFCurrency(profile.totalYouGot || 0)}</div>
                        </div>
                        <div class="summary-item">
                          <div class="summary-label">Net Balance</div>
                          <div class="summary-value" style="color: ${balanceColor};">&#8377;${formatPDFCurrency(Math.abs(netVal))} (${balanceLabel})</div>
                          <div style="font-size: 11px; font-weight: bold; color: ${balanceColor}; margin-top: 4px;">${netVal === 0 ? 'Settled' : netVal < 0 ? `${profile.name} Will Give` : `${profile.name} Got`}</div>
                        </div>
                      </div>

                      <div class="table-container">
                        <div style="font-size: 11.5px; font-weight: bold; margin-bottom: 8px; color: #1e293b; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">No. of Entries: ${chronological.length} (All)</div>
                        <table>
                          <thead>
                            <tr>
                              <th style="width: 15%;">Date</th>
                              <th style="width: 45%;">Details</th>
                              <th style="width: 13%; text-align: right; padding-right: 30px;">Debit</th>
                              <th style="width: 13%; text-align: right; padding-right: 30px;">Credit</th>
                              <th style="width: 14%; text-align: right; padding-right: 30px;">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${rowsHtml}
                          </tbody>
                        </table>
                      </div>

                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <script>
              function copyShareLink() {
                const url = window.opener ? window.opener.location.href : window.location.href;
                navigator.clipboard.writeText(url).then(function() {
                  alert("Ledger share link copied to clipboard successfully!");
                }).catch(function() {
                  alert("Failed to copy link.");
                });
              }
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 1000); // 1 second delay so they can see the preview first
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.opener = null; // Detach to prevent blocking parent event loop
    };

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={glassCardStyle}>
                    <div style={spinnerStyle}></div>
                    <p style={{ color: '#64748b', fontWeight: 600, marginTop: '16px' }}>Loading customer statement...</p>
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div style={containerStyle}>
                <div style={errorCardStyle}>
                    <h3 style={{ color: '#ef4444', margin: '0 0 10px' }}>⚠️ Error Loading Ledger Profile</h3>
                    <p style={{ color: '#4b5563', margin: '0 0 20px' }}>{error || 'Customer profile not found.'}</p>
                    <button style={secondaryBtnStyle} onClick={() => navigate(`${basePath}/ledger`)}>Back to List</button>
                </div>
            </div>
        );
    }

    const netBal = profile.netBalance;
    const isDue = netBal < 0;

    // Calculate Date-Range Scoped Report values
    let reportOpeningBalance = 0;
    let reportTotalDebit = 0;
    let reportTotalCredit = 0;
    let reportClosingBalance = 0;
    let reportScopedTx = [];

    if (isReportActive && reportFromDate && reportToDate) {
        const chronological = [...transactions].reverse();
        const start = new Date(reportFromDate + 'T00:00:00');
        const end = new Date(reportToDate + 'T23:59:59');

        // Calculate opening balance as: static profile opening balance + unclosed transactions prior to start date
        let initialBalance = profile.openingBalanceType === 'credit' ? (profile.openingBalance || 0) : -(profile.openingBalance || 0);
        chronological.forEach(t => {
            if (t.isOpeningBalance) return;
            const d = new Date(t.date);
            if (d < start && !t.isClosed) {
                if (t.type === 'dr') {
                    initialBalance -= (t.amount || 0);
                } else {
                    initialBalance += (t.amount || 0);
                }
            }
        });
        reportOpeningBalance = initialBalance;

        // Scoped transactions (excluding virtual opening balance and closed transactions)
        const scoped = chronological.filter(t => {
            if (t.isOpeningBalance) return false;
            if (t.isClosed) return false;
            const d = new Date(t.date);
            return d >= start && d <= end;
        });

        let runningVal = reportOpeningBalance;
        reportScopedTx = scoped.map(t => {
            if (t.type === 'dr') {
                reportTotalDebit += (t.amount || 0);
                runningVal -= (t.amount || 0);
            } else {
                reportTotalCredit += (t.amount || 0);
                runningVal += (t.amount || 0);
            }
            return {
                ...t,
                scopedRunningBalance: runningVal
            };
        });
        reportClosingBalance = runningVal;
    }

    // Build dynamic UPI payment URL
    const finalPaymentAmount = customQrAmount || Math.abs(netBal).toFixed(2);
    // Standard UPI string: upi://pay?pa=kskvasuco@oksbi&pn=KSK%20VASU%20%26%20Co&am=AMOUNT&cu=INR
    const dynamicUpiUrl = `upi://pay?pa=kskvasuco@oksbi&pn=KSK%20VASU%20%26%20Co&am=${finalPaymentAmount}&cu=INR`;
    const dynamicQrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(dynamicUpiUrl)}`;

    return (
        <div style={containerStyle}>
            {/* Breadcrumb Header */}
            <div style={headerSectionStyle}>
                <div>
                    <button style={backLinkBtnStyle} onClick={() => navigate(`${basePath}/ledger`)}>
                        ⬅️ Back to Ledger Dashboard
                    </button>
                    <h2 style={titleStyle}>{profile.name}</h2>
                    <p style={subtitleStyle}>{profile.ledgerType} ledger and transaction history statement.</p>
                </div>
                
                <div style={actionButtonGroupStyle}>
                    <button style={whatsappBtnStyle} onClick={handleSendWhatsApp}>
                        💬 WhatsApp Reminder
                    </button>
                    <button style={pdfBtnStyle} onClick={openReportModal}>
                        📄 Report
                    </button>
                    <button style={qrTriggerBtnStyle} onClick={openQrModal}>
                        💳 Show UPI QR
                    </button>
                </div>
            </div>

            {isReportActive ? (
                /* RENDER SCOPED REPORT VIEW */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Scoped Summary Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1.45fr 0.85fr 0.85fr 0.85fr',
                        gap: '16px',
                        marginBottom: '8px'
                    }}>
                        <div style={{
                            ...glassCardStyle,
                            padding: '20px',
                            textAlign: 'center',
                            borderLeft: `4px solid ${reportOpeningBalance >= 0 ? '#10b981' : '#ef4444'}`
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', whiteSpace: 'nowrap' }}>Opening Balance ({formatDateOnly(reportFromDate)})</div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: reportOpeningBalance >= 0 ? '#059669' : '#dc2626' }}>
                                ₹{Math.abs(reportOpeningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style={{ ...glassCardStyle, padding: '20px', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Total You Gave</div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626' }}>
                                ₹{reportTotalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style={{ ...glassCardStyle, padding: '20px', textAlign: 'center', borderLeft: '4px solid #10b981' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Total You Got</div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>
                                ₹{reportTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style={{
                            ...glassCardStyle,
                            padding: '20px',
                            textAlign: 'center',
                            borderLeft: `4px solid ${reportClosingBalance >= 0 ? '#10b981' : '#ef4444'}`
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>NET BALANCE</div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: reportClosingBalance >= 0 ? '#059669' : '#dc2626' }}>
                                ₹{Math.abs(reportClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    {/* Table of Scoped Transactions */}
                    <div style={glassCardStyle}>
                        <h3 style={{ ...cardSectionTitleStyle, marginBottom: '20px' }}>📄 Scoped Transactions ({formatDateOnly(reportFromDate)} to {formatDateOnly(reportToDate)})</h3>
                        <div style={tableWrapperStyle}>
                            <table style={tableStyle}>
                                <thead>
                                    <tr style={tableHeaderRowStyle}>
                                        <th style={{ ...thStyle, width: '15%' }}>Date</th>
                                        <th style={{ ...thStyle, width: '45%' }}>Description</th>
                                        <th style={{ ...thStyle, width: '13%', textAlign: 'right' }}>You Gave</th>
                                        <th style={{ ...thStyle, width: '13%', textAlign: 'right' }}>You Got</th>
                                        <th style={{ ...thStyle, width: '14%', textAlign: 'right' }}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportOpeningBalance !== undefined && (
                                        <tr style={{
                                            ...trStyle,
                                            backgroundColor: '#f8fafc',
                                            fontWeight: 'bold',
                                            borderBottom: '2px solid #cbd5e1'
                                        }}>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#475569', fontWeight: '800' }}>
                                                {formatDateOnly(reportFromDate)}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ fontWeight: '800', color: '#1e293b' }}>
                                                    OPENING BALANCE
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                                                {reportOpeningBalance < 0 ? `₹${Math.abs(reportOpeningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                                                {reportOpeningBalance >= 0 ? `₹${Math.abs(reportOpeningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: reportOpeningBalance >= 0 ? '#059669' : '#dc2626' }}>
                                                ₹{Math.abs(reportOpeningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                    {reportScopedTx.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ ...noDataStyle, padding: '40px' }}>
                                                No transactions found in this date range.
                                            </td>
                                        </tr>
                                    ) : (
                                        reportScopedTx.map((t, idx) => {
                                            const isDr = t.type === 'dr';
                                            
                                            // Handle products display
                                            let productLines = null;
                                            if (t.productItems && t.productItems.length > 0) {
                                                productLines = (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', paddingLeft: '0px' }}>
                                                        {t.productItems.map((p, pIdx) => (
                                                            <span key={pIdx} style={{ fontSize: '14px', color: '#1e293b', fontWeight: 'bold', whiteSpace: 'pre-line', display: 'block' }}>
                                                                {p.sku || p.name} - {p.qty ? `${p.qty} X ` : ''}₹{(p.unitPrice || 0).toLocaleString('en-IN')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            } else if (t.skuLine) {
                                                productLines = (
                                                    <div style={{ marginTop: '6px', paddingLeft: '0px' }}>
                                                        <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 'bold', whiteSpace: 'pre-line', display: 'block' }}>
                                                            {formatSkuLine(t.skuLine).split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <tr key={t._id} style={{
                                                    ...trStyle,
                                                    opacity: t.isClosed ? 0.55 : 1,
                                                    backgroundColor: t.isClosed ? '#f8fafc' : (isDr ? '#fef2f2' : '#f0fdf4')
                                                }}>
                                                    <td style={tdStyle}>{formatDateOnly(t.date)}</td>
                                                    <td style={tdStyle}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontWeight: '700', color: '#1e293b' }}>
                                                                {t.description || ''}
                                                            </span>
                                                            {t.orderId && (
                                                                <span style={{ fontSize: '9px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                                    ORDER
                                                                </span>
                                                            )}
                                                            {t.isClosed && (
                                                                <span style={{ fontSize: '9px', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                                    🔒 Closed
                                                                </span>
                                                            )}
                                                        </div>
                                                        {productLines}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                                                        {isDr ? `₹${(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                                                        {!isDr ? `₹${(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: t.scopedRunningBalance >= 0 ? '#059669' : '#dc2626' }}>
                                                        ₹{Math.abs(t.scopedRunningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Report Bottom Action Buttons */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            marginTop: '24px',
                            borderTop: '1px solid #e2e8f0',
                            paddingTop: '16px'
                        }}>
                            <button style={secondaryBtnStyle} onClick={() => setIsReportActive(false)}>
                                ⬅️ Back to Full Ledger
                            </button>
                            <button
                                style={{ ...submitCrBtnStyle, background: '#059669', boxShadow: '0 4px 10px rgba(5,150,105,0.2)' }}
                                onClick={() => {
                                    setPdfOptionsStep('select_totals');
                                    setFinalTotalDate(reportToDate || new Date().toISOString().split('T')[0]);
                                    setIsPdfOptionsModalOpen(true);
                                }}
                            >
                                🖨️ Download / Print Scoped PDF
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Profile Detail Cards & Quick Bookings */}
            <div style={profileGridStyle}>
                {/* 1. Customer card */}
                <div style={{ ...glassCardStyle, padding: '16px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ ...cardSectionTitleStyle, margin: 0, fontSize: '15px' }}>👤 {profile.ledgerType} Profile</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={{ ...editProfileBtnStyle, background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: 'white', border: 'none' }} onClick={openDuplicateModal}>👯 Duplicate</button>
                            <button style={editProfileBtnStyle} onClick={openEditProfile}>✏️ Profile</button>
                            <button style={{ ...closeBalanceBtnStyle, background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', border: '1px solid rgba(79, 70, 229, 0.25)' }} onClick={openRecycleBin}>🗑️ Bin</button>
                            <button style={closeBalanceBtnStyle} onClick={openCloseBalance}>🔒 Close Balance</button>
                        </div>
                    </div>
                    <div style={profileDetailListStyle}>
                        <div style={profileDetailItemStyle}>
                            <span style={profileDetailLabelStyle}>Mobile</span>
                            <span style={profileDetailValStyle}>📱 +91 {profile.mobile}</span>
                        </div>
                        {profile.altMobile && (
                            <div style={profileDetailItemStyle}>
                                <span style={profileDetailLabelStyle}>Alternative Mobile</span>
                                <span style={profileDetailValStyle}>📱 +91 {profile.altMobile}</span>
                            </div>
                        )}
                        <div style={profileDetailItemStyle}>
                            <span style={profileDetailLabelStyle}>District</span>
                            <span style={profileDetailValStyle}>📍 {profile.district || 'Not Provided'}</span>
                        </div>
                        <div style={profileDetailItemStyle}>
                            <span style={profileDetailLabelStyle}>Taluk</span>
                            <span style={profileDetailValStyle}>📍 {profile.taluk || 'Not Provided'}</span>
                        </div>
                        {profile.address && (
                            <div style={{ ...profileDetailItemStyle, gridColumn: 'span 2' }}>
                                <span style={profileDetailLabelStyle}>Address</span>
                                <span style={profileDetailValStyle}>🏠 {profile.address}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Outstanding Balance display card */}
                <div style={{
                    ...glassCardStyle,
                    padding: '16px 24px',
                    borderLeft: `6px solid ${netBal >= 0 ? '#10b981' : '#ef4444'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h4 style={{ ...cardSectionTitleStyle, fontSize: '15px' }}>💰 Current Ledger Balance</h4>
                        <h2 style={{
                            ...statValueStyle,
                            color: netBal >= 0 ? '#059669' : '#dc2626',
                            fontSize: '40px',
                            margin: '8px 0 0'
                        }}>
                            ₹{Math.abs(netBal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <span style={{ fontSize: '16px', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>
                                {isDue ? ` (${profile.ledgerType} Owes Us / Due)` : netBal > 0 ? ` (We Owe ${profile.ledgerType} / Advance)` : ' (Symmetrical Settle)'}
                            </span>
                        </h2>
                    </div>
                    
                    <div style={bookingControlsStyle}>
                        <button style={bookingGiveBtnStyle} onClick={openDrModal}>
                            🔴 You Gave
                        </button>
                        <button style={bookingGetBtnStyle} onClick={openCrModal}>
                            🟢 You Got
                        </button>
                    </div>
                </div>
            </div>

            {/* Statement Ledger History List */}
            <div style={glassCardStyle}>
                <h3 style={{ ...cardSectionTitleStyle, marginBottom: '20px' }}>📊 Ledger Statement</h3>
                <div style={tableWrapperStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={tableHeaderRowStyle}>
                                <th style={{ ...thStyle, width: '18%' }}>Date</th>
                                <th style={{ ...thStyle, width: '46%' }}>Entries</th>
                                <th style={{ ...thStyle, width: '12%', textAlign: 'right' }}>You Gave</th>
                                <th style={{ ...thStyle, width: '12%', textAlign: 'right' }}>You Got</th>
                                <th style={{ ...thStyle, width: '12%', textAlign: 'right' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={noDataStyle}>
                                        No ledger entries recorded yet. Transactions, advances, or deliveries will backfill automatically.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t, index) => {
                                    const isDr = t.type === 'dr';
                                    const showDayHeader = index === 0 || !isSameDay(t.date, transactions[index - 1].date);
                                    const isRowEditable = t.isManual && !t.isClosed;

                                    return (
                                        <React.Fragment key={t._id}>
                                            {showDayHeader && (
                                                <tr>
                                                    <td colSpan="5" style={dayGroupHeaderStyle}>
                                                        <span style={dayGroupBadgeStyle}>
                                                            {getFriendlyDayLabel(t.date)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )}
                                            <tr 
                                                onClick={isRowEditable ? () => openEditTransaction(t) : undefined}
                                                style={{ 
                                                    ...trStyle, 
                                                    opacity: t.isClosed ? 0.45 : 1, 
                                                    backgroundColor: t.isClosed ? '#f8fafc' : (isDr ? '#fef2f2' : '#f0fdf4'),
                                                    cursor: isRowEditable ? 'pointer' : 'default',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (isRowEditable) e.currentTarget.style.backgroundColor = isDr ? '#fee2e2' : '#dcfce7';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (isRowEditable) e.currentTarget.style.backgroundColor = t.isClosed ? '#f8fafc' : (isDr ? '#fef2f2' : '#f0fdf4');
                                                }}
                                                title={isRowEditable ? 'Click to edit transaction' : undefined}
                                            >
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#475569', fontWeight: '600', fontSize: '13px' }}>
                                                    {formatDateHyphenated(t.date)} - {formatTimeOnly(t.date)}
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{t.description}</span>
                                                        {t.deleteRequest?.status === 'pending' && (
                                                            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    fontSize: '11px',
                                                                    fontWeight: '700',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    background: '#fef3c7',
                                                                    color: '#d97706',
                                                                    border: '1px solid #fde68a'
                                                                }}>
                                                                    ⏳ Pending Deletion ({t.deleteRequest.requestedBy || 'Staff'})
                                                                </span>
                                                                {!isStaff ? (
                                                                    <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                                                        <button
                                                                            style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                            onClick={() => handleApproveDelete(t._id)}
                                                                        >
                                                                            Approve ✅
                                                                        </button>
                                                                        <button
                                                                            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                            onClick={() => handleRejectDelete(t._id)}
                                                                        >
                                                                            Reject ❌
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>⏳ Pending Approval</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {t.isClosed && (
                                                            <span style={{
                                                                display: 'inline-block',
                                                                fontSize: '11px',
                                                                fontWeight: 'bold',
                                                                marginTop: '4px',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                alignSelf: 'flex-start',
                                                                background: '#e2e8f0',
                                                                color: '#64748b',
                                                                border: '1px solid #cbd5e1'
                                                            }}>
                                                                🔒 Closed
                                                            </span>
                                                        )}
                                                        {t.orderId && (
                                                            <span style={{ fontSize: '11px', color: '#11998e', fontWeight: 'bold' }}>
                                                                Order ID: {t.orderId}
                                                            </span>
                                                        )}
                                                        {t.skuLine && (
                                                            <span style={{
                                                                fontWeight: 'bold',
                                                                color: '#1e293b',
                                                                marginTop: '2px',
                                                                whiteSpace: 'pre-line',
                                                                display: 'block'
                                                            }}>
                                                                {formatSkuLine(t.skuLine).split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                    {isDr ? (
                                                        <span style={drAmountStyle}>
                                                            ₹{formatCurrencyNoDecimals(t.amount)}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#cbd5e1' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                    {!isDr ? (
                                                        <span style={crAmountStyle}>
                                                            ₹{formatCurrencyNoDecimals(t.amount)}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#cbd5e1' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: t.runningBalance >= 0 ? '#059669' : '#dc2626' }}>
                                                    ₹{Math.abs(t.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══════════════════════════════════════════
               MODAL: YOU GAVE (You Gave / Sales Booking)
            ═══════════════════════════════════════════ */}
            {isDrModalOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsDrModalOpen(false)}>
                    <div style={ledgerEntryModalContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#dc2626' }}>🔴 You Gave Entry</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsDrModalOpen(false)}>✕</button>
                        </div>
                        <div style={ledgerEntryModalBodyStyle}>
                            <div style={{ ...formGroupStyle, borderBottom: '1px dashed #cbd5e1', paddingBottom: '16px', marginBottom: '16px' }}>
                                <label style={{ ...formLabelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={useProductPicker} 
                                        onChange={(e) => setUseProductPicker(e.target.checked)} 
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                    <span>🛍️ Select Products from Inventory</span>
                                </label>
                            </div>

                            {useProductPicker && (
                                <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>Product Picker</h4>
                                    <select
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!val) return;
                                            const p = products.find(prod => prod._id === val);
                                            if (p) {
                                                setSelectedProducts(prev => {
                                                    const existing = prev.find(item => item.product._id === p._id);
                                                    let next;
                                                    if (existing) {
                                                        next = prev;
                                                    } else {
                                                        next = [...prev, { product: p, qty: '', price: p.price }];  // start empty so user can type qty immediately
                                                    }
                                                    syncAmountFromSelectedProducts(next);
                                                    return next;
                                                });
                                            }
                                            e.target.value = ''; // Reset select dropdown
                                        }}
                                        style={{ ...formInputStyle, marginBottom: '12px', fontSize: '14px', cursor: 'pointer' }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>➕ Choose a product to add...</option>
                                        {availableProductsForPicker.map(p => (
                                            <option key={p._id} value={p._id}>
                                                {p.name} {p.sku ? `(${p.sku})` : ''} — ₹{p.price}
                                            </option>
                                        ))}
                                    </select>


                                    {/* ── Custom Product Entry ── */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => { setShowCustomProductForm(v => !v); setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty(''); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1.5px dashed #6366f1', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#6366f1', fontWeight: '600', fontSize: '12px', width: '100%', justifyContent: 'center' }}
                                        >
                                            ✏️ {showCustomProductForm ? 'Cancel Custom Item' : 'Add Custom Item'}
                                        </button>
                                        {showCustomProductForm && (
                                            <div style={{ marginTop: '8px', padding: '10px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '8px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '6px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Item / Product name"
                                                        value={customProductName}
                                                        onChange={e => setCustomProductName(e.target.value)}
                                                        style={{ padding: '6px 10px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                                                    />
                                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <span style={{ position: 'absolute', left: '7px', fontSize: '11px', color: '#6366f1', fontWeight: '700' }}>₹</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Price"
                                                            value={customProductPrice}
                                                            onChange={e => setCustomProductPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                                                            style={{ width: '75px', padding: '6px 8px 6px 18px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'right' }}
                                                        />
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        placeholder="Qty"
                                                        value={customProductQty}
                                                        onChange={e => setCustomProductQty(e.target.value.replace(/[^0-9]/g, ''))}
                                                        style={{ width: '50px', padding: '6px 8px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'center' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const name = customProductName.trim();
                                                            const price = parseFloat(customProductPrice) || 0;
                                                            const qty = customProductQty === '' ? '' : (parseInt(customProductQty, 10) || 1);
                                                            if (!name) return;
                                                            const customId = 'custom_' + Date.now();
                                                            setSelectedProducts(prev => {
                                                                const next = [...prev, { product: { _id: customId, name, sku: '', price, isCustom: true }, qty, price }];
                                                                syncAmountFromSelectedProducts(next);
                                                                return next;
                                                            });
                                                            setShowCustomProductForm(false);
                                                            setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty('');
                                                        }}
                                                        style={{ padding: '6px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {selectedProducts.length > 0 ? (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Selected Items:</div>
                                            {selectedProducts.map(({ product, qty, price }) => (
                                                <div key={product._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '6px', fontSize: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                                    <span style={{ flex: 1, fontWeight: '600', color: '#1e293b' }}>
                                                        {product.name} {product.sku ? <span style={{ color: '#64748b', fontWeight: '400', fontSize: '11px', marginLeft: '4px' }}>({product.sku})</span> : ''}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                            <span style={{ position: 'absolute', left: '8px', color: '#94a3b8', fontWeight: '600', fontSize: '11px' }}>₹</span>
                                                            <input 
                                                                type="number"
                                                                value={price !== undefined ? price : product.price}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                                    const parts = raw.split('.');
                                                                    if (parts.length > 2) return;
                                                                    if (parts[1] && parts[1].length > 2) return;
                                                                    const val = parseFloat(raw) || 0;
                                                                    if (val > 99999999) return;
                                                                    setSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                                                        syncAmountFromSelectedProducts(next);
                                                                        return next;
                                                                    });
                                                                }}
                                                                style={{ width: '80px', padding: '6px 8px 6px 18px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', textAlign: 'right', outline: 'none' }}
                                                            />
                                                        </div>
                                                        <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '12px' }}>×</span>
                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <input 
                                                                type="number" 
                                                                min="1"
                                                                value={qty === '' || qty == null || qty === 0 || qty === '0' ? '' : qty} 
                                                                onChange={(e) => {
                                                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                                    const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseFloat(raw) || 0);
                                                                    setSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                                                        syncAmountFromSelectedProducts(next);
                                                                        return next;
                                                                    });
                                                                }}
                                                                style={{ width: '55px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', textAlign: 'center', outline: 'none' }}
                                                            />
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedProducts(prev => {
                                                                    const next = prev.filter(item => item.product._id !== product._id);
                                                                    syncAmountFromSelectedProducts(next);
                                                                    return next;
                                                                });
                                                            }}
                                                            style={{ padding: '2px 6px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {calculateSelectedProductsTotal(selectedProducts) > 0 ? (
                                                <div style={{ marginTop: '10px', textAlign: 'right', fontWeight: '700', fontSize: '14px', color: '#dc2626' }}>
                                                    Total: ₹{formatCurrencyNoDecimals(calculateSelectedProductsTotal(selectedProducts))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                                            No products selected yet. Search above to add.
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Amount (INR) *</label>
                                <input
                                    type="text"
                                    placeholder="Enter amount (editable even with products selected)"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    style={formInputStyle}
                                    autoFocus={!useProductPicker}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Description / Notes *</label>
                                <textarea
                                    placeholder="e.g. Manual sales dispatch, custom charge extension, etc."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={formTextareaStyle}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Date / Time (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={transactionDate}
                                    onChange={(e) => setTransactionDate(e.target.value)}
                                    style={formInputStyle}
                                />
                            </div>

                            <div style={modalFooterStyle}>
                                <button style={secondaryBtnStyle} onClick={() => setIsDrModalOpen(false)}>Cancel</button>
                                <button 
                                    style={submitDrBtnStyle} 
                                    onClick={() => handleAddTransaction('dr')}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Adding...' : 'Confirm You Gave'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
               MODAL: YOU GOT (You Got / Payments Booking)
            ═══════════════════════════════════════════ */}
            {isCrModalOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsCrModalOpen(false)}>
                    <div style={ledgerEntryModalContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#059669' }}>🟢 You Got Entry</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsCrModalOpen(false)}>✕</button>
                        </div>
                        <div style={ledgerEntryModalBodyStyle}>
                            <div style={{ ...formGroupStyle, borderBottom: '1px dashed #cbd5e1', paddingBottom: '16px', marginBottom: '16px' }}>
                                <label style={{ ...formLabelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={useProductPicker} 
                                        onChange={(e) => setUseProductPicker(e.target.checked)} 
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                    <span>🛍️ Select Products from Inventory</span>
                                </label>
                            </div>

                            {useProductPicker && (
                                <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>Product Picker</h4>
                                    <select
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!val) return;
                                            const p = products.find(prod => prod._id === val);
                                            if (p) {
                                                setSelectedProducts(prev => {
                                                    const existing = prev.find(item => item.product._id === p._id);
                                                    let next;
                                                    if (existing) {
                                                        next = prev;
                                                    } else {
                                                        next = [...prev, { product: p, qty: '', price: p.price }];  // start empty so user can type qty immediately
                                                    }
                                                    syncAmountFromSelectedProducts(next);
                                                    return next;
                                                });
                                            }
                                            e.target.value = ''; // Reset select dropdown
                                        }}
                                        style={{ ...formInputStyle, marginBottom: '12px', fontSize: '14px', cursor: 'pointer' }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>➕ Choose a product to add...</option>
                                        {availableProductsForPicker.map(p => (
                                            <option key={p._id} value={p._id}>
                                                {p.name} {p.sku ? `(${p.sku})` : ''} — ₹{p.price}
                                            </option>
                                        ))}
                                    </select>


                                    {/* ── Custom Product Entry ── */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => { setShowCustomProductForm(v => !v); setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty(''); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1.5px dashed #6366f1', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#6366f1', fontWeight: '600', fontSize: '12px', width: '100%', justifyContent: 'center' }}
                                        >
                                            ✏️ {showCustomProductForm ? 'Cancel Custom Item' : 'Add Custom Item'}
                                        </button>
                                        {showCustomProductForm && (
                                            <div style={{ marginTop: '8px', padding: '10px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '8px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '6px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Item / Product name"
                                                        value={customProductName}
                                                        onChange={e => setCustomProductName(e.target.value)}
                                                        style={{ padding: '6px 10px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                                                    />
                                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <span style={{ position: 'absolute', left: '7px', fontSize: '11px', color: '#6366f1', fontWeight: '700' }}>₹</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Price"
                                                            value={customProductPrice}
                                                            onChange={e => setCustomProductPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                                                            style={{ width: '75px', padding: '6px 8px 6px 18px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'right' }}
                                                        />
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        placeholder="Qty"
                                                        value={customProductQty}
                                                        onChange={e => setCustomProductQty(e.target.value.replace(/[^0-9]/g, ''))}
                                                        style={{ width: '50px', padding: '6px 8px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'center' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const name = customProductName.trim();
                                                            const price = parseFloat(customProductPrice) || 0;
                                                            const qty = customProductQty === '' ? '' : (parseInt(customProductQty, 10) || 1);
                                                            if (!name) return;
                                                            const customId = 'custom_' + Date.now();
                                                            setSelectedProducts(prev => {
                                                                const next = [...prev, { product: { _id: customId, name, sku: '', price, isCustom: true }, qty, price }];
                                                                syncAmountFromSelectedProducts(next);
                                                                return next;
                                                            });
                                                            setShowCustomProductForm(false);
                                                            setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty('');
                                                        }}
                                                        style={{ padding: '6px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {selectedProducts.length > 0 ? (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Selected Items:</div>
                                            {selectedProducts.map(({ product, qty, price }) => (
                                                <div key={product._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '6px', fontSize: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                                    <span style={{ flex: 1, fontWeight: '600', color: '#1e293b' }}>
                                                        {product.name} {product.sku ? <span style={{ color: '#64748b', fontWeight: '400', fontSize: '11px', marginLeft: '4px' }}>({product.sku})</span> : ''}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                            <span style={{ position: 'absolute', left: '8px', color: '#94a3b8', fontWeight: '600', fontSize: '11px' }}>₹</span>
                                                            <input 
                                                                type="number"
                                                                value={price !== undefined ? price : product.price}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                                    const parts = raw.split('.');
                                                                    if (parts.length > 2) return;
                                                                    if (parts[1] && parts[1].length > 2) return;
                                                                    const val = parseFloat(raw) || 0;
                                                                    if (val > 99999999) return;
                                                                    setSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                                                        syncAmountFromSelectedProducts(next);
                                                                        return next;
                                                                    });
                                                                }}
                                                                style={{ width: '80px', padding: '6px 8px 6px 18px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', textAlign: 'right', outline: 'none' }}
                                                            />
                                                        </div>
                                                        <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '12px' }}>×</span>
                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <input 
                                                                type="number" 
                                                                min="1"
                                                                value={qty === '' || qty == null || qty === 0 || qty === '0' ? '' : qty} 
                                                                onChange={(e) => {
                                                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                                    const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseFloat(raw) || 0);
                                                                    setSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                                                        syncAmountFromSelectedProducts(next);
                                                                        return next;
                                                                    });
                                                                }}
                                                                style={{ width: '55px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', textAlign: 'center', outline: 'none' }}
                                                            />
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedProducts(prev => {
                                                                    const next = prev.filter(item => item.product._id !== product._id);
                                                                    syncAmountFromSelectedProducts(next);
                                                                    return next;
                                                                });
                                                            }}
                                                            style={{ padding: '2px 6px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {calculateSelectedProductsTotal(selectedProducts) > 0 ? (
                                                <div style={{ marginTop: '10px', textAlign: 'right', fontWeight: '700', fontSize: '14px', color: '#059669' }}>
                                                    Total: ₹{formatCurrencyNoDecimals(calculateSelectedProductsTotal(selectedProducts))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                                            No products selected yet. Search above to add.
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Amount (INR) *</label>
                                <input
                                    type="text"
                                    placeholder="Enter amount (editable even with products selected)"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    style={formInputStyle}
                                    autoFocus={!useProductPicker}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Description / Notes *</label>
                                <textarea
                                    placeholder="e.g. Received GPay payment, cash advance, bank transfer"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={formTextareaStyle}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Date / Time (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={transactionDate}
                                    onChange={(e) => setTransactionDate(e.target.value)}
                                    style={formInputStyle}
                                />
                            </div>

                            <div style={modalFooterStyle}>
                                <button style={secondaryBtnStyle} onClick={() => setIsCrModalOpen(false)}>Cancel</button>
                                <button 
                                    style={submitCrBtnStyle} 
                                    onClick={() => handleAddTransaction('cr')}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Adding...' : 'Confirm You Got'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
               MODAL: PREMIUM UPI QR CODE OVERLAY
            ═══════════════════════════════════════════ */}
            {isQrModalOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsQrModalOpen(false)}>
                    <div style={{ ...modalContentStyle, maxWidth: '450px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ ...modalHeaderStyle, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <h3 style={{ margin: 0, color: '#38ef7d' }}>💳 UPI Payment QR Overlay</h3>
                            <button style={{ ...modalCloseBtnStyle, color: 'white' }} onClick={() => setIsQrModalOpen(false)}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
                            
                            {/* Option 1: Saved Payment Bank / QR settings */}
                            {paymentSettings.length > 0 && (
                                <div style={formGroupStyle}>
                                    <label style={{ ...formLabelStyle, color: '#94a3b8' }}>Select Payee Bank Account / QR</label>
                                    <select
                                        value={selectedPaymentSetting ? selectedPaymentSetting._id : ''}
                                        onChange={(e) => {
                                            const set = paymentSettings.find(p => p._id === e.target.value);
                                            setSelectedPaymentSetting(set);
                                        }}
                                        style={{ ...formInputStyle, background: '#1e293b', border: '1px solid #475569', color: 'white' }}
                                    >
                                        {paymentSettings.map(setting => (
                                            <option key={setting._id} value={setting._id}>
                                                {setting.name} ({setting.type === 'bank' ? 'Bank AC' : 'UPI QR'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Option 2: Dynamic Amount adjustment */}
                            <div style={formGroupStyle}>
                                <label style={{ ...formLabelStyle, color: '#94a3b8' }}>Payment Amount (INR)</label>
                                <input
                                    type="text"
                                    placeholder={Math.abs(netBal).toFixed(2)}
                                    value={customQrAmount}
                                    onChange={handleQrAmountChange}
                                    style={{ ...formInputStyle, background: '#1e293b', border: '1px solid #475569', color: 'white' }}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Defaults to customer outstanding balance.</span>
                            </div>

                            {/* Render QR Image Card Block */}
                            <div style={qrDisplayCardStyle}>
                                {selectedPaymentSetting && selectedPaymentSetting.qrCode ? (
                                    // Saved system QR Code uploaded in Settings
                                    <div style={{ textAlign: 'center' }}>
                                        <img 
                                            src={selectedPaymentSetting.qrCode} 
                                            alt={selectedPaymentSetting.name} 
                                            style={qrImgStyle} 
                                        />
                                        <h4 style={{ margin: '12px 0 2px', fontWeight: 700 }}>{selectedPaymentSetting.name}</h4>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#a7f3d0' }}>
                                            Scan saved QR code image to pay.
                                        </p>
                                    </div>
                                ) : (
                                    // Dynamic Canvas-style generated UPI link (zero-dependency)
                                    <div style={{ textAlign: 'center' }}>
                                        <img 
                                            src={dynamicQrImgSrc} 
                                            alt="Dynamic UPI QR" 
                                            style={qrImgStyle} 
                                        />
                                        <h4 style={{ margin: '12px 0 2px', fontWeight: 700 }}>₹{finalPaymentAmount}</h4>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', wordBreak: 'break-all' }}>
                                            Payee: KSK VASU & Co (kskvasuco@oksbi)
                                        </p>
                                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#38ef7d', fontWeight: 600 }}>
                                            Scan using PhonePe / GPay / Paytm
                                        </p>
                                    </div>
                                )}
                            </div>

                            {selectedPaymentSetting && selectedPaymentSetting.type === 'bank' && (
                                <div style={bankDetailsCardStyle}>
                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', fontWeight: 700 }}>Bank Account Details</span>
                                    <h4 style={{ margin: '4px 0 2px' }}>{selectedPaymentSetting.bankName}</h4>
                                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                                        <span>AC Name: {selectedPaymentSetting.accountName || 'N/A'}</span>
                                        <span>AC No:   {selectedPaymentSetting.accountNumber}</span>
                                        <span>IFSC:    {selectedPaymentSetting.ifsc}</span>
                                    </div>
                                </div>
                            )}

                            <div style={{ ...modalFooterStyle, borderTop: 'none', padding: '16px 0 0' }}>
                                <button style={{ ...secondaryBtnStyle, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }} onClick={() => setIsQrModalOpen(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </>)}
            {/* ═══════════════════════════════════════════
               MODAL: DUPLICATE CUSTOMER/SUPPLIER
            ═══════════════════════════════════════════ */}
            {isDuplicateModalOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsDuplicateModalOpen(false)}>
                    <div style={{ ...modalContentStyle, maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#4f46e5' }}>👯 Duplicate {profile.ledgerType}</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsDuplicateModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleDuplicateCustomer} style={modalBodyStyle}>
                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={duplicateName}
                                    onChange={(e) => setDuplicateName(e.target.value)}
                                    style={formInputStyle}
                                    placeholder="Enter full name"
                                    autoFocus
                                />
                            </div>
                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>10-Digit Mobile *</label>
                                <input
                                    type="tel"
                                    required
                                    maxLength="10"
                                    value={duplicateMobile}
                                    onChange={(e) => setDuplicateMobile(e.target.value.replace(/\D/g, ''))}
                                    style={formInputStyle}
                                    placeholder="Enter new 10-digit mobile number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                />
                                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                                    Must be a unique 10-digit number. All other details and active ledger transactions will be duplicated.
                                </span>
                            </div>
                            <div style={modalFooterStyle}>
                                <button type="button" style={secondaryBtnStyle} onClick={() => setIsDuplicateModalOpen(false)}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={duplicateSubmitting}
                                    style={{
                                        ...submitCrBtnStyle,
                                        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                                        boxShadow: '0 4px 10px rgba(79,70,229,0.2)',
                                        color: 'white',
                                        border: 'none'
                                    }}
                                >
                                    {duplicateSubmitting ? 'Duplicating...' : 'Duplicate Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
               MODAL: EDIT USER PROFILE
            ═══════════════════════════════════════════ */}
            {isEditProfileOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsEditProfileOpen(false)}>
                    <div style={{ ...modalContentStyle, maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#0f52ba' }}>✏️ Edit {profile.ledgerType} Profile</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsEditProfileOpen(false)}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Full Name *</label>
                                    <input style={formInputStyle} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name" />
                                </div>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Mobile *</label>
                                    <input style={formInputStyle} type="tel" value={editMobile} onChange={e => setEditMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" inputMode="numeric" pattern="[0-9]*" />
                                </div>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Email</label>
                                    <input style={formInputStyle} type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email address" />
                                </div>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Alt Mobile</label>
                                    <input style={formInputStyle} type="tel" value={editAltMobile} onChange={e => setEditAltMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Alt mobile number" inputMode="numeric" pattern="[0-9]*" />
                                </div>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Pincode</label>
                                    <input style={formInputStyle} value={editPincode} onChange={e => setEditPincode(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))} placeholder="6-digit pincode" />
                                </div>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Opening Balance (₹)</label>
                                    <input style={formInputStyle} type="number" value={editOpeningBalance} onChange={e => setEditOpeningBalance(e.target.value)} placeholder="Opening Balance" />
                                </div>
                                <div style={{ ...formGroupStyle, gridColumn: 'span 2' }}>
                                    <label style={formLabelStyle}>Address</label>
                                    <textarea style={{ ...formTextareaStyle, minHeight: '60px' }} value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Full address" />
                                </div>
                            </div>

                            {/* Convert Account Type */}
                            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '16px', marginTop: '4px' }}>
                                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account Type</p>
                                <button
                                    style={{
                                        ...switchTypeBtnStyle,
                                        background: (profile.ledgerType || '').toLowerCase() === 'supplier' ? '#059669' : '#4f46e5',
                                        boxShadow: (profile.ledgerType || '').toLowerCase() === 'supplier' ? '0 4px 14px rgba(5,150,105,0.2)' : '0 4px 14px rgba(79,70,229,0.2)'
                                    }}
                                    onClick={handleSwitchLedgerType}
                                >
                                    🔄 Convert to {(profile.ledgerType || '').toLowerCase() === 'supplier' ? 'Customer' : 'Supplier'}
                                </button>
                            </div>

                            <div style={modalFooterStyle}>
                                <button 
                                    style={{ ...deleteProfileBtnStyle, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.25)', marginRight: 'auto', padding: '10px 14px', fontSize: '12px' }} 
                                    onClick={handleClearStatements}
                                >
                                    🧹 Clear Statements
                                </button>
                                <button 
                                    style={{ ...deleteProfileBtnStyle, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px 14px', fontSize: '12px', marginRight: '8px' }} 
                                    onClick={() => {
                                        setIsEditProfileOpen(false);
                                        handleRemoveFromLedger();
                                    }}
                                >
                                    🔌 Remove from Ledger
                                </button>
                                <button 
                                    style={{ ...deleteProfileBtnStyle, padding: '10px 18px', fontSize: '13px' }} 
                                    onClick={() => {
                                        setIsEditProfileOpen(false);
                                        handleDeleteCustomerProfile();
                                    }}
                                >
                                    🗑️ Delete Profile
                                </button>
                                <button style={secondaryBtnStyle} onClick={() => setIsEditProfileOpen(false)}>Cancel</button>
                                <button style={{ ...submitCrBtnStyle, background: '#0f52ba', boxShadow: '0 4px 10px rgba(15,82,186,0.2)' }} onClick={handleSaveProfile} disabled={editSubmitting}>
                                    {editSubmitting ? 'Saving...' : '💾 Save Profile'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
               MODAL: CLOSE BALANCE & RECONCILE
            ═══════════════════════════════════════════ */}
            {/* ═══════════════════════════════════════════
               MODAL: RECYCLE BIN (DELETED STATEMENTS)
            ═══════════════════════════════════════════ */}
            {isRecycleBinOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsRecycleBinOpen(false)}>
                    <div style={{ ...modalContentStyle, maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#dc2626' }}>🗑️ Bin (Deleted Statements)</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsRecycleBinOpen(false)}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
                            {recycleBinLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px' }}>
                                    <div style={spinnerStyle}></div>
                                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '12px' }}>Loading deleted statements...</p>
                                </div>
                            ) : recycleBinTxns.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
                                    No deleted statements found for this customer.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {recycleBinTxns.map(tx => (
                                        <div key={tx._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        fontWeight: 800,
                                                        color: tx.type === 'cr' ? '#059669' : '#dc2626',
                                                        background: tx.type === 'cr' ? '#ecfdf5' : '#fdf2f2',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {tx.type === 'cr' ? 'Got' : 'Gave'}
                                                    </span>
                                                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                                                        ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                    📅 {formatDateOnly(tx.date)} {formatTimeOnly(tx.date)}
                                                </div>
                                                {tx.description && (
                                                    <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', fontWeight: 500 }}>
                                                        📝 {tx.description}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                                    onClick={() => handleRestoreTransaction(tx._id)}
                                                >
                                                    ↩️ Restore
                                                </button>
                                                <button 
                                                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                                    onClick={() => handlePermanentDeleteTransaction(tx._id)}
                                                >
                                                    🗑️ Permanent Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isCloseBalanceOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsCloseBalanceOpen(false)}>
                    <div style={{ ...modalContentStyle, maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#dc2626' }}>🔒 Close & Carry Forward Balance</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsCloseBalanceOpen(false)}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
                            {/* <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.4' }}>
                                Select a date range to reconcile and carry forward. Transactions in this range will be closed, locked, and their net value carried into the Opening Balance.
                            </p> */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                                <button
                                    type="button"
                                    style={{
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#475569',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    onClick={() => {
                                        if (transactions.length > 0) {
                                            const dates = transactions.map(t => new Date(t.date).getTime());
                                            const oldest = new Date(Math.min(...dates));
                                            setCloseFromDate(oldest.toISOString().split('T')[0]);
                                        } else {
                                            setCloseFromDate(new Date().toISOString().split('T')[0]);
                                        }
                                        setCloseToDate(new Date().toISOString().split('T')[0]);
                                    }}
                                >
                                    📅 Select All
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>From Date *</label>
                                    <input 
                                        type="date" 
                                        style={formInputStyle} 
                                        value={closeFromDate} 
                                        onChange={e => setCloseFromDate(e.target.value)} 
                                    />
                                </div>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>To Date *</label>
                                    <input 
                                        type="date" 
                                        style={formInputStyle} 
                                        value={closeToDate} 
                                        onChange={e => setCloseToDate(e.target.value)} 
                                    />
                                </div>
                            </div>
                            {closeBalanceHistory.length > 0 && (
                                <div style={{ marginTop: '8px', borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>Recent Close Balances</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                                        {closeBalanceHistory.map((rec) => (
                                            <div key={rec._id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                                                    {formatDateOnly(rec.fromDate)} to {formatDateOnly(rec.toDate)} • {rec.closedCount || 0} txns
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                                                    Status: {rec.status}
                                                </div>
                                                {rec.status === 'active' && (
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                        <button
                                                            style={{ ...secondaryBtnStyle, padding: '6px 10px', fontSize: '12px' }}
                                                            disabled={closeSubmitting}
                                                            onClick={() => handleRevertCloseBalance(rec._id)}
                                                        >
                                                            Revert
                                                        </button>
                                                        <button
                                                            style={{ ...deleteBtnStyle, padding: '6px 10px' }}
                                                            disabled={closeSubmitting}
                                                            onClick={() => handleDeleteCloseBalance(rec._id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div style={modalFooterStyle}>
                                <button style={secondaryBtnStyle} onClick={() => setIsCloseBalanceOpen(false)}>Cancel</button>
                                <button 
                                    style={{ ...submitCrBtnStyle, background: '#dc2626', boxShadow: '0 4px 10px rgba(220,38,38,0.2)' }} 
                                    onClick={handleCloseBalance} 
                                    disabled={closeSubmitting}
                                >
                                    {closeSubmitting ? 'Closing...' : '🔒 Close Balance'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
               MODAL: SELECT REPORT DATE RANGE
            ═══════════════════════════════════════════ */}
            {isReportModalOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsReportModalOpen(false)}>
                    <div style={{ ...modalContentStyle, maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#0f52ba' }}>📅 Select Date Range for Report</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsReportModalOpen(false)}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
                            {/* <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.4' }}>
                                Choose a start and end date to generate a scoped statement report for this user.
                            </p> */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Start Date *</label>
                                    <input 
                                        type="date" 
                                        style={formInputStyle} 
                                        value={reportFromDate} 
                                        onChange={e => setReportFromDate(e.target.value)} 
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div style={formGroupStyle}>
                                        <input 
                                        type="date" 
                                        style={formInputStyle} 
                                        value={reportToDate} 
                                        onChange={e => setReportToDate(e.target.value)} 
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                            </div>
                            <div style={modalFooterStyle}>
                                <button style={secondaryBtnStyle} onClick={() => setIsReportModalOpen(false)}>Cancel</button>
                                <button 
                                    style={{ ...submitCrBtnStyle, background: '#0f52ba', boxShadow: '0 4px 10px rgba(15,82,186,0.2)' }} 
                                    onClick={handleGenerateReport} 
                                >
                                    💾 Generate Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
               MODAL: PDF OPTIONS (Monthly Totals Option)
            ═══════════════════════════════════════════ */}
            {isPdfOptionsModalOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsPdfOptionsModalOpen(false)}>
                    <div style={{ ...modalContentStyle, maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#0f52ba' }}>🖨️ PDF Report Options</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsPdfOptionsModalOpen(false)}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
                            {pdfOptionsStep === 'select_totals' ? (
                                <>
                                    <p style={{ fontSize: '14px', color: '#1e293b', marginBottom: '20px', lineHeight: '1.5' }}>
                                        Would you like to include <strong>Monthly Totals</strong> in the generated PDF report?
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button 
                                            style={{ ...submitCrBtnStyle, background: '#059669', boxShadow: '0 4px 10px rgba(5,150,105,0.2)', width: '100%', padding: '12px' }} 
                                            onClick={() => {
                                                setIsPdfOptionsModalOpen(false);
                                                handleDownloadReportPDF(reportFromDate, reportToDate, reportOpeningBalance, reportTotalDebit, reportTotalCredit, reportClosingBalance, reportScopedTx, true, null);
                                            }}
                                        >
                                            ✅ Yes, Include Monthly Totals
                                        </button>
                                        <button 
                                            style={{ ...submitCrBtnStyle, background: '#4f46e5', boxShadow: '0 4px 10px rgba(79,70,229,0.2)', width: '100%', padding: '12px' }} 
                                            onClick={() => {
                                                setPdfOptionsStep('select_date');
                                            }}
                                        >
                                            ❌ No, Exclude Monthly Totals
                                        </button>
                                        <button 
                                            style={{ ...secondaryBtnStyle, width: '100%', padding: '12px' }} 
                                            onClick={() => setIsPdfOptionsModalOpen(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p style={{ fontSize: '14px', color: '#1e293b', marginBottom: '16px', lineHeight: '1.5' }}>
                                        Please enter/select the <strong>Final Date of Total</strong>. Calculations and transactions will only be computed up to this date.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                                        <div style={formGroupStyle}>
                                            <label style={formLabelStyle}>Final Date *</label>
                                            <input 
                                                type="date" 
                                                style={formInputStyle} 
                                                value={finalTotalDate} 
                                                onChange={e => setFinalTotalDate(e.target.value)} 
                                                min={reportFromDate}
                                                max={reportToDate}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button 
                                            style={{ ...submitCrBtnStyle, background: '#059669', boxShadow: '0 4px 10px rgba(5,150,105,0.2)', width: '100%', padding: '12px' }} 
                                            onClick={() => {
                                                if (!finalTotalDate) {
                                                    alert('Please select a valid final date.');
                                                    return;
                                                }
                                                if (finalTotalDate < reportFromDate || finalTotalDate > reportToDate) {
                                                    alert(`Final date must be between ${reportFromDate} and ${reportToDate}`);
                                                    return;
                                                }
                                                setIsPdfOptionsModalOpen(false);
                                                handleDownloadReportPDF(reportFromDate, reportToDate, reportOpeningBalance, reportTotalDebit, reportTotalCredit, reportClosingBalance, reportScopedTx, false, finalTotalDate);
                                            }}
                                        >
                                            🖨️ Generate PDF
                                        </button>
                                        <button 
                                            style={{ ...secondaryBtnStyle, width: '100%', padding: '12px' }} 
                                            onClick={() => setPdfOptionsStep('select_totals')}
                                        >
                                            ⬅️ Back
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
               MODAL: EDIT TRANSACTION
            ═══════════════════════════════════════════ */}
            {isEditTxOpen && editTx && (
                <div style={modalOverlayStyle} onClick={() => {
                    setIsEditTxOpen(false);
                    setEditSelectedProducts([]);
                    setEditUseProductPicker(false);
                }}>
                    <div style={{ ...modalContentStyle, maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#0f52ba' }}>✏️ Edit Transaction</h3>
                            <button style={modalCloseBtnStyle} onClick={() => {
                                setIsEditTxOpen(false);
                                setEditSelectedProducts([]);
                                setEditUseProductPicker(false);
                            }}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
                            {editTx?.deleteRequest?.status === 'pending' && (
                                <div style={{
                                    background: '#fef3c7',
                                    color: '#d97706',
                                    border: '1px solid #fde68a',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    marginBottom: '18px',
                                    fontSize: '13px',
                                    fontWeight: '600'
                                }}>
                                    ⚠️ This transaction has a pending deletion request submitted by {editTx.deleteRequest.requestedBy || 'Staff'}. All edits are locked.
                                </div>
                            )}

                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', fontSize: '13px', color: '#475569' }}>
                                <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: '#94a3b8', letterSpacing: '0.5px' }}>Type: </span>
                                <span style={{ fontWeight: 700, color: editTx.type === 'dr' ? '#dc2626' : '#059669' }}>
                                    {editTx.type === 'dr' ? '🔴 You Gave' : '🟢 You Got'}
                                </span>
                            </div>

                            {/* Product picker for editing manual tx items (amount remains independently editable) */}
                            <div style={{ ...formGroupStyle, borderBottom: '1px dashed #cbd5e1', paddingBottom: '10px', marginBottom: '10px' }}>
                                <label style={{ ...formLabelStyle, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={editUseProductPicker} 
                                        onChange={(e) => setEditUseProductPicker(e.target.checked)} 
                                        style={{ width: '13px', height: '13px' }}
                                        disabled={editTx?.deleteRequest?.status === 'pending'}
                                    />
                                    <span>🛍️ Select Products from Inventory</span>
                                </label>
                            </div>

                             {editUseProductPicker && (
                                 <div style={{ marginBottom: '12px', padding: '8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                                     <select
                                         onChange={(e) => {
                                             const val = e.target.value;
                                             if (!val) return;
                                             const p = products.find(prod => prod._id === val);
                                             if (p) {
                                                 setEditSelectedProducts(prev => {
                                                     const existing = prev.find(item => item.product._id === p._id);
                                                     let next;
                                                     if (existing) {
                                                         next = prev.map(item => item.product._id === p._id ? { ...item, qty: item.qty + 1 } : item);
                                                      } else {
                                                          next = [...prev, { product: p, qty: '', price: p.price }];  // start empty
                                                      }
                                                      // Sync amount immediately for statement values
                                                      const total = next.reduce((sum, it) => sum + ((it.product.price || 0) * (parseFloat(it.qty) || 1)), 0);
                                                     setEditTxAmount(total.toFixed(2));
                                                     return next;
                                                 });
                                             }
                                             e.target.value = '';
                                         }}
                                         style={{ ...formInputStyle, marginBottom: '6px', fontSize: '12px' }}
                                         defaultValue=""
                                         disabled={editTx?.deleteRequest?.status === 'pending'}
                                     >
                                         <option value="" disabled>➕ Add product from inventory...</option>
                                         {products
                                             .filter(p => !editSelectedProducts.some(item => item.product._id === p._id))
                                             .map(p => (
                                                 <option key={p._id} value={p._id}>
                                                     {p.name} {p.sku ? `(${p.sku})` : ''} — ₹{p.price}
                                                 </option>
                                             ))}
                                     </select>


                                     {/* ── Custom Product Entry (Edit TX) ── */}
                                     <div style={{ marginBottom: '8px' }}>
                                         <button
                                             type="button"
                                             onClick={() => { setShowEditCustomProductForm(v => !v); setEditCustomProductName(''); setEditCustomProductPrice(''); setEditCustomProductQty(''); }}
                                             style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1.5px dashed #6366f1', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#6366f1', fontWeight: '600', fontSize: '11px', width: '100%', justifyContent: 'center' }}
                                             disabled={editTx?.deleteRequest?.status === 'pending'}
                                         >
                                             ✏️ {showEditCustomProductForm ? 'Cancel Custom Item' : 'Add Custom Item'}
                                         </button>
                                         {showEditCustomProductForm && (
                                             <div style={{ marginTop: '6px', padding: '8px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '8px' }}>
                                                 <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '5px', alignItems: 'center' }}>
                                                     <input
                                                         type="text"
                                                         placeholder="Item / Product name"
                                                         value={editCustomProductName}
                                                         onChange={e => setEditCustomProductName(e.target.value)}
                                                         style={{ padding: '5px 8px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '11px', outline: 'none' }}
                                                         disabled={editTx?.deleteRequest?.status === 'pending'}
                                                     />
                                                     <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                         <span style={{ position: 'absolute', left: '6px', fontSize: '10px', color: '#6366f1', fontWeight: '700' }}>₹</span>
                                                         <input
                                                             type="number"
                                                             placeholder="Price"
                                                             value={editCustomProductPrice}
                                                             onChange={e => setEditCustomProductPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                                                             style={{ width: '68px', padding: '5px 6px 5px 16px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '11px', outline: 'none', textAlign: 'right' }}
                                                             disabled={editTx?.deleteRequest?.status === 'pending'}
                                                         />
                                                     </div>
                                                     <input
                                                         type="number"
                                                         min="1"
                                                         placeholder="Qty"
                                                         value={editCustomProductQty}
                                                         onChange={e => setEditCustomProductQty(e.target.value.replace(/[^0-9]/g, ''))}
                                                         style={{ width: '45px', padding: '5px 6px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '11px', outline: 'none', textAlign: 'center' }}
                                                         disabled={editTx?.deleteRequest?.status === 'pending'}
                                                     />
                                                     <button
                                                         type="button"
                                                         onClick={() => {
                                                             const name = editCustomProductName.trim();
                                                             const price = parseFloat(editCustomProductPrice) || 0;
                                                             const qty = editCustomProductQty === '' ? '' : (parseInt(editCustomProductQty, 10) || 1);
                                                             if (!name) return;
                                                             const customId = 'custom_' + Date.now();
                                                             setEditSelectedProducts(prev => {
                                                                 const next = [...prev, { product: { _id: customId, name, sku: '', price, isCustom: true }, qty, price }];
                                                                 const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseFloat(it.qty) || 0)), 0);
                                                                 setEditTxAmount(total.toFixed(2));
                                                                 return next;
                                                             });
                                                             setShowEditCustomProductForm(false);
                                                             setEditCustomProductName(''); setEditCustomProductPrice(''); setEditCustomProductQty('');
                                                         }}
                                                         style={{ padding: '5px 10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                                         disabled={editTx?.deleteRequest?.status === 'pending'}
                                                     >
                                                         Add
                                                     </button>
                                                 </div>
                                             </div>
                                         )}
                                     </div>

                                    {editSelectedProducts.length > 0 ? (
                                        <div>
                                            {editSelectedProducts.map(({ product, qty, price }) => (
                                                <div key={product._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '6px', fontSize: '11px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                                    <span style={{ flex: 1, fontWeight: '600', color: '#1e293b' }}>
                                                        {product.name} {product.sku ? <span style={{ color: '#64748b', fontWeight: '400', fontSize: '10px', marginLeft: '4px' }}>({product.sku})</span> : ''}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                            <span style={{ position: 'absolute', left: '6px', color: '#94a3b8', fontWeight: '600', fontSize: '10px' }}>₹</span>
                                                            <input 
                                                                type="number"
                                                                value={price !== undefined ? price : product.price}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                                    const parts = raw.split('.');
                                                                    if (parts.length > 2) return;
                                                                    if (parts[1] && parts[1].length > 2) return;
                                                                    const val = parseFloat(raw) || 0;
                                                                    if (val > 99999999) return;
                                                                    setEditSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                                                        const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseFloat(it.qty) || 1)), 0);
                                                                        setEditTxAmount(total.toFixed(2));
                                                                        return next;
                                                                    });
                                                                }}
                                                                style={{ width: '70px', padding: '4px 6px 4px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', textAlign: 'right', outline: 'none' }}
                                                            />
                                                        </div>
                                                        <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '11px' }}>×</span>
                                                         <input 
                                                             type="number" min="1" value={qty === '' || qty == null || qty === 0 || qty === '0' ? '' : qty} 
                                                             onChange={(e) => {
                                                                 const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                                 const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseFloat(raw) || 0);
                                                                 setEditSelectedProducts(prev => {
                                                                     const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                                                     const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseFloat(it.qty) || 0)), 0);
                                                                     setEditTxAmount(total.toFixed(2));
                                                                     return next;
                                                                 });
                                                             }}
                                                             style={{ width: '45px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', textAlign: 'center', outline: 'none' }}
                                                             disabled={editTx?.deleteRequest?.status === 'pending'}
                                                         />
                                                         <button 
                                                             onClick={() => {
                                                                 setEditSelectedProducts(prev => {
                                                                     const next = prev.filter(item => item.product._id !== product._id);
                                                                     const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseFloat(it.qty) || 0)), 0);
                                                                     setEditTxAmount(total.toFixed(2));
                                                                     return next;
                                                                 });
                                                             }} 
                                                             style={{ border: 'none', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }} 
                                                             disabled={editTx?.deleteRequest?.status === 'pending'}
                                                         >
                                                             ✕
                                                         </button>
                                                    </div>
                                                </div>
                                            ))}
                                             <div style={{ textAlign: 'right', fontSize: '10px', fontWeight: 600, color: '#0f52ba', marginTop: '2px' }}>
                                                 Items total: ₹{editSelectedProducts.reduce((s, {product, qty, price}) => s + (price !== undefined ? price : product.price) * (parseFloat(qty) || 0), 0)}
                                             </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>No items selected yet.</div>
                                    )}
                                </div>
                            )}

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Transaction Date & Time *</label>
                                <input
                                    type="datetime-local"
                                    style={formInputStyle}
                                    value={editTxDate}
                                    onChange={e => setEditTxDate(e.target.value)}
                                    required
                                    disabled={editTx?.deleteRequest?.status === 'pending'}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Amount (₹) *</label>
                                <input
                                    type="text"
                                    style={formInputStyle}
                                    value={editTxAmount}
                                    onChange={e => {
                                        const v = e.target.value.replace(/[^0-9.]/g, '');
                                        const parts = v.split('.');
                                        if (parts.length > 2) return;
                                        if (parts[1] && parts[1].length > 2) return;
                                        setEditTxAmount(v);
                                    }}
                                    placeholder="Enter amount"
                                    autoFocus
                                    disabled={editTx?.deleteRequest?.status === 'pending' || editUseProductPicker}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Description / Notes</label>
                                <textarea
                                    style={{ ...formTextareaStyle, minHeight: '70px' }}
                                    value={editTxDescription}
                                    onChange={e => setEditTxDescription(e.target.value)}
                                    placeholder="Enter description"
                                    disabled={editTx?.deleteRequest?.status === 'pending'}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '18px', marginTop: '4px', gap: '10px' }}>
                                {editTx?.deleteRequest?.status === 'pending' ? (
                                    !isStaff ? (
                                        <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'space-between' }}>
                                            <button
                                                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                                                onClick={() => handleRejectDelete(editTx._id)}
                                            >
                                                Reject Deletion ❌
                                            </button>
                                            <button
                                                style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                                                onClick={() => handleApproveDelete(editTx._id)}
                                            >
                                                Approve Deletion ✅
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                            <div style={{ color: '#d97706', fontWeight: '700', fontSize: '13px' }}>
                                                ⏳ Pending Deletion Request sent by {editTx.deleteRequest.requestedBy || 'Staff'}.
                                            </div>
                                            <button style={secondaryBtnStyle} onClick={() => {
                                                setIsEditTxOpen(false);
                                                setEditSelectedProducts([]);
                                                setEditUseProductPicker(false);
                                            }}>Close</button>
                                        </div>
                                    )
                                ) : (
                                    <>
                                        <button
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                color: '#ef4444',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                padding: '10px 18px',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 10px rgba(239,68,68,0.05)',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={() => handleDeleteTransaction(editTx._id)}
                                            disabled={editTxSubmitting}
                                        >
                                            🗑️ Delete
                                        </button>
                                        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                                            <button style={secondaryBtnStyle} onClick={() => {
                                                setIsEditTxOpen(false);
                                                setEditSelectedProducts([]);
                                                setEditUseProductPicker(false);
                                            }}>Cancel</button>
                                            <button
                                                style={{ ...submitCrBtnStyle, background: '#0f52ba', boxShadow: '0 4px 10px rgba(15,82,186,0.2)' }}
                                                onClick={handleSaveTransaction}
                                                disabled={editTxSubmitting}
                                            >
                                                {editTxSubmitting ? 'Saving...' : '💾 Save Changes'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// CUSTOM LEDGER INLINE STYLING SYSTEM
// ═══════════════════════════════════════════
const containerStyle = {
    padding: '24px',
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    height: '100%',
    overflowY: 'auto'
};

const headerSectionStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px'
};

const backLinkBtnStyle = {
    background: 'none',
    border: 'none',
    color: '#11998e',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    outline: 'none'
};

const titleStyle = {
    margin: 0,
    fontSize: '28px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.5px'
};

const subtitleStyle = {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#64748b'
};

const actionButtonGroupStyle = {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
};

const whatsappBtnStyle = {
    background: '#25d366',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(37, 211, 102, 0.2)'
};

const pdfBtnStyle = {
    background: '#dc2626',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(220, 38, 38, 0.2)'
};

const qrTriggerBtnStyle = {
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(17, 153, 142, 0.2)'
};

const profileGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px'
};

const glassCardStyle = {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
    boxSizing: 'border-box'
};

const cardSectionTitleStyle = {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
};

const profileDetailListStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px 16px',
    marginTop: '12px'
};

const profileDetailItemStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
};

const profileDetailLabelStyle = {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
};

const profileDetailValStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b'
};

const statValueStyle = {
    margin: '12px 0 0',
    fontSize: '32px',
    fontWeight: '800',
    letterSpacing: '-1px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    flexWrap: 'wrap'
};

const bookingControlsStyle = {
    display: 'flex',
    gap: '12px',
    marginTop: '20px'
};

const bookingGiveBtnStyle = {
    flex: 1,
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '12px',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    outline: 'none'
};

const bookingGetBtnStyle = {
    flex: 1,
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    padding: '12px',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    outline: 'none'
};

const tableWrapperStyle = {
    overflowX: 'auto',
    width: '100%'
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
};

const tableHeaderRowStyle = {
    borderBottom: '2px solid #e2e8f0'
};

const thStyle = {
    padding: '14px 16px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
};

const trStyle = {
    borderBottom: '1px solid #f1f5f9'
};

const tdStyle = {
    padding: '16px',
    fontSize: '14px',
    color: '#334155',
    verticalAlign: 'middle'
};

const systemLabelStyle = {
    fontSize: '11px',
    background: '#f1f5f9',
    color: '#64748b',
    padding: '4px 8px',
    borderRadius: '6px',
    fontWeight: '600'
};

const deleteBtnStyle = {
    background: 'rgba(239, 68, 68, 0.08)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    padding: '6px 12px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none'
};

const editTxBtnStyle = {
    background: 'rgba(15, 82, 186, 0.08)',
    color: '#0f52ba',
    border: '1px solid rgba(15, 82, 186, 0.2)',
    padding: '6px 14px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none'
};

const editProfileBtnStyle = {
    background: 'rgba(15, 82, 186, 0.07)',
    color: '#0f52ba',
    border: '1px solid rgba(15, 82, 186, 0.18)',
    padding: '7px 14px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
    letterSpacing: '0.2px'
};

const closeBalanceBtnStyle = {
    background: 'rgba(220, 38, 38, 0.07)',
    color: '#dc2626',
    border: '1px solid rgba(220, 38, 38, 0.18)',
    padding: '7px 14px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
    letterSpacing: '0.2px'
};

const deleteProfileBtnStyle = {
    background: 'rgba(239, 68, 68, 0.07)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.18)',
    padding: '7px 14px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
    letterSpacing: '0.2px'
};

const noDataStyle = {
    textAlign: 'center',
    padding: '40px 16px',
    color: '#64748b',
    fontWeight: '500'
};

const errorCardStyle = {
    background: '#fef2f2',
    border: '1px solid #fee2e2',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
    textAlign: 'center'
};

const secondaryBtnStyle = {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer'
};

const spinnerStyle = {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(17, 153, 142, 0.1)',
    borderTop: '4px solid #11998e',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto'
};

// Modals styling
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px'
};

const modalContentStyle = {
    background: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    boxSizing: 'border-box'
};

const modalHeaderStyle = {
    padding: '18px 24px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};

const modalCloseBtnStyle = {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#94a3b8',
    cursor: 'pointer',
    outline: 'none'
};

const modalBodyStyle = {
    padding: '24px'
};

const ledgerEntryModalContentStyle = {
    ...modalContentStyle,
    maxWidth: '440px'
};

const ledgerEntryModalBodyStyle = {
    ...modalBodyStyle,
    padding: '16px',
    maxHeight: '80vh',
    overflowY: 'auto',
    overscrollBehavior: 'contain'
};

const formGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '18px'
};

const formLabelStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
};

const formInputStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box'
};

const formTextareaStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
};

const modalFooterStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    borderTop: '1px solid #f1f5f9',
    padding: '18px 0 0',
    marginTop: '12px'
};

const submitDrBtnStyle = {
    background: '#dc2626',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(220, 38, 38, 0.2)'
};

const submitCrBtnStyle = {
    background: '#059669',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(5, 150, 105, 0.2)'
};

// UPI QR Modals Styling
const qrDisplayCardStyle = {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '20px 0',
    color: '#0f172a',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
};

const qrImgStyle = {
    width: '200px',
    height: '200px',
    objectFit: 'contain'
};

const bankDetailsCardStyle = {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '16px',
    marginTop: '16px'
};

const switchTypeBtnStyle = {
    color: 'white',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    outline: 'none'
};

// Day-group separator row (full-width centred date badge)
const dayGroupHeaderStyle = {
    textAlign: 'center',
    padding: '12px 0 6px',
    background: 'transparent',
    border: 'none'
};

const dayGroupBadgeStyle = {
    display: 'inline-block',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    padding: '4px 16px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
};

// Styled amount spans in Dr / Cr columns
const drAmountStyle = {
    display: 'inline-block',
    background: '#fdf2f2',
    color: '#dc2626',
    fontWeight: '800',
    fontSize: '13px',
    padding: '2px 8px',
    borderRadius: '5px'
};

const crAmountStyle = {
    display: 'inline-block',
    background: '#ecfdf5',
    color: '#059669',
    fontWeight: '800',
    fontSize: '13px',
    padding: '2px 8px',
    borderRadius: '5px'
};

export default CustomerLedger;

