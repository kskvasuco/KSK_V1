import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Load Tamil font for jsPDF
const loadCustomFont = async (doc) => {
    try {
        const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/muktamalar/MuktaMalar-Regular.ttf';
        const response = await fetch(fontUrl);
        if (!response.ok) return false;
        const buffer = await response.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = window.btoa(binary);
        doc.addFileToVFS('MuktaMalar.ttf', b64);
        doc.addFont('MuktaMalar.ttf', 'tamil_font', 'normal');
        doc.addFont('MuktaMalar.ttf', 'tamil_font', 'bold');
        return true;
    } catch (error) {
        console.error("Exception loading custom font for PDF:", error);
        return false;
    }
};

const isTamil = (text) => {
    if (!text) return false;
    return /[\u0B80-\u0BFF]/.test(text);
};

// Load image from URL → {dataUrl, width, height}
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

const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const g = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion', 'Quintillion', 'Sextillion', 'Septillion', 'Octillion', 'Nonillion'];
    
    const grp = n => ('000' + n).substr(-3);
    const rem = n => n.substr(0, n.length - 3);
    const fmt = ([h, t, o]) => {
        let str = '';
        str += h !== '0' ? a[h] + 'Hundred ' : '';
        str += t !== '0' ? (str !== '' ? 'and ' : '') + (b[t] || a[t + o]) + ' ' : '';
        str += t !== '0' && b[t] && o !== '0' ? a[o] : (t === '0' && o !== '0' ? a[o] : '');
        return str;
    };
    
    if (isNaN(num)) return '';
    if (num === 0) return 'Zero';
    
    let str = '', i = 0;
    let n = Math.floor(num).toString();
    while (n.length > 0) {
        let g1 = grp(n);
        let f = fmt(g1);
        if (f !== '') str = f + g[i] + ' ' + str;
        n = rem(n);
        i++;
    }
    return str.trim() + ' Only';
};

// Create a semi-transparent watermark image (returns Promise<dataUrl>)
const createWatermarkImage = (srcDataUrl, srcWidth, srcHeight, opacity = 0.10) => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = srcWidth;
                canvas.height = srcHeight;
                const ctx = canvas.getContext('2d');
                ctx.globalAlpha = opacity;
                ctx.drawImage(img, 0, 0, srcWidth, srcHeight);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = srcDataUrl;
        } catch (e) { resolve(null); }
    });
};

const createTextImage = (text, bold = true) => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const weight = bold ? 'bold' : 'normal';
        ctx.font = `${weight} 24px sans-serif`;
        const metrics = ctx.measureText(text);
        canvas.width = metrics.width + 4;
        canvas.height = 36;
        ctx.font = `${weight} 24px sans-serif`;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    } catch (e) { return null; }
};

const rateImg = createTextImage("Rate (₹)");
const amountImg = createTextImage("Amount (₹)");

const createPhoneIcon = () => {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#000000";
        // Simple phone handset shape
        ctx.beginPath();
        ctx.moveTo(8, 6);
        ctx.quadraticCurveTo(4, 6, 4, 10);
        ctx.lineTo(4, 14);
        ctx.quadraticCurveTo(4, 24, 14, 28);
        ctx.lineTo(18, 28);
        ctx.quadraticCurveTo(22, 28, 22, 24);
        ctx.lineTo(22, 20);
        ctx.quadraticCurveTo(22, 18, 20, 18);
        ctx.lineTo(16, 18);
        ctx.quadraticCurveTo(14, 18, 14, 20);
        ctx.lineTo(14, 22);
        ctx.quadraticCurveTo(10, 20, 8, 16);
        ctx.lineTo(8, 14);
        ctx.quadraticCurveTo(8, 12, 10, 12);
        ctx.lineTo(12, 12);
        ctx.quadraticCurveTo(14, 12, 14, 10);
        ctx.lineTo(14, 6);
        ctx.quadraticCurveTo(14, 4, 12, 4);
        ctx.closePath();
        ctx.fill();
        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    } catch (e) { return null; }
};

