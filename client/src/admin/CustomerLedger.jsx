import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io as socketIO } from 'socket.io-client';
import adminApi from './adminApi';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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

function CustomerLedger() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [paymentSettings, setPaymentSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal states
    const [isDrModalOpen, setIsDrModalOpen] = useState(false); // You Gave
    const [isCrModalOpen, setIsCrModalOpen] = useState(false); // You Got
    const [isQrModalOpen, setIsQrModalOpen] = useState(false); // QR Code Overlay

    // Form inputs state
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [transactionDate, setTransactionDate] = useState('');

    // QR selection state
    const [selectedPaymentSetting, setSelectedPaymentSetting] = useState(null);
    const [customQrAmount, setCustomQrAmount] = useState('');

    // Submitting state
    const [submitting, setSubmitting] = useState(false);

    // Product picker state (for You Got modal)
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]); // [{product, qty}]
    const [useProductPicker, setUseProductPicker] = useState(false);

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

    // Symmetrical base path
    const isStaff = window.location.pathname.startsWith('/staff');
    const basePath = isStaff ? '/staff' : '/admin';

    useEffect(() => {
        fetchLedgerData();
        fetchPaymentSettings();
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
            // Sort transactions chronologically (ascending for running balance calculations, then we can display descending or ascending)
            const sortedTx = (data.transactions || []).sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Calculate running balance locally for 100% accurate presentation
            let currentRunning = 0;
            const calculatedTx = sortedTx.map(t => {
                // Dr (You Gave) is credit extended, i.e., client owes us (positive / debit base depending on view)
                // In Khatabook logic: 
                // - "You Gave" (Dr) increases client debt to us (increases outstanding, makes net balance more positive/negative depending on sign).
                // Let's match the server schema:
                // type === 'dr' (You Gave) is customer owing us.
                // type === 'cr' (You Got) is customer paying us.
                // Net balance = Total You Got - Total You Gave (if positive, we owe them / they have advance. If negative, they owe us).
                // Let's follow:
                // If type === 'cr', running balance increases (advance increases / debt decreases).
                // If type === 'dr', running balance decreases (advance decreases / debt increases).
                if (t.type === 'cr') {
                    currentRunning += (t.amount || 0);
                } else if (t.type === 'dr') {
                    currentRunning -= (t.amount || 0);
                }
                return {
                    ...t,
                    runningBalance: currentRunning
                };
            });

            // Display newest first in the statement UI
            setTransactions(calculatedTx.reverse());
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
        // If using product picker, compute amount from products
        let finalAmount = amount;
        let productItems = [];
        if (useProductPicker && selectedProducts.length > 0) {
            const total = selectedProducts.reduce((sum, {product, qty}) => sum + (product.price * qty), 0);
            finalAmount = total.toFixed(2);
            productItems = selectedProducts.map(({ product, qty }) => ({
                productId: product._id,
                name: product.name,
                sku: product.sku || '',
                qty,
                unitPrice: product.price
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

        // Auto-build description from product names if using picker
        let finalDescription = description;
        if (useProductPicker && selectedProducts.length > 0 && !description.trim()) {
            finalDescription = selectedProducts.map(({product, qty}) => `${product.name} ×${qty}`).join(', ');
        }
        if (!finalDescription.trim()) finalDescription = type === 'dr' ? 'You Gave' : 'You Got';

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
            setSubmitting(false);
        }
    };


    const handleDeleteTransaction = async (txId) => {
        if (!window.confirm('Are you sure you want to delete this ledger entry? Outstanding balances will be recalculated immediately.')) return;
        try {
            await adminApi.deleteLedgerTransaction(txId);
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to delete transaction: ' + err.message);
        }
    };

    const handleSwitchLedgerType = async () => {
        const currentType = (profile.ledgerType || 'Customer').toLowerCase();
        const nextType = currentType === 'supplier' ? 'Customer' : 'Supplier';
        if (!window.confirm(`Are you sure you want to convert this account to a ${nextType}?`)) return;
        try {
            await adminApi.switchLedgerType(userId, nextType);
            alert(`Account converted to ${nextType} successfully!`);
            await fetchLedgerData();
        } catch (err) {
            alert('Failed to switch type: ' + err.message);
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

    // Exports PDF Statement using jsPDF
    const handleDownloadPDF = () => {
        if (!profile) return;
        
        const doc = new jsPDF();
        const docWidth = doc.internal.pageSize.getWidth();

        const isSupplier = (profile.ledgerType || '').toLowerCase() === 'supplier';
        const primaryColor = isSupplier ? [15, 118, 110] : [15, 82, 186]; // Teal vs Sapphire Blue

        // 1. Header banner
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, docWidth, 40, 'F');

        // Header Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('KSK VASU & Co', 15, 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`${profile.ledgerType || 'Customer'} Account Ledger Statement`, 15, 25);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 15, 32);

        // Header Badge on Right
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(docWidth - 65, 12, 50, 8, 3, 3, 'F');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`${(profile.ledgerType || 'Customer').toUpperCase()} STATEMENT`, docWidth - 60, 17.5);

        // 2. Profile Details Section
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${(profile.ledgerType || 'Customer').toUpperCase()} DETAILS:`, 15, 50);
        
        doc.setFont('helvetica', 'bold');
        doc.text('Name:', 15, 57);
        doc.setFont('helvetica', 'normal');
        doc.text(`${profile.name || 'N/A'}`, 30, 57);
        
        doc.setFont('helvetica', 'bold');
        doc.text('Mobile:', 15, 63);
        doc.setFont('helvetica', 'normal');
        doc.text(`+91 ${profile.mobile || 'N/A'}`, 30, 63);
        
        if (profile.email) {
            doc.setFont('helvetica', 'bold');
            doc.text('Email:', 15, 69);
            doc.setFont('helvetica', 'normal');
            doc.text(`${profile.email}`, 30, 69);
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text('Location:', 15, profile.email ? 75 : 69);
        doc.setFont('helvetica', 'normal');
        const locParts = [profile.address, profile.taluk, profile.district].filter(Boolean).join(', ');
        doc.text(`${locParts || 'N/A'}`, 33, profile.email ? 75 : 69);

        // Right side: Ledger summary box
        const summaryX = docWidth - 90;
        doc.setFillColor(248, 250, 252);
        doc.rect(summaryX - 5, 47, 80, 35, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(summaryX - 5, 47, 80, 35, 'D');

        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('LEDGER ACCOUNT SUMMARY', summaryX, 53);
        
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Total You Gave (Dr):`, summaryX, 60);
        doc.text(`Rs. ${(profile.totalYouGave || 0).toFixed(2)}`, summaryX + 45, 60);
        
        doc.text(`Total You Got (Cr):`, summaryX, 66);
        doc.text(`Rs. ${(profile.totalYouGot || 0).toFixed(2)}`, summaryX + 45, 66);
        
        const netVal = profile.netBalance || 0;
        let r = 100, g = 116, b = 139;
        let balLabel = 'Settled';
        if (netVal < 0) { 
            r = 220; g = 38; b = 38; 
            balLabel = isSupplier ? 'Credit' : 'Due';
        } else if (netVal > 0) { 
            r = 5; g = 150; b = 105; 
            balLabel = isSupplier ? 'Due (Adv)' : 'Advance';
        }
        
        // Highlight background for Net Balance inside the box
        doc.setFillColor(netVal < 0 ? 254 : 236, netVal < 0 ? 242 : 253, netVal < 0 ? 242 : 245);
        doc.rect(summaryX - 3, 70, 76, 9, 'F');
        
        doc.setTextColor(r, g, b);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(`Net Balance:`, summaryX, 76);
        doc.text(`Rs. ${Math.abs(netVal).toFixed(2)} (${balLabel})`, summaryX + 24, 76);

        // Reset Text Color
        doc.setTextColor(30, 41, 59);

        // 3. Transactions table headers and rows
        const tableHeaders = [['#', 'Date & Time', 'Transaction Details', 'You Gave (Dr)', 'You Got (Cr)', 'Running Balance']];
        const chronologicalTx = [...transactions].reverse();
        
        let runningBal = 0;
        
        const tableRows = chronologicalTx.map((t, idx) => {
            // Calculate running balance for the PDF
            if (t.type === 'dr') {
                runningBal += (t.amount || 0);
            } else {
                runningBal -= (t.amount || 0);
            }
            
            // Build rich description with product details if available
            let desc = t.description || '';
            
            if (t.productItems && t.productItems.length > 0) {
                const productLines = t.productItems.map(p => 
                    `  • ${p.name}${p.sku ? ` (${p.sku})` : ''} × ${p.qty} @ ₹${p.unitPrice}`
                ).join('\n');
                desc = `${desc}\n${productLines}`;
            } else if (t.skuLine) {
                desc = `${desc}\n  SKU: ${t.skuLine}`;
            }
            
            // Add source info
            const source = t.orderId ? ' [📦 Order]' : t.isManual ? ' [✍️ Manual]' : ' [Auto]';
            desc = `${desc}${source}`;
            
            const isDr = t.type === 'dr';
            const amountStr = `Rs. ${(t.amount || 0).toFixed(2)}`;
            const runBalAbs = Math.abs(runningBal);
            const balSuffix = runningBal < 0 ? ' (Due)' : runningBal > 0 ? ' (Adv)' : '';
            
            return [
                idx + 1,
                new Date(t.date).toLocaleString('en-IN', { 
                    day: '2-digit', month: 'short', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                }),
                desc,
                isDr ? amountStr : '—',
                !isDr ? amountStr : '—',
                `Rs. ${runBalAbs.toFixed(2)}${balSuffix}`
            ];
        });

        // Draw Table with full details
        doc.autoTable({
            head: tableHeaders,
            body: tableRows,
            startY: 88,
            theme: 'striped',
            headStyles: { fillColor: primaryColor },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 30 },
                2: { cellWidth: 66 },
                3: { cellWidth: 25, halign: 'right', textColor: [220, 38, 38] },
                4: { cellWidth: 25, halign: 'right', textColor: [5, 150, 105] },
                5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
            },
            styles: { 
                fontSize: 8,
                cellPadding: 3,
                overflow: 'linebreak'
            },
            didDrawPage: (data) => {
                // Add page number
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(`Page ${doc.internal.getNumberOfPages()}`, docWidth - 20, doc.internal.pageSize.getHeight() - 10);
            }
        });

        // 4. Footer
        const finalY = doc.previousAutoTable.finalY + 12;
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('This is a certified digital account ledger statement compiled dynamically.', 15, finalY);
        doc.text('For any queries, contact KSK VASU & Co.', 15, finalY + 6);
        doc.setFont('helvetica', 'bold');
        doc.text('Authorized Signature: ________________', docWidth - 90, finalY + 6);

        doc.save(`${(profile.name || 'Customer').replace(/\s+/g, '_')}_KSK_Ledger_Report.pdf`);
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
                    <button 
                        style={{
                            ...switchTypeBtnStyle,
                            background: (profile.ledgerType || '').toLowerCase() === 'supplier' ? '#059669' : '#4f46e5',
                            boxShadow: (profile.ledgerType || '').toLowerCase() === 'supplier' ? '0 4px 14px rgba(5, 150, 105, 0.25)' : '0 4px 14px rgba(79, 70, 229, 0.25)'
                        }} 
                        onClick={handleSwitchLedgerType}
                    >
                        🔄 Convert to {(profile.ledgerType || '').toLowerCase() === 'supplier' ? 'Customer' : 'Supplier'}
                    </button>
                    <button style={whatsappBtnStyle} onClick={handleSendWhatsApp}>
                        💬 WhatsApp Reminder
                    </button>
                    <button style={pdfBtnStyle} onClick={handleDownloadPDF}>
                        📄 Download PDF
                    </button>
                    <button style={qrTriggerBtnStyle} onClick={openQrModal}>
                        💳 Show UPI QR
                    </button>
                </div>
            </div>

            {/* Profile Detail Cards & Quick Bookings */}
            <div style={profileGridStyle}>
                {/* 1. Customer card */}
                <div style={glassCardStyle}>
                    <h4 style={cardSectionTitleStyle}>👤 {profile.ledgerType} Profile</h4>
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
                            <div style={profileDetailItemStyle}>
                                <span style={profileDetailLabelStyle}>Address</span>
                                <span style={profileDetailValStyle}>🏠 {profile.address}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Outstanding Balance display card */}
                <div style={{
                    ...glassCardStyle,
                    borderLeft: `6px solid ${netBal >= 0 ? '#10b981' : '#ef4444'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h4 style={cardSectionTitleStyle}>💰 Current Ledger Balance</h4>
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
                            🔴 You Gave (Dr)
                        </button>
                        <button style={bookingGetBtnStyle} onClick={openCrModal}>
                            🟢 You Got (Cr)
                        </button>
                    </div>
                </div>
            </div>

            {/* Statement Ledger History List */}
            <div style={glassCardStyle}>
                <h3 style={{ ...cardSectionTitleStyle, marginBottom: '20px' }}>📊 Chronological Ledger Statement</h3>
                <div style={tableWrapperStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={tableHeaderRowStyle}>
                                <th style={thStyle}>Time</th>
                                <th style={thStyle}>Description / Reference</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>You Gave (Dr)</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>You Got (Cr)</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Running Balance</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={noDataStyle}>
                                        No ledger entries recorded yet. Transactions, advances, or deliveries will backfill automatically.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t, index) => {
                                    const isDr = t.type === 'dr';
                                    const runBal = t.runningBalance;
                                    const isRunDue = runBal < 0;
                                    const showDayHeader = index === 0 || !isSameDay(t.date, transactions[index - 1].date);

                                    return (
                                        <React.Fragment key={t._id}>
                                            {showDayHeader && (
                                                <tr>
                                                    <td colSpan="6" style={dayGroupHeaderStyle}>
                                                        <span style={dayGroupBadgeStyle}>
                                                            {getFriendlyDayLabel(t.date)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )}
                                            <tr style={trStyle}>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#475569', fontWeight: '600', fontSize: '13px' }}>
                                                    {formatTimeOnly(t.date)}
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{ fontWeight: '500', color: '#1e293b' }}>{t.description}</span>
                                                        {t.orderId && (
                                                            <span style={{ fontSize: '11px', color: '#11998e', fontWeight: 600 }}>
                                                                📦 Order ID: {t.orderId}
                                                            </span>
                                                        )}
                                                        {t.skuLine && (
                                                            <span style={{
                                                                display: 'inline-block',
                                                                fontSize: '11px',
                                                                fontWeight: '600',
                                                                marginTop: '2px',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                alignSelf: 'flex-start',
                                                                background: '#e0f2fe',
                                                                color: '#0369a1',
                                                                border: '1px solid #bae6fd'
                                                            }}>
                                                                🏷️ SKU: {t.skuLine}
                                                            </span>
                                                        )}
                                                        <span style={{
                                                            display: 'inline-block',
                                                            fontSize: '10px',
                                                            fontWeight: '700',
                                                            marginTop: '2px',
                                                            padding: '1px 6px',
                                                            borderRadius: '4px',
                                                            alignSelf: 'flex-start',
                                                            ...(t.orderId
                                                                ? { background: '#eff6ff', color: '#3b82f6' }
                                                                : { background: '#fef9c3', color: '#854d0e' })
                                                        }}>
                                                            {t.orderId ? '📦 Order' : '✍️ Manual'}
                                                        </span>
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
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: '5px',
                                                        fontWeight: '700',
                                                        fontSize: '13px',
                                                        background: isRunDue ? '#fdf2f2' : runBal > 0 ? '#ecfdf5' : '#f1f5f9',
                                                        color: isRunDue ? '#dc2626' : runBal > 0 ? '#059669' : '#64748b'
                                                    }}>
                                                        ₹{formatCurrencyNoDecimals(Math.abs(runBal))}
                                                        <span style={{ fontSize: '10px', fontWeight: 500, marginLeft: '3px' }}>
                                                            {isRunDue ? ' Due' : runBal > 0 ? ' Adv' : ''}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    {t.isManual ? (
                                                        <button
                                                            style={deleteBtnStyle}
                                                            onClick={() => handleDeleteTransaction(t._id)}
                                                        >
                                                            🗑️ Delete
                                                        </button>
                                                    ) : (
                                                        <span style={systemLabelStyle}>Auto-Sync</span>
                                                    )}
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
               MODAL: YOU GAVE (Debit / Sales Booking)
            ═══════════════════════════════════════════ */}
            {isDrModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#dc2626' }}>🔴 You Gave (Debit Credit Extension)</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsDrModalOpen(false)}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
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
                                                    if (existing) {
                                                        return prev.map(item => item.product._id === p._id ? { ...item, qty: item.qty + 1 } : item);
                                                    } else {
                                                        return [...prev, { product: p, qty: 1 }];
                                                    }
                                                });
                                            }
                                            e.target.value = ''; // Reset select dropdown
                                        }}
                                        style={{ ...formInputStyle, marginBottom: '12px', fontSize: '14px', cursor: 'pointer' }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>➕ Choose a product to add...</option>
                                        {products.map(p => (
                                            <option key={p._id} value={p._id}>
                                                {p.name} {p.sku ? `(${p.sku})` : ''} — ₹{p.price}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedProducts.length > 0 ? (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Selected Items:</div>
                                            {selectedProducts.map(({ product, qty }) => (
                                                <div key={product._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '4px', fontSize: '13px' }}>
                                                    <span style={{ flex: 1, fontWeight: '500', color: '#1e293b', marginRight: '8px' }}>
                                                        {product.name} ({product.sku || 'No SKU'})
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: '#64748b', fontSize: '12px' }}>₹{product.price} ×</span>
                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <input 
                                                                type="number" 
                                                                min="1"
                                                                value={qty} 
                                                                onChange={(e) => {
                                                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                    setSelectedProducts(prev => 
                                                                        prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item)
                                                                    );
                                                                }}
                                                                style={{ width: '50px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', background: '#fff', fontSize: '13px' }}
                                                            />
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedProducts(prev => prev.filter(item => item.product._id !== product._id));
                                                            }}
                                                            style={{ padding: '2px 6px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ marginTop: '10px', textAlign: 'right', fontWeight: '700', fontSize: '14px', color: '#dc2626' }}>
                                                Total: ₹{formatCurrencyNoDecimals(selectedProducts.reduce((sum, {product, qty}) => sum + (product.price * qty), 0))}
                                            </div>
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
                                    placeholder="Enter amount given e.g. 500"
                                    value={useProductPicker && selectedProducts.length > 0 ? selectedProducts.reduce((sum, {product, qty}) => sum + (product.price * qty), 0).toFixed(2) : amount}
                                    onChange={handleAmountChange}
                                    style={formInputStyle}
                                    disabled={useProductPicker && selectedProducts.length > 0}
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
               MODAL: YOU GOT (Credit / Payments Booking)
            ═══════════════════════════════════════════ */}
            {isCrModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#059669' }}>🟢 You Got (Credit Payment Received)</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsCrModalOpen(false)}>✕</button>
                        </div>
                        <div style={modalBodyStyle}>
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
                                                    if (existing) {
                                                        return prev.map(item => item.product._id === p._id ? { ...item, qty: item.qty + 1 } : item);
                                                    } else {
                                                        return [...prev, { product: p, qty: 1 }];
                                                    }
                                                });
                                            }
                                            e.target.value = ''; // Reset select dropdown
                                        }}
                                        style={{ ...formInputStyle, marginBottom: '12px', fontSize: '14px', cursor: 'pointer' }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>➕ Choose a product to add...</option>
                                        {products.map(p => (
                                            <option key={p._id} value={p._id}>
                                                {p.name} {p.sku ? `(${p.sku})` : ''} — ₹{p.price}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedProducts.length > 0 ? (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Selected Items:</div>
                                            {selectedProducts.map(({ product, qty }) => (
                                                <div key={product._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '4px', fontSize: '13px' }}>
                                                    <span style={{ flex: 1, fontWeight: '500', color: '#1e293b', marginRight: '8px' }}>
                                                        {product.name} ({product.sku || 'No SKU'})
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: '#64748b', fontSize: '12px' }}>₹{product.price} ×</span>
                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <input 
                                                                type="number" 
                                                                min="1"
                                                                value={qty} 
                                                                onChange={(e) => {
                                                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                    setSelectedProducts(prev => 
                                                                        prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item)
                                                                    );
                                                                }}
                                                                style={{ width: '50px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', background: '#fff', fontSize: '13px' }}
                                                            />
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedProducts(prev => prev.filter(item => item.product._id !== product._id));
                                                            }}
                                                            style={{ padding: '2px 6px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ marginTop: '10px', textAlign: 'right', fontWeight: '700', fontSize: '14px', color: '#059669' }}>
                                                Total: ₹{formatCurrencyNoDecimals(selectedProducts.reduce((sum, {product, qty}) => sum + (product.price * qty), 0))}
                                            </div>
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
                                    placeholder="Enter amount received e.g. 1000"
                                    value={useProductPicker && selectedProducts.length > 0 ? selectedProducts.reduce((sum, {product, qty}) => sum + (product.price * qty), 0).toFixed(2) : amount}
                                    onChange={handleAmountChange}
                                    style={formInputStyle}
                                    disabled={useProductPicker && selectedProducts.length > 0}
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
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, maxWidth: '450px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '24px'
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
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px'
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

