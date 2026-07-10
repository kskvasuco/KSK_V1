import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import adminApi from '../adminApi';

// Load Tamil font for jsPDF (with 5s timeout so it doesn't block PDF generation)
const loadCustomFont = async (doc) => {
    try {
        const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/muktamalar/MuktaMalar-Regular.ttf';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        let response;
        try {
            response = await fetch(fontUrl, { signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
        if (!response || !response.ok) return false;
        const buffer = await response.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = window.btoa(binary);
        doc.addFileToVFS('MuktaMalar.ttf', b64);
        doc.addFont('MuktaMalar.ttf', 'tamil_font', 'normal');
        doc.addFont('MuktaMalar.ttf', 'tamil_font', 'bold');
        return true;
    } catch (e) {
        console.warn('Failed to load Tamil font:', e);
        return false;
    }
};

const isTamil = (text) => {
    if (!text) return false;
    return /[\u0B80-\u0BFF]/.test(text);
};

// Render Tamil text to Canvas PNG to ensure perfect Indic script shaping connections
const createMultilineImage = (text, scaleFactor = 1) => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const hasTamil = isTamil(text);
        const baseSize = 24;
        const fontSize = hasTamil ? (baseSize * scaleFactor) : baseSize; 
        ctx.font = `bold ${fontSize}px sans-serif`;
        
        const maxWidthPx = 600;
        const finalLines = [];
        const words = text.split(' ');
        let currentLine = '';
        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
            if (ctx.measureText(testLine).width > maxWidthPx && i > 0) {
                finalLines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        finalLines.push(currentLine);

        const lineHeight = fontSize * 1.35;
        let actualMaxWidth = 0;
        finalLines.forEach(l => { 
            const w = ctx.measureText(l).width; 
            if (w > actualMaxWidth) actualMaxWidth = w; 
        });

        canvas.width = Math.max(actualMaxWidth + 6, 10);
        canvas.height = (finalLines.length * lineHeight) + 8;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        finalLines.forEach((line, i) => {
            if (line) ctx.fillText(line, 2, 4 + (i * lineHeight));
        });
        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    } catch (e) { return null; }
};

// Helper to load images to base64
const loadImageAsDataUrl = (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.width, height: img.height });
            } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
};