const phoneIconData = createPhoneIcon();

const createMultilineImage = (text, scaleFactor = 1) => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const hasTamil = isTamil(text);
        const baseSize = 32;
        const fontSize = hasTamil ? (baseSize * scaleFactor) : baseSize; 
        ctx.font = `bold ${fontSize}px sans-serif`;
        
        const maxWidthPx = 600;
        const inputLines = text.split('\n');
        let finalLines = [];

        inputLines.forEach(line => {
            if (!line.trim()) {
                finalLines.push(''); // Keep empty lines for "gaps"
                return;
            }
            const words = line.split(' ');
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
        });

        const lineHeight = fontSize * 1.35;
        let actualMaxWidth = 0;
        finalLines.forEach(l => { 
            const w = ctx.measureText(l).width; 
            if (w > actualMaxWidth) actualMaxWidth = w; 
        });

        canvas.width = Math.max(actualMaxWidth + 4, 10); // Ensure width
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

// ─────────────────────────────────────────────────────────────────────────────
// Core PDF builder — shared between both exports
// ─────────────────────────────────────────────────────────────────────────────
// ─── Core PDF builder ────────────────────────────────────────────────────────
const buildPdf = async (order, withHeader = false, paymentSetting = null) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5', compress: true });
    const pageWidth = doc.internal.pageSize.width;   // 148 mm
    const pageHeight = doc.internal.pageSize.height;  // 210 mm
    const margin = 8;
    const contentWidth = pageWidth - 2 * margin;
    const formatCurrency = (amount) => Number(amount).toFixed(2);

    // Fonts
    const isFontLoaded = await loadCustomFont(doc);
    const primaryFont = isFontLoaded ? 'tamil_font' : 'helvetica';
    doc.setFont(primaryFont);

    // Images
    const [logoData] = await Promise.all([
        withHeader ? loadImageAsDataUrl('/images/head.png') : Promise.resolve(null)
    ]);

    // Watermark generation (header PDF only)
    let watermarkData = null;
    if (withHeader && logoData) {
        const watermarkDataUrl = await createWatermarkImage(logoData.dataUrl, logoData.width, logoData.height, 0.09);
        if (watermarkDataUrl) {
            watermarkData = { dataUrl: watermarkDataUrl, width: logoData.width, height: logoData.height };
        }
    }

    const borderTopY = margin;
    const borderBottomY = pageHeight - margin;
    const borderHeight = borderBottomY - borderTopY;

    // ── FUNCTION: Draw border/header/watermark on every page ──────────────────
    const drawPageShell = (p) => {
        // Outer border
        p.setLineWidth(0.5);
        p.rect(margin, borderTopY, contentWidth, borderHeight);
    };

    const drawWatermark = (p) => {
        if (withHeader && watermarkData) {
            const wmW = contentWidth;
            const wmH = wmW * (watermarkData.height / watermarkData.width);
            const wmX = margin;
            const wmY = borderTopY + (borderHeight - wmH) / 2;
            p.addImage(watermarkData.dataUrl, 'PNG', wmX, wmY, wmW, wmH);
        }
    };

    // Draw for the first page (Shell only - Watermark moved to didDrawPage)
    drawPageShell(doc);
    if (withHeader) drawWatermark(doc); // Draw initially, and again in didDrawPage to stay visible

    // ─── HEADER SECTION (header PDF only) ─────────
    let currentY; 

    if (withHeader && logoData) {
        const logoTargetH = 20;
        const logoW = logoTargetH * (logoData.width / logoData.height);
        const logoX = margin + 4;
        const logoY = borderTopY + 3;
        doc.addImage(logoData.dataUrl, 'PNG', logoX, logoY, logoW, logoTargetH);

        const textX = logoX + logoW + 4;
        const nameY = logoY + (logoTargetH * 0.42);
        const subY = logoY + (logoTargetH * 0.70);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('KSK VASU & Co', textX, nameY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Building Materials Service Center', textX, subY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        
        const phone1 = '9443350464';
        const phone2 = '9566530464';
        const phone1W = doc.getTextWidth(phone1);
        const phone2W = doc.getTextWidth(phone2);
        const iconSize = 3.5;
        const iconPadding = 1.5;
        const rightEdge = pageWidth - margin - 2;

        // Phone 1 row
        if (phoneIconData) {
            doc.addImage(phoneIconData.dataUrl, 'PNG', rightEdge - phone1W - iconPadding - iconSize, borderTopY + 8.5 - (iconSize * 0.75), iconSize, iconSize);
        }
        doc.text(phone1, rightEdge, borderTopY + 8.5, { align: 'right' });

        // Phone 2 row
        if (phoneIconData) {
            doc.addImage(phoneIconData.dataUrl, 'PNG', rightEdge - phone2W - iconPadding - iconSize, borderTopY + 15.5 - (iconSize * 0.75), iconSize, iconSize);
        }
        doc.text(phone2, rightEdge, borderTopY + 15.5, { align: 'right' });

        const headerLineY = borderTopY + logoTargetH + 6;
        doc.setLineWidth(0.4);
        doc.line(margin, headerLineY, pageWidth - margin, headerLineY);

        currentY = headerLineY + 8;
        doc.setFontSize(12);
        doc.setFont(primaryFont, 'bold');
        doc.text("ESTIMATE", pageWidth / 2, currentY - 2, { align: "center" });
        doc.setLineWidth(0.2);
        doc.line(margin, currentY, pageWidth - margin, currentY);
    } else {
        currentY = 16;
        doc.setFontSize(12);
        doc.setFont(primaryFont, 'bold');
        doc.text("ESTIMATE", pageWidth / 2, currentY - 2, { align: "center" });
        doc.setLineWidth(0.2);
        doc.line(margin, currentY, pageWidth - margin, currentY);
    }

    // ─── CUSTOMER (Left) & ORDER DETAILS (Right) ────────────
    const midX = pageWidth / 2 + 10;
    const leftColW = midX - margin - 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("Buyer:", margin + 2, currentY + 6);

    const hasTamilName = isTamil(order.user?.name);
    doc.setFontSize(hasTamilName ? 14 : 10);
    const customerInfo = order.user?.mobile ? `${order.user?.name || "N/A"} - ${order.user.mobile}` : (order.user?.name || "N/A");
    doc.text(customerInfo, margin + 2, currentY + 12);

    let leftColEndY = currentY + (hasTamilName ? 14 : 11); 
    doc.setFont(primaryFont, 'normal');

    if (order.user?.address) {
        const address = order.user.address;
        const hasTamilAddress = isTamil(address);
        
        const addrImg = createMultilineImage(address.trim(), hasTamilAddress ? 0.80 : 1);
        if (addrImg) {
            const scale = 0.12;
            let imgW = addrImg.width * scale;
            let imgH = addrImg.height * scale;
            if (imgW > leftColW) { imgH = imgH * (leftColW / imgW); imgW = leftColW; }
            doc.addImage(addrImg.dataUrl, 'PNG', margin + 2, leftColEndY + 1, imgW, imgH);
            leftColEndY += imgH + 2; 
        } else {
            leftColEndY += 4;
        }
    }

    if (order.deliveryAgent) {
        const agent = order.deliveryAgent;
        let deliveryInfo = (agent.address || agent.description || '').trim();

        if (deliveryInfo) {
            const noteStartY = leftColEndY + 2;
            const hasTamilAgent = isTamil(deliveryInfo);
            const noteImg = createMultilineImage(deliveryInfo.trim(), hasTamilAgent ? 0.80 : 1);
            if (noteImg) {
                const scale = 0.12;
                let imgW = noteImg.width * scale;
                let imgH = noteImg.height * scale;
                if (imgW > leftColW) { imgH = imgH * (leftColW / imgW); imgW = leftColW; }
                doc.addImage(noteImg.dataUrl, 'PNG', margin + 2, noteStartY, imgW, imgH);
                leftColEndY = noteStartY + imgH;
            } else {
                leftColEndY = noteStartY + 4;
            }
        }
    }

    const orderId = order.customOrderId || order._id.substring(0, 8);
    const _d = new Date(order.createdAt);
    const orderDate = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('No', midX + 2, currentY + 6);
    doc.text(`: ${orderId}`, midX + 16, currentY + 6);
    doc.text('Date', midX + 2, currentY + 12);
    doc.text(`: ${orderDate}`, midX + 16, currentY + 12);
    doc.text('Order Status', midX + 2, currentY + 18);
    doc.text(`: ${order.status}`, midX + 25, currentY + 18);

    const sectionH = Math.max(leftColEndY - currentY, currentY + 22 - currentY) + 4;
    doc.setLineWidth(0.2);
    doc.line(midX, currentY, midX, currentY + sectionH);
    doc.line(margin, currentY + sectionH, pageWidth - margin, currentY + sectionH);
    currentY += sectionH;

    // ─── TOTALS ─────────────────────────────────────────────────────
    let totalItemsAmount = 0;
    const descImages = [];
    if (order.items?.length > 0) {
        order.items.forEach((item) => {
            const text = item.description ? `${item.name} (${item.description})` : item.name;
            descImages.push(createMultilineImage(text));
            totalItemsAmount += item.quantityOrdered * item.price;
        });
    }

    let finalGross = totalItemsAmount;
    if (order.adjustments?.length > 0) {
        order.adjustments.forEach((adj) => {
            if (adj.type === 'charge') finalGross += adj.amount;
            else finalGross -= adj.amount;
        });
    }

    const rowH = 6;
    const numAdj = order.adjustments?.length || 0;
    const hasAdj = numAdj > 0;
    let footerH = (hasAdj ? rowH : 0) + 2 + rowH + (numAdj * rowH) + 3 + rowH;

    // Ensure enough height for QR code if provided (QR is ~22mm + padding)
    if (paymentSetting && paymentSetting.qrCode) {
        const minQrFooterH = 26.5; 
        if (footerH < minQrFooterH) footerH = minQrFooterH;
    }

    // ─── ITEMS TABLE ──────────────────────────────────────────────────────────
    const tableColumn = ["S.No", "Description", "Qty", "Unit", "Rate (₹)", "Amount (₹)"];
    const tableRows = (order.items || []).map((item, index) => [
        (index + 1).toString(),
        item.description ? `${item.name} (${item.description})` : item.name,
        Number(item.quantityOrdered).toString(),
        item.unit || 'Nos',
        formatCurrency(item.price),
        formatCurrency(item.quantityOrdered * item.price)
    ]);

    autoTable(doc, {
        startY: currentY,
        head: [tableColumn],
        body: tableRows,
        foot: [[
            { content: 'Gross Amount', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: formatCurrency(totalItemsAmount), styles: { halign: 'right', fontStyle: 'bold' } }
        ]],
        showFoot: 'lastPage',
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: 0, lineColor: 0, lineWidth: 0.2, halign: 'center', font: 'helvetica', fontStyle: 'bold', fontSize: 8.5 },
        footStyles: { fillColor: [245, 245, 245], textColor: 0, lineColor: 0, lineWidth: 0.2, fontSize: 11.5, fontStyle: 'bold' },
        styles: { font: primaryFont, fontSize: 12, lineColor: 0, lineWidth: 0.2, textColor: 0, valign: 'middle', cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 15, halign: 'right' }, 3: { cellWidth: 10, halign: 'center', fontSize: 9 }, 4: { cellWidth: 18, halign: 'right' }, 5: { cellWidth: 22, halign: 'right' } },
        margin: { left: margin + 1, right: margin + 1, bottom: margin + 5 },
        didParseCell: (data) => {
            if (data.section === 'head' && (data.column.index === 4 || data.column.index === 5)) {
                data.cell.text = ''; // Clear text to avoid artifacts like "a u n t"
                data.cell.styles.textColor = [230, 230, 230];
            }
            if (data.section === 'body' && data.column.index === 1) {
                data.cell.text = ''; // Clear text for description as it's replaced by image
                data.cell.styles.textColor = 255;
            }
        },
        didDrawCell: (data) => {
            if (data.section === 'head') {
                let imgPayload = (data.column.index === 4) ? rateImg : (data.column.index === 5 ? amountImg : null);
                if (imgPayload) {
                    const h = data.cell.height * 0.65;
                    const w = h * (imgPayload.width / imgPayload.height);
                    const clampedW = Math.min(w, data.cell.width - 1);
                    const clampedH = clampedW / (imgPayload.width / imgPayload.height);
                    doc.addImage(imgPayload.dataUrl, 'PNG', data.cell.x + (data.cell.width - clampedW) / 2, data.cell.y + (data.cell.height - clampedH) / 2, clampedW, clampedH);
                }
            }
            if (data.section === 'body' && data.column.index === 1 && data.row.index < (order.items?.length || 0)) {
                const imgPayload = descImages[data.row.index];
                if (imgPayload) {
                    const maxW = data.cell.width - 2;
                    const scale = 0.088;
                    let w = imgPayload.width * scale;
                    let h = imgPayload.height * scale;
                    if (w > maxW) { h = h * (maxW / w); w = maxW; }
                    doc.addImage(imgPayload.dataUrl, 'PNG', data.cell.x + 1, data.cell.y + (data.cell.height - h) / 2, w, h);
                }
            }
        },
        didDrawPage: (data) => {
            if (data.pageNumber > 1) drawPageShell(doc);
            if (withHeader) drawWatermark(doc); // Draw watermark over the table content
        }
    });

    // ── FOOTER POSITIONING (PINNED TO BOTTOM) ──────────
    // The USER wants the horizontal line to be at least 4 cm (40 mm) from the bottom.
    // If there are many adjustments, we increase this height dynamically.
    const minFooterH = 40;
    const dynamicFooterH = Math.max(minFooterH, footerH + 5); // +5 for extra padding
    let bY = borderBottomY - dynamicFooterH;
    const fixedFooterY = bY; // Keep this for vertical line drawing

    if (doc.lastAutoTable.finalY > bY - 2) {
        doc.addPage();
        drawPageShell(doc);
        if (withHeader) drawWatermark(doc);
        bY = borderBottomY - dynamicFooterH;
    }

    // Top horizontal line of the footer section
    doc.setLineWidth(0.3);
    doc.line(margin, bY, pageWidth - margin, bY);

    // Vertical line in adjustment section (separator)
    const verticalLineX = pageWidth - margin - 60; // Positioned for balance
    const footerBottomY = borderBottomY;
    doc.setLineWidth(0.4);
    doc.line(verticalLineX, bY, verticalLineX, footerBottomY);

    const drawRightRow = (labelText, valueText, y, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(bold ? 10 : 9);
        const rightEdge = pageWidth - margin - 2;
        const colonX = rightEdge - 22;
        doc.text(labelText, colonX - 2, y + rowH * 0.75, { align: 'right' });
        doc.text(':', colonX, y + rowH * 0.75);
        doc.text(valueText, rightEdge, y + rowH * 0.75, { align: 'right' });
    };

    const qrSize = 20;
    const qrY = borderBottomY - qrSize - 3;
    
    // 1. Rupees (Amount in Words) at the top, Bold & neat
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const amountInWords = numberToWords(finalGross);
    const wordWidth = (verticalLineX - margin) - 6;
    const wrappedWords = doc.splitTextToSize(`Rupees ${amountInWords}`, wordWidth);
    doc.text(wrappedWords, margin + 3, bY + rowH * 0.75);

    // 2. Payment Details, below Rupees and just above the divider line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Payment Details,', margin + 3, qrY - 3);

    // 3. Divider line
    doc.setLineWidth(0.2);
    doc.line(margin, qrY - 1, verticalLineX, qrY - 1);

    doc.setLineWidth(0.3);
    // "Total" is pinned near the bottom
    const totalLineY = borderBottomY - 9;
    doc.line(verticalLineX, totalLineY, pageWidth - margin, totalLineY);
    drawRightRow('Total (Rs)', formatCurrency(finalGross), totalLineY + 0.5, true);

    // Draw adjustments + gross amount — start directly below the top footer line
    let rightRowY = fixedFooterY;

    drawRightRow('Gross Amount (Rs)', formatCurrency(totalItemsAmount), rightRowY);
    rightRowY += rowH;

    if (order.adjustments?.length > 0) {
        let deliveryCount = 0;
        order.adjustments.forEach((adj) => {
            const prefix = adj.type === 'charge' ? '+' : '-';
            let label = adj.description;
            
            // Anonymize dispatch agent collections
            const isAgentCollection = label && (label.startsWith('Collection via Delivery Agent:') || label.startsWith('Collection via Dispatch Agent:'));
            if (isAgentCollection) {
                const agentCollections = order.adjustments.filter(a => 
                    a.description?.startsWith('Collection via Delivery Agent:') || 
                    a.description?.startsWith('Collection via Dispatch Agent:')
                );
                const allItemsDelivered = order.items.every(item => (item.quantityDelivered || 0) >= (item.quantityOrdered || 0));
                const showNumeric = agentCollections.length > 1 || !allItemsDelivered;
                deliveryCount++;
                label = showNumeric ? `Dispatch ${deliveryCount}` : 'Dispatch';
            }
            
            drawRightRow(`${label} (Rs)`, `${prefix}${formatCurrency(adj.amount)}`, rightRowY);
            rightRowY += rowH;
        });
    }

    if (paymentSetting) {
        try {
            const settings = Array.isArray(paymentSetting) ? paymentSetting : [paymentSetting];
            
            // Draw a vertical divider between Bank and QR if both might exist
            const paymentDividerX = margin + (verticalLineX - margin) * 0.55; 
            const qrSize = 20;
            const qrY = borderBottomY - qrSize - 3;
            doc.setLineWidth(0.2);
            doc.line(paymentDividerX, qrY - 1, paymentDividerX, borderBottomY);

            for (let i = 0; i < settings.length; i++) {
                const setting = settings[i];
                if (!setting) continue;

                const qrSize = 20;
                // Position QR code between paymentDividerX and verticalLineX
                const qrX = paymentDividerX + (verticalLineX - paymentDividerX - qrSize) / 2;
                const qrY = borderBottomY - qrSize - 3; 

                // Draw QR Code if available
                if (setting.qrCode) {
                    const qrData = await loadImageAsDataUrl(setting.qrCode);
                    if (qrData) {
                        doc.addImage(qrData.dataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
                    }
                }

                // Draw Bank Details if available
                if (setting.type === 'bank' && (setting.name || setting.accountNumber || setting.ifsc)) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8);
                    
                    const textLeftMargin = margin + 2;
                    let textY = qrY + 3; // Start 3mm below the line (which is at qrY-1)
                    
                    if (setting.accountName) {
                        doc.text(`A/C Name: ${setting.accountName}`, textLeftMargin, textY);
                        textY += 3.5;
                    }
                    if (setting.name) {
                        doc.text(`Bank: ${setting.name}`, textLeftMargin, textY);
                        textY += 3.5;
                    }
                    if (setting.accountNumber) {
                        doc.text(`A/C No: ${setting.accountNumber}`, textLeftMargin, textY);
                        textY += 3.5;
                    }
                    if (setting.ifsc) {
                        doc.text(`IFSC: ${setting.ifsc}`, textLeftMargin, textY);
                    }
                }
            }
        } catch (e) { console.error("Payment Info Error:", e); }
    }

    const footerY = borderBottomY + 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text('www.kskvasu.co.in', margin, footerY);
    doc.text('Thank You..! Visit Again', pageWidth - margin, footerY, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    return doc;
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
const previewPdf = (doc) => {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
};

export const generateBill = async (order, paymentSetting = null) => {
    const doc = await buildPdf(order, false, paymentSetting);
    previewPdf(doc);
};

export const generateBillWithHeader = async (order, paymentSetting = null) => {
    const doc = await buildPdf(order, true, paymentSetting);
    previewPdf(doc);
};
