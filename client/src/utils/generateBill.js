import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPrice } from './priceFormatter';

// Helper to convert number to words
const numberToWords = (num) => {
    if (num === 0) return 'Zero';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if ((num = num.toString()).length > 9) return 'overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim() ? str.trim() + ' Only' : '';
};

// Helper to load Tamil font for jsPDF
const loadCustomFont = async (doc) => {
    try {
        // Fetch a known combined Latin+Tamil font from a CORS-friendly CDN (GitHub Raw)
        const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/muktamalar/MuktaMalar-Regular.ttf';
        const response = await fetch(fontUrl);

        if (!response.ok) {
            console.error(`Failed to fetch font from CDN: ${response.status} ${response.statusText}`);
            return false;
        }

        const buffer = await response.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const b64 = window.btoa(binary);

        doc.addFileToVFS('MuktaMalar.ttf', b64);
        doc.addFont('MuktaMalar.ttf', 'tamil_font', 'normal');
        doc.addFont('MuktaMalar.ttf', 'tamil_font', 'bold'); // Map bold to the same font to avoid format errors
        return true;
    } catch (error) {
        console.error("Exception loading custom font for PDF:", error);
        return false;
    }
};

// Helper to load image
const loadImage = (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
    });
};

const createTextWithRupee = (text) => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = "bold 24px sans-serif";
        const metrics = ctx.measureText(text);
        canvas.width = metrics.width + 4;
        canvas.height = 36;
        ctx.font = "bold 24px sans-serif";
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    } catch (e) {
        return null;
    }
};

const rateImg = createTextWithRupee("Rate (₹)");
const amountImg = createTextWithRupee("Amount (₹)");

const createMultilineImage = (text) => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 32;
        ctx.font = `bold ${fontSize}px sans-serif`;

        const words = text.split(' ');
        let lines = [];
        let currentLine = '';
        const maxWidthPx = 600;

        for (let i = 0; i < words.length; i++) {
            let testLine = currentLine + (currentLine ? ' ' : '') + words[i];
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidthPx && i > 0) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);

        const lineHeight = fontSize * 1.35;
        let actualMaxWidth = 0;
        lines.forEach(l => {
            let w = ctx.measureText(l).width;
            if (w > actualMaxWidth) actualMaxWidth = w;
        });

        canvas.width = actualMaxWidth + 4;
        canvas.height = (lines.length * lineHeight) + 8;

        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        lines.forEach((line, i) => {
            ctx.fillText(line, 2, 4 + (i * lineHeight));
        });

        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    } catch (e) {
        return null;
    }
};