function OrderCount() {
    const [orders, setOrders] = useState([]);
    const [groupedCustomers, setGroupedCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Detailed Modal states
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminApi.getOrders();
            const allOrders = Array.isArray(data) ? data : (data?.orders || []);
            setOrders(allOrders);

            // Group orders by mobile number
            const groups = {};
            allOrders.forEach(order => {
                const mobile = (order.user?.mobile || order.mobile || 'N/A').trim();
                const name = order.user?.name || order.userName || 'Walk-in Customer';
                const address = order.user?.address || order.address || '';
                
                if (!groups[mobile]) {
                    groups[mobile] = {
                        name,
                        mobile,
                        address,
                        orders: [],
                        orderCount: 0
                    };
                }
                
                groups[mobile].orders.push(order);
                groups[mobile].orderCount += 1;
                
                // Keep the most complete address and name
                if (address.length > groups[mobile].address.length) {
                    groups[mobile].address = address;
                }
                if (name !== 'Walk-in Customer' && groups[mobile].name === 'Walk-in Customer') {
                    groups[mobile].name = name;
                }
            });

            // Convert to array and sort by order count descending
            const groupedList = Object.values(groups).sort((a, b) => b.orderCount - a.orderCount);
            setGroupedCustomers(groupedList);
        } catch (err) {
            console.error("Error fetching orders for grouping:", err);
            setError("Failed to load orders summary.");
        } finally {
            setLoading(false);
        }
    };

    // Filter customers based on search query
    const filteredCustomers = groupedCustomers.filter(customer => {
        const query = searchQuery.toLowerCase();
        return (
            customer.name.toLowerCase().includes(query) ||
            customer.mobile.includes(query)
        );
    });

    // Helper: gross items total (before any payment/discount adjustments)
    const getGrossTotal = (order) => {
        return (order.items || []).reduce((sum, item) => {
            const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && item.quantityOrdered === 0);
            const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
            return sum + (qty * (item.price || 0));
        }, 0);
    };

    // Helper: total charges/discounts (non-payment adjustments)
    const getNonPaymentAdjustments = (order) => {
        let net = 0;
        (order.adjustments || []).forEach(adj => {
            if (adj.type === 'payment' || adj.type === 'advance') return; // handled separately
            if (adj.type === 'charge') net += adj.amount;
            else net -= adj.amount;
        });
        return net;
    };

    // Helper: extract payment/advance adjustments (amount received)
    const getOrderPayments = (order) => {
        return (order.adjustments || []).filter(
            adj => adj.type === 'payment' || adj.type === 'advance'
        );
    };

    // Helper: total amount received for an order
    const getTotalReceived = (order) => {
        return getOrderPayments(order).reduce((sum, p) => sum + (p.amount || 0), 0);
    };

    // Helper: net order total (gross + charges - discounts) — does NOT subtract payments (those are receipts)
    const getOrderTotal = (order) => {
        return getGrossTotal(order) + getNonPaymentAdjustments(order);
    };

    // Helper: balance due = order total - amount received
    const getBalanceDue = (order) => {
        return getOrderTotal(order) - getTotalReceived(order);
    };

    // Generate PDF for selected customer's orders within date range
    const generatePdfReport = async (customer) => {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 12;

        // Fonts loading
        const isFontLoaded = await loadCustomFont(doc);
        const primaryFont = isFontLoaded ? 'tamil_font' : 'helvetica';
        doc.setFont(primaryFont);

        // Load static header assets
        const [logoData, phoneIconData] = await Promise.all([
            loadImageAsDataUrl('/images/head.png'),
            loadImageAsDataUrl('/images/phone.png')
        ]);

        // Filter orders by date range
        const filteredOrders = customer.orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            if (startDate && orderDate < new Date(startDate)) return false;
            if (endDate) {
                const limitDate = new Date(endDate);
                limitDate.setDate(limitDate.getDate() + 1);
                if (orderDate >= limitDate) return false;
            }
            return true;
        });

        // 1. Draw PDF Header
        if (logoData) {
            const logoTargetH = 15;
            const logoW = logoTargetH * (logoData.width / logoData.height);
            const logoX = margin + 2;
            const logoY = 12;
            doc.addImage(logoData.dataUrl, 'PNG', logoX, logoY, logoW, logoTargetH);

            const textX = logoX + logoW + 4;
            const nameY = logoY + (logoTargetH * 0.45);
            const subY = logoY + (logoTargetH * 0.75);

            doc.setFont(primaryFont, 'bold');
            doc.setFontSize(15);
            doc.setTextColor(15, 82, 186); // Sapphire blue
            doc.text('KSK VASU & Co', textX, nameY);

            doc.setFont(primaryFont, 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(80, 80, 80);
            doc.text('Building Materials Service Center', textX, subY);

            doc.setFont(primaryFont, 'bold');
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);

            const phone1 = '9443350464';
            const phone2 = '9566530464';
            const phone1W = doc.getTextWidth(phone1);
            const phone2W = doc.getTextWidth(phone2);
            const iconSize = 3.2;
            const iconPadding = 1.5;
            const rightEdge = pageWidth - margin - 2;

            if (phoneIconData) {
                doc.addImage(phoneIconData.dataUrl, 'PNG', rightEdge - phone1W - iconPadding - iconSize, logoY + 4 - (iconSize * 0.75), iconSize, iconSize);
            }
            doc.text(phone1, rightEdge, logoY + 4, { align: 'right', link: { url: 'tel:9443350464' } });

            if (phoneIconData) {
                doc.addImage(phoneIconData.dataUrl, 'PNG', rightEdge - phone2W - iconPadding - iconSize, logoY + 9 - (iconSize * 0.75), iconSize, iconSize);
            }
            doc.text(phone2, rightEdge, logoY + 9, { align: 'right', link: { url: 'tel:9566530464' } });
        }

        doc.setLineWidth(0.2);
        doc.setDrawColor(0, 0, 0);
        doc.line(margin, 30, pageWidth - margin, 30);

        // Document Details (Report Subheader)
        doc.setFont(primaryFont, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 82, 186);
        doc.text('DETAILED ORDER REPORT', margin + 2, 36);
        
        doc.setFont(primaryFont, 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(80, 80, 80);
        doc.text(`Date Range: ${startDate || 'All Time'} to ${endDate || 'Present'}`, margin + 2, 41);
        doc.text(`Total Orders: ${filteredOrders.length}`, pageWidth - margin - 2, 36, { align: 'right' });

        // Customer Info Block (Clean Left-Right Split)
        const blockY = 46;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.15);
        doc.rect(margin, blockY, pageWidth - (margin * 2), 22);

        // Vertical line in block
        doc.line(pageWidth / 2 + 5, blockY, pageWidth / 2 + 5, blockY + 22);

        doc.setFont(primaryFont, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text('To:', margin + 3, blockY + 5);
        
        // Render name and address to canvas to keep perfect shaped Tamil connections
        const nameImg = createMultilineImage(customer.name, 1.25);
        const addressImg = customer.address ? createMultilineImage(customer.address, 0.95) : null;

        if (nameImg) {
            const finalH = 4.2;
            const finalW = finalH * (nameImg.width / nameImg.height);
            doc.addImage(nameImg.dataUrl, 'PNG', margin + 3, blockY + 7.5, finalW, finalH);
        } else {
            doc.setFont(primaryFont, 'bold');
            doc.setFontSize(10);
            doc.text(customer.name, margin + 3, blockY + 11);
        }
        
        if (addressImg) {
            const finalH = Math.min(8.5, 4.2 * (addressImg.height / 32));
            const finalW = finalH * (addressImg.width / addressImg.height);
            doc.addImage(addressImg.dataUrl, 'PNG', margin + 3, blockY + 12.8, finalW, finalH);
        }

        // Right side customer details
        doc.setFont(primaryFont, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text('Customer Contact:', pageWidth / 2 + 8, blockY + 5);
        
        doc.setFont(primaryFont, 'normal');
        doc.setFontSize(9);
        doc.text(`Mobile: ${customer.mobile}`, pageWidth / 2 + 8, blockY + 11);
        
        const curTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        doc.text(`Exported on: ${new Date().toLocaleDateString()} ${curTimeStr}`, pageWidth / 2 + 8, blockY + 16);

        // Master-Detail table construction
        const tableColumn = ["S.No", "Description / Items", "Qty", "Unit", "Rate (Rs)", "Amount (Rs)"];
        const tableRows = [];
        const itemDescImages = {};
        let grandTotal = 0;
        let grandReceived = 0;
        let serialCount = 1;
        let tableRowIndex = 0;

        filteredOrders.forEach((order) => {
            const orderTotal = getOrderTotal(order);
            const totalReceived = getTotalReceived(order);
            const balanceDue = orderTotal - totalReceived;
            grandTotal += orderTotal;
            grandReceived += totalReceived;
            const _d = new Date(order.createdAt);
            const orderTime = _d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()} ${orderTime}`;
            const displayId = order.customOrderId || (order._id ? order._id.slice(-8).toUpperCase() : 'N/A');

            // 1. Order Separator Row
            tableRows.push([
                { 
                    content: `Order ID: ${displayId}  |  Date: ${dateStr}  |  Status: ${order.status || 'Ordered'}`, 
                    colSpan: 6, 
                    styles: { fillColor: [240, 246, 255], fontStyle: 'bold', textColor: [15, 82, 186], fontSize: 9 } 
                }
            ]);
            tableRowIndex++;

            // 2. Add Order Items
            (order.items || []).forEach((item) => {
                const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && item.quantityOrdered === 0);
                const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
                const rate = item.price || 0;
                const amt = qty * rate;

                const text = item.name + (item.description ? ` (${item.description})` : '');
                const hasTamilText = isTamil(text);
                
                if (hasTamilText) {
                    itemDescImages[tableRowIndex] = createMultilineImage(text, 1.05);
                }

                tableRows.push([
                    serialCount.toString(),
                    hasTamilText ? "" : text,
                    isQtyHidden ? 'N/A' : qty.toString(),
                    item.unit || 'Nos',
                    rate.toFixed(2),
                    amt.toFixed(2)
                ]);
                serialCount++;
                tableRowIndex++;
            });

            // 3. Non-payment Adjustments (charges, discounts)
            (order.adjustments || []).filter(a => a.type !== 'payment' && a.type !== 'advance').forEach((adj) => {
                const amt = adj.amount || 0;
                const sign = adj.type === 'charge' ? '+' : '-';
                const text = `${adj.description || 'Adjustment'}`;
                const hasTamilText = isTamil(text);

                if (hasTamilText) {
                    itemDescImages[tableRowIndex] = createMultilineImage(text, 1.0);
                }

                tableRows.push([
                    "",
                    hasTamilText ? "" : text,
                    "", "", "",
                    `${sign}${amt.toFixed(2)}`
                ]);
                tableRowIndex++;
            });

            // 4. Order Net Total row
            tableRows.push([
                { content: 'Order Net Total', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 252, 255], fontSize: 8.5 } },
                { content: `Rs. ${orderTotal.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 252, 255], fontSize: 8.5, textColor: [15, 82, 186] } }
            ]);
            tableRowIndex++;

            // 5. Amount Received rows (one per payment entry with date)
            const payments = getOrderPayments(order);
            if (payments.length > 0) {
                payments.forEach((p) => {
                    let payLabel = p.description || 'Amount Received';
                    if (p.date) {
                        const pd = new Date(p.date);
                        const pDateStr = `${String(pd.getDate()).padStart(2,'0')}/${String(pd.getMonth()+1).padStart(2,'0')}/${pd.getFullYear()}`;
                        payLabel += ` (${pDateStr})`;
                    }
                    tableRows.push([
                        "",
                        payLabel,
                        "", "", "",
                        `- Rs. ${(p.amount || 0).toFixed(2)}`
                    ]);
                    tableRowIndex++;
                });

                // 6. Balance Due row
                tableRows.push([
                    { 
                        content: `Balance Due`, 
                        colSpan: 5, 
                        styles: { halign: 'right', fontStyle: 'bold', fillColor: balanceDue <= 0 ? [220, 255, 230] : [255, 240, 235], fontSize: 8.5 } 
                    },
                    { 
                        content: `Rs. ${balanceDue.toFixed(2)}`, 
                        styles: { 
                            fontStyle: 'bold', halign: 'right', fontSize: 8.5,
                            fillColor: balanceDue <= 0 ? [220, 255, 230] : [255, 240, 235],
                            textColor: balanceDue <= 0 ? [21, 128, 61] : [185, 28, 28] 
                        } 
                    }
                ]);
                tableRowIndex++;
            }
        });

        const grandBalance = grandTotal - grandReceived;

        autoTable(doc, {
            startY: 72,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 82, 186], textColor: 255, lineColor: 180, lineWidth: 0.1, halign: 'center', fontStyle: 'bold', fontSize: 9 },
            styles: { font: primaryFont, fontSize: 8, lineColor: 220, lineWidth: 0.1, textColor: 50, valign: 'middle' },
            columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'center', cellWidth: 12 }, 3: { halign: 'center', cellWidth: 12 }, 4: { halign: 'right', cellWidth: 22 }, 5: { halign: 'right', cellWidth: 25 } },
            margin: { left: margin, right: margin, bottom: 20 },
            foot: [
                [
                    { content: 'Grand Order Total', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9 } },
                    { content: `Rs. ${grandTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, textColor: [15, 82, 186] } }
                ],
                [
                    { content: 'Total Amount Received', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, fillColor: [220, 255, 230] } },
                    { content: `Rs. ${grandReceived.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, textColor: [21, 128, 61], fillColor: [220, 255, 230] } }
                ],
                [
                    { content: 'Grand Balance Due', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9.5, fillColor: grandBalance <= 0 ? [220, 255, 230] : [255, 240, 235] } },
                    { content: `Rs. ${grandBalance.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9.5, textColor: grandBalance <= 0 ? [21, 128, 61] : [185, 28, 28], fillColor: grandBalance <= 0 ? [220, 255, 230] : [255, 240, 235] } }
                ]
            ],
            footStyles: { fillColor: [235, 240, 250], textColor: 0, lineColor: 180, lineWidth: 0.1 },
            didDrawCell: (data) => {
                // If cell index is 1 (Description / Items) and has generated Canvas PNG, draw it in cell
                if (data.section === 'body' && data.column.index === 1) {
                    const imgData = itemDescImages[data.row.index];
                    if (imgData) {
                        const cellH = data.cell.height;
                        const cellW = data.cell.width;
                        const pad = 1.6;
                        const targetH = cellH - (pad * 2);
                        const targetW = targetH * (imgData.width / imgData.height);
                        
                        const finalW = Math.min(targetW, cellW - (pad * 2));
                        const finalH = finalW * (imgData.height / imgData.width);
                        
                        const x = data.cell.x + pad;
                        const y = data.cell.y + (cellH - finalH) / 2;
                        doc.addImage(imgData.dataUrl, 'PNG', x, y, finalW, finalH);
                    }
                }
            },
            didDrawPage: (data) => {
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

                doc.setFont(primaryFont, 'bold');
                doc.setFontSize(8);
                doc.setTextColor(15, 82, 186); // Sapphire blue
                doc.text('www.kskvasu.co.in', margin + 2, pageHeight - 9, { link: { url: 'https://www.kskvasu.co.in' } });

                doc.setFont(primaryFont, 'bold');
                doc.setTextColor(80, 80, 80);
                doc.text('Thank You..! Visit Again', pageWidth - margin - 2, pageHeight - 9, { align: 'right' });
            }
        });

        const pdfName = `Detailed_Orders_Report_${customer.name.replace(/\s+/g, '_')}.pdf`;
        doc.save(pdfName);
    };

    return (
        <div style={{ padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b', background: '#f8fafc', minHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>📊 Order Count Summary</h2>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Overview of active orders grouped by customer mobile numbers</p>
                </div>
                <button 
                    onClick={fetchOrders} 
                    style={{ background: '#0f52ba', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
                    onMouseOver={e => e.target.style.background = '#0d47a1'}
                    onMouseOut={e => e.target.style.background = '#0f52ba'}
                >
                    🔄 Refresh Data
                </button>
            </div>

            {/* Search Input Card */}
            <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '20px', marginRight: '10px' }}>🔍</span>
                <input
                    type="text"
                    placeholder="Search by customer name or mobile number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px', color: '#0f172a' }}
                />
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                    <div style={{ border: '4px solid #e2e8f0', borderTop: '4px solid #0f52ba', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '12px', color: '#64748b', fontWeight: 600 }}>Loading orders summary...</p>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : error ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <strong>⚠️ Error:</strong> {error}
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '14px 18px', fontWeight: 700, fontSize: '14px', color: '#475569' }}>Customer Name</th>
                                <th style={{ padding: '14px 18px', fontWeight: 700, fontSize: '14px', color: '#475569' }}>Mobile Number</th>
                                <th style={{ padding: '14px 18px', fontWeight: 700, fontSize: '14px', color: '#475569' }}>Primary Address</th>
                                <th style={{ padding: '14px 18px', fontWeight: 700, fontSize: '14px', color: '#475569', textAlign: 'center' }}>Order Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No matching customers found.</td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer, index) => (
                                    <tr 
                                        key={customer.mobile} 
                                        onClick={() => setSelectedCustomer(customer)}
                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseOut={e => e.currentTarget.style.background = 'white'}
                                    >
                                        <td style={{ padding: '16px 18px', fontWeight: 600, color: '#0f172a' }}>{customer.name}</td>
                                        <td style={{ padding: '16px 18px', color: '#334155' }}>📞 {customer.mobile}</td>
                                        <td style={{ padding: '16px 18px', color: '#64748b', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {customer.address || <span style={{ color: '#cbd5e1' }}>N/A</span>}
                                        </td>
                                        <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                                            <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', fontSize: '13px' }}>
                                                {customer.orderCount} Orders
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Customer Detail & PDF Generation Modal */}
            {selectedCustomer && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setSelectedCustomer(null)}>
                    <div style={{ background: 'white', borderRadius: '16px', maxWidth: '850px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
                        
                        {/* Modal Header */}
                        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{selectedCustomer.name}</h3>
                                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>Mobile: {selectedCustomer.mobile}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedCustomer(null)}
                                style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', color: '#475569' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content Scroll */}
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            
                            {/* Date Filter & Action Bar */}
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                                <div style={{ flex: 1, minWidth: '140px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Start Date</label>
                                    <input 
                                        type="date" 
                                        value={startDate} 
                                        onChange={(e) => setStartDate(e.target.value)}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: '140px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>End Date</label>
                                    <input 
                                        type="date" 
                                        value={endDate} 
                                        onChange={(e) => setEndDate(e.target.value)}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                                    />
                                </div>
                                <button 
                                    onClick={() => generatePdfReport(selectedCustomer)}
                                    style={{ flex: 1.5, background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minWidth: '180px' }}
                                >
                                    📥 Export Detailed Orders PDF
                                </button>
                            </div>

                            {/* Orders Detailed List */}
                            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>Detailed Order History</h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {selectedCustomer.orders.map((order, idx) => {
                                    const _d = new Date(order.createdAt);
                                    const onlyDateStr = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()}`;
                                    const orderTime = _d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const displayId = order.customOrderId || (order._id ? order._id.slice(-8).toUpperCase() : 'N/A');
                                    const orderTotal = getOrderTotal(order);

                                    return (
                                        <div key={order._id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                            {/* Order header bar - 2 row grid layout to avoid wrapping overlaps */}
                                            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 800, color: '#0f172a' }}>ID: {displayId}</span>
                                                    <span style={{ fontSize: '13.5px', color: '#64748b', fontWeight: 600 }}>{onlyDateStr}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                                    <span style={{ fontSize: '12px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
                                                        {order.status || 'Ordered'}
                                                    </span>
                                                    <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>{orderTime}</span>
                                                </div>
                                            </div>

                                            {/* Order items nested list */}
                                            <div style={{ padding: '16px' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', marginBottom: '12px' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontWeight: 'bold' }}>
                                                            <th style={{ padding: '6px 0', width: '50%' }}>Item Description</th>
                                                            <th style={{ padding: '6px 0', textAlign: 'center', width: '15%' }}>Qty</th>
                                                            <th style={{ padding: '6px 0', textAlign: 'center', width: '15%' }}>Unit</th>
                                                            <th style={{ padding: '6px 0', textAlign: 'right', width: '20%' }}>Rate × Qty = Price</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(order.items || []).map((item, itemIdx) => {
                                                            const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && item.quantityOrdered === 0);
                                                            const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
                                                            const rate = item.price || 0;
                                                            const amt = qty * rate;
                                                            return (
                                                                <tr key={item._id || itemIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                    <td style={{ padding: '8px 0', color: '#0f172a', fontWeight: 600 }}>
                                                                        {item.name} {item.description ? <span style={{ fontWeight: 'normal', color: '#64748b', fontSize: '12px' }}>({item.description})</span> : ''}
                                                                    </td>
                                                                    <td style={{ padding: '8px 0', textAlign: 'center' }}>{isQtyHidden ? 'N/A' : qty}</td>
                                                                    <td style={{ padding: '8px 0', textAlign: 'center', color: '#475569' }}>{item.unit || 'Nos'}</td>
                                                                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                                                                        Rs. {rate.toFixed(2)} × {isQtyHidden ? '1' : qty} = Rs. {amt.toFixed(2)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>

                                                {/* Non-payment Adjustments */}
                                                {(order.adjustments || []).filter(a => a.type !== 'payment' && a.type !== 'advance').length > 0 && (
                                                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>Charges / Discounts</span>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {order.adjustments.filter(a => a.type !== 'payment' && a.type !== 'advance').map((adj, adjIdx) => (
                                                                <div key={adj._id || adjIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569' }}>
                                                                    <span>{adj.description || 'Adjustment'}</span>
                                                                    <span style={{ fontWeight: 600, color: adj.type === 'charge' ? '#b91c1c' : '#0369a1' }}>
                                                                        {adj.type === 'charge' ? '+' : '-'} Rs. {(adj.amount || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Order Net Total */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #cbd5e1', paddingTop: '10px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Order Net Total</span>
                                                    <span style={{ color: '#0f52ba', fontSize: '14px', fontWeight: 800 }}>Rs. {orderTotal.toFixed(2)}</span>
                                                </div>

                                                {/* Amount Received (payment entries with date) */}
                                                {getOrderPayments(order).length > 0 && (
                                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', display: 'block', marginBottom: '6px' }}>💰 Amount Received</span>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {getOrderPayments(order).map((p, pIdx) => {
                                                                let payLabel = p.description || 'Payment';
                                                                let payDateStr = '';
                                                                if (p.date) {
                                                                    const pd = new Date(p.date);
                                                                    payDateStr = `${String(pd.getDate()).padStart(2,'0')}/${String(pd.getMonth()+1).padStart(2,'0')}/${pd.getFullYear()}`;
                                                                }
                                                                return (
                                                                    <div key={p._id || pIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                                                        <span style={{ color: '#166534', fontWeight: 600 }}>
                                                                            {payLabel}{payDateStr ? <span style={{ fontWeight: 'normal', color: '#6b7280', marginLeft: '4px', fontSize: '11px' }}>({payDateStr})</span> : ''}
                                                                        </span>
                                                                        <span style={{ fontWeight: 700, color: '#15803d' }}>- Rs. {(p.amount || 0).toFixed(2)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Balance Due */}
                                                {(() => {
                                                    const balanceDue = getBalanceDue(order);
                                                    const hasPayments = getOrderPayments(order).length > 0;
                                                    return hasPayments ? (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #e2e8f0', paddingTop: '10px' }}>
                                                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Balance Due</span>
                                                            <span style={{ fontSize: '16px', fontWeight: 900, color: balanceDue <= 0 ? '#15803d' : '#dc2626', background: balanceDue <= 0 ? '#dcfce7' : '#fef2f2', padding: '3px 12px', borderRadius: '8px' }}>
                                                                Rs. {balanceDue.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1.5px solid #cbd5e1', paddingTop: '8px' }}>
                                                            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No payment recorded</span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OrderCount;
