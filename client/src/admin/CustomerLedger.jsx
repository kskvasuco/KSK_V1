import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminApi from './adminApi';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
    const openDrModal = () => {
        setAmount('');
        setDescription('');
        setTransactionDate('');
        setIsDrModalOpen(true);
    };

    const openCrModal = () => {
        setAmount('');
        setDescription('');
        setTransactionDate('');
        setIsCrModalOpen(true);
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
                    currentRunning += t.amount;
                } else if (t.type === 'dr') {
                    currentRunning -= t.amount;
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
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert('Please enter a valid amount greater than 0.');
            return;
        }
        if (numAmount > 999999999.99) {
            alert('Amount cannot exceed ₹99,99,99,999.99.');
            return;
        }

        setSubmitting(true);
        try {
            await adminApi.addLedgerTransaction({
                userId,
                type,
                amount: numAmount,
                description: description || (type === 'dr' ? 'You Gave' : 'You Got'),
                date: transactionDate ? new Date(transactionDate) : new Date()
            });

            // Reset forms
            setAmount('');
            setDescription('');
            setTransactionDate('');
            setIsDrModalOpen(false);
            setIsCrModalOpen(false);

            // Refresh ledger
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

    // Formulates deep-linked WhatsApp reminder link
    const handleSendWhatsApp = () => {
        if (!profile) return;
        const net = profile.netBalance;
        const phone = profile.mobile;
        
        let messageText = '';
        if (net < 0) {
            // They owe us
            const absBal = Math.abs(net).toFixed(2);
            messageText = `Dear ${profile.name},\n\nThis is a friendly reminder from KSK VASU & Co. Your current outstanding balance is *₹${absBal}*.\n\nPlease clear the pending amount at your earliest convenience.\n\nThank you for your business!`;
        } else if (net > 0) {
            // They have advance
            messageText = `Dear ${profile.name},\n\nGreeting from KSK VASU & Co. You have an advance credit balance of *₹${net.toFixed(2)}* with us.\n\nThank you for your continued support!`;
        } else {
            messageText = `Dear ${profile.name},\n\nGreeting from KSK VASU & Co. Your ledger account is fully settled with ₹0.00 outstanding.\n\nThank you!`;
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

        // 1. Header banner
        doc.setFillColor(17, 153, 142); // #11998e
        doc.rect(0, 0, docWidth, 40, 'F');

        // Header Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('KSK VASU & Co', 15, 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Account Ledger Statement', 15, 25);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 15, 32);

        // 2. Customer Profile Section in PDF
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('STATEMENT FOR:', 15, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(`Name: ${profile.name}`, 15, 58);
        doc.text(`Mobile: +91 ${profile.mobile}`, 15, 64);
        doc.text(`District: ${profile.district || 'N/A'}`, 15, 70);
        doc.text(`Taluk: ${profile.taluk || 'N/A'}`, 15, 76);

        // Right side: Ledger summary block
        const summaryX = docWidth - 85;
        doc.setFillColor(248, 250, 252);
        doc.rect(summaryX - 5, 47, 75, 33, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(summaryX - 5, 47, 75, 33, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('LEDGER ACCOUNT SUMMARY', summaryX, 53);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total You Gave: Rs. ${profile.totalYouGave.toFixed(2)}`, summaryX, 60);
        doc.text(`Total You Got:  Rs. ${profile.totalYouGot.toFixed(2)}`, summaryX, 66);
        
        const netVal = profile.netBalance;
        let r = 100, g = 116, b = 139;
        if (netVal < 0) { r = 220; g = 38; b = 38; }
        else if (netVal > 0) { r = 5; g = 150; b = 105; }
        doc.setTextColor(r, g, b);
        doc.text(`Net Balance: Rs. ${Math.abs(netVal).toFixed(2)} (${netVal < 0 ? 'Due' : netVal > 0 ? 'Advance' : 'Settled'})`, summaryX, 74);

        // Reset Text Color
        doc.setTextColor(30, 41, 59);

        // 3. Transactions table headers and rows
        const tableHeaders = [['Date', 'Description / Details', 'Type (Dr/Cr)', 'Amount', 'Running Balance']];
        
        // Reverse transactions back to chronological order (ascending) for chronological PDF table reading
        const chronologicalTx = [...transactions].reverse();
        
        const tableRows = chronologicalTx.map(t => [
            new Date(t.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            t.description,
            t.type === 'dr' ? 'You Gave (Dr)' : 'You Got (Cr)',
            `Rs. ${t.amount.toFixed(2)}`,
            `Rs. ${Math.abs(t.runningBalance).toFixed(2)} ${t.runningBalance < 0 ? '(Due)' : t.runningBalance > 0 ? '(Adv)' : ''}`
        ]);

        // Draw Table
        doc.autoTable({
            head: tableHeaders,
            body: tableRows,
            startY: 88,
            theme: 'striped',
            headStyles: { fillColor: [17, 153, 142] },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 65 },
                2: { cellWidth: 30 },
                3: { cellWidth: 25, halign: 'right' },
                4: { cellWidth: 35, halign: 'right' }
            },
            styles: { fontSize: 9 }
        });

        // 4. Footer signature
        const finalY = doc.previousAutoTable.finalY + 15;
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('This is a computer-generated account statement.', 15, finalY);
        doc.text('Authorized Signature: KSK VASU & Co', docWidth - 85, finalY);

        doc.save(`${profile.name.replace(/\s+/g, '_')}_KSK_Ledger.pdf`);
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
                    <p style={subtitleStyle}>Customer ledger and transaction history statement.</p>
                </div>
                
                <div style={actionButtonGroupStyle}>
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
                    <h4 style={cardSectionTitleStyle}>👤 Customer Profile</h4>
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
                                {isDue ? ' (Customer Owes Us / Due)' : netBal > 0 ? ' (We Owe Customer / Advance)' : ' (Symmetrical Settle)'}
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
                                <th style={thStyle}>Date & Time</th>
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
                                transactions.map((t) => {
                                    const isDr = t.type === 'dr';
                                    const runBal = t.runningBalance;
                                    const isRunDue = runBal < 0;

                                    return (
                                        <tr key={t._id} style={trStyle}>
                                            <td style={tdStyle}>
                                                {new Date(t.date).toLocaleString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontWeight: '500', color: '#1e293b' }}>{t.description}</span>
                                                    {t.orderId && (
                                                        <span style={{ fontSize: '11px', color: '#11998e', fontWeight: 600 }}>
                                                            📦 Order ID: {t.orderId}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: isDr ? '#dc2626' : '#94a3b8', fontWeight: isDr ? '600' : 'normal' }}>
                                                {isDr ? `₹${t.amount.toFixed(2)}` : '-'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: !isDr ? '#059669' : '#94a3b8', fontWeight: !isDr ? '600' : 'normal' }}>
                                                {!isDr ? `₹${t.amount.toFixed(2)}` : '-'}
                                            </td>
                                            <td style={{ 
                                                ...tdStyle, 
                                                textAlign: 'right', 
                                                color: isRunDue ? '#dc2626' : runBal > 0 ? '#059669' : '#64748b', 
                                                fontWeight: '700' 
                                            }}>
                                                ₹{Math.abs(runBal).toFixed(2)}
                                                <span style={{ fontSize: '11px', fontWeight: 500, marginLeft: '3px' }}>
                                                    {isRunDue ? ' (Due)' : runBal > 0 ? ' (Adv)' : ''}
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
                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Amount (INR) *</label>
                                <input
                                    type="text"
                                    placeholder="Enter amount given e.g. 500"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    style={formInputStyle}
                                    autoFocus
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
                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Amount (INR) *</label>
                                <input
                                    type="text"
                                    placeholder="Enter amount received e.g. 1000"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    style={formInputStyle}
                                    autoFocus
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

export default CustomerLedger;