export const generateBill = async (order) => {
    // A5 format: 148 x 210 mm
    // Explicitly define portrait ('p') to ensure printer drivers don't get confused
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a5',
        compress: true
    });
    const pageWidth = doc.internal.pageSize.width;

    // Outer border params
    const margin = 8;
    const contentWidth = pageWidth - 2 * margin;

    // Formatting Helpers
    const formatCurrency = (amount) => amount.toFixed(2);

    // Ensure fonts are embedded or fallback to helvetica
    const isFontLoaded = await loadCustomFont(doc);
    const primaryFont = isFontLoaded ? 'tamil_font' : 'helvetica';

    doc.setFont(primaryFont);

    // --- EST/INV TITLE ---
    let currentY = 16;
    doc.setFontSize(12);
    doc.setFont(primaryFont, "bold");
    doc.text("ESTIMATE", pageWidth / 2, currentY - 2, { align: "center" });

    // Top line of the outer main box
    doc.line(margin, currentY, pageWidth - margin, currentY);

    // --- CUSTOMER (Left) & ORDER DETAILS (Right) ---
    doc.setFontSize(10); // Scaled up slightly

    // Left: To (Customer Details)
    doc.setFont(primaryFont, "bold");
    doc.text("To", margin + 2, currentY + 6);

    doc.setFont(primaryFont, "normal");
    const customerStr = (order.user?.name || "N/A") + (order.user?.mobile ? `~${order.user.mobile}` : "");
    doc.setFont(primaryFont, "bold");
    doc.text(customerStr, margin + 2, currentY + 12);

    doc.setFont(primaryFont, "normal");
    if (order.user?.address) {
        const addr = doc.splitTextToSize(order.user.address, 65);
        doc.text(addr, margin + 2, currentY + 18);
    }

    // Vertical Divider Line in Header
    const midX = pageWidth / 2 + 10;
    doc.line(midX, currentY, midX, currentY + 25);

    // Right: Order Details
    doc.setFont(primaryFont, "bold");
    doc.text(`No`, midX + 2, currentY + 6);
    doc.text(`: ${order.customOrderId || order._id.substring(0, 8)}`, midX + 22, currentY + 6);

    doc.text(`Date`, midX + 2, currentY + 12);
    doc.text(`: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, midX + 22, currentY + 12);

    doc.text(`Order Status`, midX + 2, currentY + 18);
    doc.text(`: ${order.status}`, midX + 22, currentY + 18);

    currentY += 25;

    // --- ITEMS TABLE ---
    const tableColumn = ["S.No", "Description", "Qty", "Unit", "Rate (Rs)", "Amount (Rs)"];
    const tableRows = [];

    // Generate images for descriptions accurately using Canvas DOM
    const descImages = [];
    if (order.items && order.items.length > 0) {
        order.items.forEach((item) => {
            const text = item.description ? `${item.name} (${item.description})` : item.name;
            descImages.push(createMultilineImage(text));
        });
    }

    let totalItemsAmount = 0;

    if (order.items && order.items.length > 0) {
        order.items.forEach((item, index) => {
            const itemTotal = item.quantityOrdered * item.price;
            totalItemsAmount += itemTotal;

            tableRows.push([
                (index + 1).toString(),
                item.description ? `${item.name} (${item.description})` : item.name,
                Number(item.quantityOrdered).toString(), // Remove trailing .000 by casting to Number
                item.unit || 'Nos',
                formatCurrency(item.price),
                formatCurrency(itemTotal)
            ]);
        });
    }

    let finalGross = totalItemsAmount;

    // Add Adjustments as rows
    let firstAdjustmentIndex = tableRows.length;

    if (order.adjustments && order.adjustments.length > 0) {
        order.adjustments.forEach((adj, index) => {
            const prefix = adj.type === 'charge' ? '+' : '-';
            const adjTotal = adj.amount;

            if (adj.type === 'charge') {
                finalGross += adjTotal;
            } else {
                finalGross -= adjTotal;
            }

            tableRows.push([
                "",
                `${adj.description} (Adjustment)`,
                "-",
                "-",
                "-",
                `${prefix}${formatCurrency(adjTotal)}`
            ]);
        });
    }

    // Add Total Amount row inside the table
    tableRows.push([
        "",
        "Total Amount",
        "",
        "",
        "",
        formatCurrency(finalGross)
    ]);

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
            fontSize: 8, // Scaled down for A5
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
            // Hide the text for Rate and Amount headers since we'll draw them as images
            if (data.section === 'head' && (data.column.index === 4 || data.column.index === 5)) {
                data.cell.styles.textColor = [230, 230, 230]; // Matches fillColor to make text invisible
            }

            // Hide the text for Description column in body
            if (data.section === 'body' && data.column.index === 1 && data.row.index < (order.items?.length || 0)) {
                data.cell.styles.textColor = 255; // White text to make it invisible
            }

            // Apply styles for adjustments and total rows to remove horizontal borders between them
            // And align the Total Amount text
            if (data.section === 'body' && data.row.index >= firstAdjustmentIndex) {
                const isTotalRow = data.row.index === tableRows.length - 1;
                const isFirstAdjustment = data.row.index === firstAdjustmentIndex && !isTotalRow;

                // Keep the outer left/right borders, remove the horizontal dividers within adjustments
                if (isTotalRow) {
                    // Add a top line to separate the total from the adjustments
                    data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2, left: 0.2, right: 0.2 };
                    data.cell.styles.fontStyle = 'bold';
                    if (data.column.index === 1) {
                        data.cell.styles.halign = 'right'; // Align 'Total Amount' text to the right
                    }
                } else if (isFirstAdjustment) {
                    // Add a top line for the very first adjustment row
                    data.cell.styles.lineWidth = { top: 0.2, bottom: 0, left: 0.2, right: 0.2 };
                } else {
                    data.cell.styles.lineWidth = { top: 0, bottom: 0, left: 0.2, right: 0.2 };
                }
            }
        },
        didDrawCell: function (data) {
            if (data.section === 'head') {
                let imgPayload = null;
                if (data.column.index === 4 && rateImg) imgPayload = rateImg;
                if (data.column.index === 5 && amountImg) imgPayload = amountImg;

                if (imgPayload) {
                    // Calculate image dimensions to fit cell height perfectly
                    const h = data.cell.height * 0.45; // scale down a bit to fit cell nicely
                    const w = h * (imgPayload.width / imgPayload.height);

                    // Center the image in the cell
                    const x = data.cell.x + (data.cell.width - w) / 2;
                    const y = data.cell.y + (data.cell.height - h) / 2;

                    doc.addImage(imgPayload.dataUrl, 'PNG', x, y, w, h);
                }
            }
            if (data.section === 'body' && data.column.index === 1 && data.row.index < (order.items?.length || 0)) {
                let imgPayload = descImages[data.row.index];
                if (imgPayload) {
                    const maxW = data.cell.width - 2;
                    const scale = 0.088; // 32px -> 8pt mapping
                    let w = imgPayload.width * scale;
                    let h = imgPayload.height * scale;

                    if (w > maxW) {
                        const ratio = maxW / w;
                        w = maxW;
                        h = h * ratio;
                    }

                    const x = data.cell.x + 1;
                    const y = data.cell.y + (data.cell.height - h) / 2;
                    doc.addImage(imgPayload.dataUrl, 'PNG', x, y, w, h);
                }
            }
        }
    });
    let finalY = doc.lastAutoTable.finalY;
    // Outline Rect around everything
    // Draws from Y=16 to finalY
    doc.rect(margin, 16, contentWidth, finalY - 16);

    // Save
    doc.save(`Invoice_${order.customOrderId || order._id.substring(0, 8)}.pdf`);
};
