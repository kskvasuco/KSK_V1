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

const rateImg = createTextImage("Rate (Rs)");
const amountImg = createTextImage("Amount (Rs)");

const createMultilineImage = (text) => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 32;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const words = text.split(' ');
        let lines = [], currentLine = '';
        const maxWidthPx = 600;
        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
            if (ctx.measureText(testLine).width > maxWidthPx && i > 0) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        const lineHeight = fontSize * 1.35;
        let actualMaxWidth = 0;
        lines.forEach(l => { const w = ctx.measureText(l).width; if (w > actualMaxWidth) actualMaxWidth = w; });
        canvas.width = actualMaxWidth + 4;
        canvas.height = (lines.length * lineHeight) + 8;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        lines.forEach((line, i) => ctx.fillText(line, 2, 4 + (i * lineHeight)));
        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    } catch (e) { return null; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Core PDF builder — shared between both exports
// ─────────────────────────────────────────────────────────────────────────────
const buildPdf = async (order, withHeader = false) => {
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

    // Logo (header PDF only)
    const logoData = withHeader ? await loadImageAsDataUrl('/images/head.png') : null;

    // ─────────────────────────────────────────────────────────────────────────
    // Layout constants
    // For header PDF: the outer rect starts at margin, logo+name are INSIDE the
    // top of the rect, separated by a horizontal rule from the ESTIMATE section.
    // For plain PDF: outer rect starts at Y=16 (same as top estimate line).
    // ─────────────────────────────────────────────────────────────────────────
    const borderTopY = margin;                          // outer rect always starts at margin
    const borderBottomY = pageHeight - margin;
    const borderHeight = borderBottomY - borderTopY;

    // ─── OUTER BORDER (full A5 height, drawn first so content overlays it) ───
    doc.setLineWidth(0.5);
    doc.rect(margin, borderTopY, contentWidth, borderHeight);

    // ─── HEADER SECTION (header PDF only) — inside the top of the box ────────
    let currentY; // Y where the ESTIMATE top-line sits

    if (withHeader && logoData) {
        // Logo: compact, fits in a header strip. Target height ~20mm.
        const logoTargetH = 20;
        const logoW = logoTargetH * (logoData.width / logoData.height);
        const logoX = margin + 4;
        const logoY = borderTopY + 3;

        doc.addImage(logoData.dataUrl, 'PNG', logoX, logoY, logoW, logoTargetH);

        // Company name & subtitle — vertically centred beside logo
        const textX = logoX + logoW + 4;
        const nameY = logoY + (logoTargetH * 0.42); // ~42% down the logo height
        const subY = logoY + (logoTargetH * 0.70); // ~70% down

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('KSK VASU & Co', textX, nameY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Building Materials Service Center', textX, subY);

        // Separator under header strip — full-width inside box
        const headerLineY = borderTopY + logoTargetH + 6;
        doc.setLineWidth(0.4);
        doc.line(margin, headerLineY, pageWidth - margin, headerLineY);

        // ESTIMATE sits just below separator
        currentY = headerLineY + 8;
        doc.setFontSize(12);
        doc.setFont(primaryFont, 'bold');
        doc.text("ESTIMATE", pageWidth / 2, currentY - 2, { align: "center" });
        // Horizontal rule below ESTIMATE title
        doc.setLineWidth(0.2);
        doc.line(margin, currentY, pageWidth - margin, currentY);

    } else {
        // Plain PDF: ESTIMATE title above the top line at Y=16
        currentY = 16;
        doc.setFontSize(12);
        doc.setFont(primaryFont, 'bold');
        doc.text("ESTIMATE", pageWidth / 2, currentY - 2, { align: "center" });
        doc.setLineWidth(0.2);
        doc.line(margin, currentY, pageWidth - margin, currentY);
    }

    // ─── CUSTOMER (Left) & ORDER DETAILS (Right) ──────────────────────────────
    doc.setFontSize(10);

    // Left: customer
    doc.setFont(primaryFont, 'bold');
    doc.text("To", margin + 2, currentY + 6);
    const customerStr = (order.user?.name || "N/A") + (order.user?.mobile ? `~${order.user.mobile}` : "");
    doc.text(customerStr, margin + 2, currentY + 12);

    doc.setFont(primaryFont, 'normal');
    if (order.user?.address) {
        const addr = doc.splitTextToSize(order.user.address, 65);
        doc.text(addr, margin + 2, currentY + 18);
    }

    // Vertical divider
    const midX = pageWidth / 2 + 10;
    doc.setLineWidth(0.2);
    doc.line(midX, currentY, midX, currentY + 25);

    // Right: order details — use helvetica so all characters render at same size
    // (Tamil font can make uppercase Latin chars appear inconsistent)
    const orderId = order.customOrderId || order._id.substring(0, 8);
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('No', midX + 2, currentY + 6);
    doc.text(`: ${orderId}`, midX + 16, currentY + 6);

    doc.text('Date', midX + 2, currentY + 12);
    doc.text(`: ${orderDate}`, midX + 16, currentY + 12);

    doc.text('Order Status', midX + 2, currentY + 18);
    doc.text(`: ${order.status}`, midX + 25, currentY + 18);

    currentY += 25;

    // ─── CALCULATE TOTALS ─────────────────────────────────────────────────────
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

    // ─── BOTTOM SECTION: Adjustments + Total (pinned to bottom of A5) ─────────
    const rowH = 6;   // mm per row
    const numAdj = order.adjustments?.length || 0;
    // Space: separator gap (3) + adjustment rows + line-above-total (4) + total row
    const bottomSectionH = 3 + (numAdj * rowH) + 4 + rowH;
    const bottomSectionTopY = borderBottomY - bottomSectionH - 2;

    // ─── ITEMS TABLE ──────────────────────────────────────────────────────────
    const tableColumn = ["S.No", "Description", "Qty", "Unit", "Rate (Rs)", "Amount (Rs)"];
    const tableRows = [];

    if (order.items?.length > 0) {
        order.items.forEach((item, index) => {
            tableRows.push([
                (index + 1).toString(),
                item.description ? `${item.name} (${item.description})` : item.name,
                Number(item.quantityOrdered).toString(),
                item.unit || 'Nos',
                formatCurrency(item.price),
                formatCurrency(item.quantityOrdered * item.price)
            ]);
        });
    }

    autoTable(doc, {
        startY: currentY,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: [230, 230, 230],
            textColor: 0,
            lineColor: 0,
            lineWidth: 0.2,
            halign: 'center',
            font: primaryFont,
            fontStyle: 'bold'
        },
        styles: {
            font: primaryFont,
            fontSize: 8,
            lineColor: 0,
            lineWidth: 0.2,
            textColor: 0,
            valign: 'middle',
            cellPadding: 1.5
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 15, halign: 'right' },
            3: { cellWidth: 10, halign: 'center' },
            4: { cellWidth: 18, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' }
        },
        margin: { left: margin, right: margin },
        didParseCell: function (data) {
            // Hide text for Rate (Rs) and Amount (Rs) headers — drawn as images below
            if (data.section === 'head' && (data.column.index === 4 || data.column.index === 5)) {
                data.cell.styles.textColor = [230, 230, 230];
            }
            // Hide text for Description column body — drawn as canvas images
            if (data.section === 'body' && data.column.index === 1) {
                data.cell.styles.textColor = 255;
            }
        },
        didDrawCell: function (data) {
            // Draw Rate/Amount header images
            if (data.section === 'head') {
                let imgPayload = null;
                if (data.column.index === 4 && rateImg) imgPayload = rateImg;
                if (data.column.index === 5 && amountImg) imgPayload = amountImg;
                if (imgPayload) {
                    const h = data.cell.height * 0.45;
                    const w = h * (imgPayload.width / imgPayload.height);
                    doc.addImage(imgPayload.dataUrl, 'PNG',
                        data.cell.x + (data.cell.width - w) / 2,
                        data.cell.y + (data.cell.height - h) / 2, w, h);
                }
            }
            // Draw description images for item rows
            if (data.section === 'body' && data.column.index === 1 && data.row.index < (order.items?.length || 0)) {
                const imgPayload = descImages[data.row.index];
                if (imgPayload) {
                    const maxW = data.cell.width - 2;
                    const scale = 0.088;
                    let w = imgPayload.width * scale;
                    let h = imgPayload.height * scale;
                    if (w > maxW) { h = h * (maxW / w); w = maxW; }
                    doc.addImage(imgPayload.dataUrl, 'PNG',
                        data.cell.x + 1,
                        data.cell.y + (data.cell.height - h) / 2, w, h);
                }
            }
        }
    });

    // ─── BOTTOM: separator + adjustments + line above total + total ───────────
    // Separator between items table and bottom section
    let bY = bottomSectionTopY;
    doc.setLineWidth(0.3);
    doc.line(margin, bY, pageWidth - margin, bY);
    bY += 3;

    doc.setFont(primaryFont, 'normal');
    doc.setFontSize(9);

    // Adjustment rows
    if (order.adjustments?.length > 0) {
        order.adjustments.forEach((adj) => {
            const prefix = adj.type === 'charge' ? '+' : '-';
            doc.text(`${adj.description} (Adjustment)`, margin + 3, bY + rowH * 0.75);
            doc.setFont('helvetica', 'normal');
            doc.text(`${prefix}${formatCurrency(adj.amount)}`, pageWidth - margin - 2, bY + rowH * 0.75, { align: 'right' });
            doc.setFont(primaryFont, 'normal');
            bY += rowH;
        });
    }

    // ── Line directly above the Total Amount row
    bY += 1;
    doc.setLineWidth(0.3);
    doc.line(margin, bY, pageWidth - margin, bY);
    bY += 3;

    // Total row (bold)
    doc.setFont(primaryFont, 'bold');
    doc.setFontSize(10);
    doc.text('Total Amount', margin + 3, bY + rowH * 0.75);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(finalGross), pageWidth - margin - 2, bY + rowH * 0.75, { align: 'right' });

    // ─── WATERMARK (drawn last → overlays everything including table cells) ────
    if (withHeader && logoData) {
        const watermarkDataUrl = await createWatermarkImage(logoData.dataUrl, logoData.width, logoData.height, 0.09);
        if (watermarkDataUrl) {
            const wmW = contentWidth;
            const wmH = wmW * (logoData.height / logoData.width);
            // Centre within the full bill box
            const wmX = margin;
            const wmY = borderTopY + (borderHeight - wmH) / 2;
            doc.addImage(watermarkDataUrl, 'PNG', wmX, wmY, wmW, wmH);
        }
    }

    return doc;
};

// ─── EXPORT 1: Plain PDF ──────────────────────────────────────────────────────
export const generateBill = async (order) => {
    const doc = await buildPdf(order, false);
    doc.save(`Estimate_${order.customOrderId || order._id.substring(0, 8)}.pdf`);
};

// ─── EXPORT 2: PDF with company header + watermark ───────────────────────────
export const generateBillWithHeader = async (order) => {
    const doc = await buildPdf(order, true);
    doc.save(`Estimate_${order.customOrderId || order._id.substring(0, 8)}_Official.pdf`);
};
