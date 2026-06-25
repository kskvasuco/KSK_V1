export const getPdfGeneratorHtml = (order, withHeader, paymentSetting, selectedDate, token, apiBase) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Generate PDF</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js"></script>
</head>
<body>
  <script>
    const { jsPDF } = window.jspdf;

    const resolveUrl = (url) => {
      if (!url) return url;
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
      }
      const base = "${apiBase}".endsWith('/') ? "${apiBase}".slice(0, -1) : "${apiBase}";
      const path = url.startsWith('/') ? url : '/' + url;
      return base + path;
    };

    // Copy MuktaMalar font loading
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
      } catch (error) {
        console.error("Exception loading custom font for PDF:", error);
        return false;
      }
    };

    const isTamil = (text) => {
      if (!text) return false;
      return /[\\u0B80-\\u0BFF]/.test(text);
    };

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
        img.src = resolveUrl(url);
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
        ctx.font = weight + " 24px sans-serif";
        const metrics = ctx.measureText(text);
        canvas.width = metrics.width + 4;
        canvas.height = 36;
        const symbolRegex = /₹/g;
        const parts = text.split(symbolRegex);
        const hasSymbol = symbolRegex.test(text);
        
        let currentX = (canvas.width - metrics.width) / 2;
        const centerY = canvas.height / 2;
        
        ctx.textAlign = "left";
        ctx.font = weight + " 24px sans-serif";
        const segments = text.split(/(₹)/);
        segments.forEach(seg => {
          ctx.fillText(seg, currentX, centerY);
          currentX += ctx.measureText(seg).width;
        });
        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
      } catch (e) { return null; }
    };

    const createPhoneIcon = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#000000";
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

    const createMobileIcon = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#000000";
        const w = 16, h = 26, x = 8, y = 3, r = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(x + 1.5, y + 2.5, w - 3, h - 6);
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(x + w/2, y + h - 1.8, 1.2, 0, Math.PI * 2);
        ctx.fill();
        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
      } catch (e) { return null; }
    };

    const createMultilineImage = (text, scaleFactor = 1) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const hasTamil = isTamil(text);
        const baseSize = 32;
        const fontSize = hasTamil ? (baseSize * scaleFactor) : baseSize; 
        ctx.font = "bold " + fontSize + "px sans-serif";
        
        const maxWidthPx = 600;
        const inputLines = text.split('\\n');
        let finalLines = [];

        inputLines.forEach(line => {
          if (!line.trim()) {
            finalLines.push('');
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

        canvas.width = Math.max(actualMaxWidth + 4, 10);
        canvas.height = (finalLines.length * lineHeight) + 8;
        ctx.font = "bold " + fontSize + "px sans-serif";
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        finalLines.forEach((line, i) => {
          if (line) ctx.fillText(line, 2, 4 + (i * lineHeight));
        });
        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
      } catch (e) { return null; }
    };

    const buildPdf = async (order, withHeader = false, paymentSetting = null, dispatchBatch = null, customStatus = null, selectedDate = null) => {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5', compress: true });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 8;
      const contentWidth = pageWidth - 2 * margin;
      const formatCurrency = (amount) => {
        const parsed = Number(amount || 0);
        if (parsed % 1 === 0) {
          return parsed.toFixed(0);
        } else {
          return parsed.toFixed(2);
        }
      };

      const isFontLoaded = await loadCustomFont(doc);
      const primaryFont = isFontLoaded ? 'tamil_font' : 'helvetica';
      doc.setFont(primaryFont);

      let resolvedUserAddress = (order.user?.address || '').trim();
      if (!resolvedUserAddress && order.user?._id) {
        try {
          const headers = {};
          if ("${token}") {
            headers['Authorization'] = 'Bearer ' + "${token}";
          }
          const userRes = await fetch(resolveUrl("/api/admin/users/" + order.user._id), { headers });
          if (userRes.ok) {
            const userData = await userRes.json();
            resolvedUserAddress = (userData.address || '').trim();
          }
        } catch (e) {
          console.warn('Could not fetch user address for PDF:', e);
        }
      }

      const logoData = withHeader ? await loadImageAsDataUrl('/images/head.png') : null;

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

      const drawPageShell = (p) => {
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

      drawPageShell(doc);
      if (withHeader) drawWatermark(doc);

      let currentY; 
      const _d = new Date(order.createdAt || new Date());
      const orderDate = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()}`;

      const formatOrderId = (id) => {
        if (!id) return '';
        const strId = typeof id === 'object' ? (id.toString ? id.toString() : String(id)) : String(id);
        return strId.length > 15 ? strId.substring(0, 8) : strId;
      };
      const orderId = formatOrderId(order.customOrderId || order._id);

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

        if (phoneIconData) {
          doc.addImage(phoneIconData.dataUrl, 'PNG', rightEdge - phone1W - iconPadding - iconSize, borderTopY + 8.5 - (iconSize * 0.75), iconSize, iconSize);
        }
        doc.text(phone1, rightEdge, borderTopY + 8.5, { align: 'right', link: { url: 'tel:9443350464' } });

        if (phoneIconData) {
          doc.addImage(phoneIconData.dataUrl, 'PNG', rightEdge - phone2W - iconPadding - iconSize, borderTopY + 15.5 - (iconSize * 0.75), iconSize, iconSize);
        }
        doc.text(phone2, rightEdge, borderTopY + 15.5, { align: 'right', link: { url: 'tel:9566530464' } });

        const headerLineY = borderTopY + logoTargetH + 6;
        doc.setLineWidth(0.4);
        doc.line(margin, headerLineY, pageWidth - margin, headerLineY);
        currentY = headerLineY + 9;
      } else {
        currentY = margin + 13;
      }

      doc.setFontSize(12);
      doc.setFont(primaryFont, 'bold');
      doc.text(dispatchBatch ? "DISPATCH ESTIMATE" : "ESTIMATE", pageWidth / 2, currentY - 3, { align: "center" });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`No : ${orderId}`, pageWidth - margin - 2, dispatchBatch ? currentY - 5.5 : currentY - 3, { align: "right" });
      doc.text(`Date : ${orderDate}`, margin + 2, dispatchBatch ? currentY - 5.5 : currentY - 3, { align: "left" });
      if (dispatchBatch) {
        doc.setFontSize(8.5);
        doc.text(`Dispatch No : ${dispatchBatch.dispatchId}`, pageWidth - margin - 2, currentY - 1.5, { align: "right" });
        doc.setFontSize(10);
      }
      doc.setLineWidth(0.2);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      const midX = pageWidth / 2 + 10;
      const leftColW = midX - margin - 4;
      const rightColW = pageWidth - margin - midX - 4;

      const userMobile = order.user?.mobile || "";
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');

      if (userMobile && mobileIconData) {
        const mobileW = doc.getTextWidth(userMobile);
        const iconSize = 3.5;
        const iconPadding = 1.2;
        const iconX = (midX - 2) - mobileW - iconPadding - iconSize;
        const iconY = (currentY + 6) - (iconSize * 0.75);
        doc.addImage(mobileIconData.dataUrl, 'PNG', iconX, iconY, iconSize, iconSize);
      }
      doc.text(userMobile, midX - 2, currentY + 6, { align: 'right', link: { url: `tel:${userMobile}` } });

      // Print "To:" label above customer name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('To:', margin + 2, currentY + 6);

      const hasTamilName = isTamil(order.user?.name);
      doc.setFontSize(hasTamilName ? 14 : 10);
      doc.setFont(hasTamilName ? primaryFont : 'helvetica', 'bold');
      
      const wrappedName = doc.splitTextToSize(order.user?.name || "N/A", leftColW);
      doc.text(wrappedName, margin + 2, currentY + 12);

      const nameLineHeight = hasTamilName ? 5.5 : 4.5;
      let leftColEndY = (currentY + 12) + (wrappedName.length * nameLineHeight);

      const userAddress = resolvedUserAddress;
      if (userAddress) {
        const hasTamilAddr = isTamil(userAddress);
        doc.setFont(hasTamilAddr ? primaryFont : 'helvetica', 'bold');
        doc.setFontSize(9);
        const wrappedAddr = doc.splitTextToSize(userAddress, leftColW);
        doc.text(wrappedAddr, margin + 2, leftColEndY + 1);
        leftColEndY = (leftColEndY + 1) + wrappedAddr.length * 4.5;
      }

      const selD = selectedDate ? new Date(selectedDate) : new Date();
      const formattedSelectedDate = `${String(selD.getDate()).padStart(2, '0')}/${String(selD.getMonth() + 1).padStart(2, '0')}/${selD.getFullYear()}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      doc.text('Date', midX + 2, currentY + 6);
      doc.text(`: ${formattedSelectedDate}`, midX + 16, currentY + 6);
      let printStatus = customStatus || order.status;
      
      if (!customStatus && dispatchBatch) {
        const agentAdjustments = (order.adjustments || [])
          .filter(a => a.description?.startsWith('Collection via Delivery Agent:') || a.description?.startsWith('Collection via Dispatch Agent:'))
          .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        
        const batchIdx = agentAdjustments.findIndex(a => a.batchId === dispatchBatch.dispatchId);
        if (batchIdx !== -1) {
          printStatus = `Dispatch ${batchIdx + 1}`;
        } else {
          if (order.deliveryAgent?.dispatchId === dispatchBatch.dispatchId) {
            printStatus = `Dispatch ${agentAdjustments.length + 1}`;
          } else {
            printStatus = 'Dispatch';
          }
        }
      }

      const isFullyDispatched = order.items?.length > 0 && order.items.every(item => {
        const delivered = item.quantityDelivered || 0;
        const ordered = item.quantityOrdered || 0;
        return (ordered - delivered) <= 0.001;
      });

      if (dispatchBatch || (customStatus && customStatus.startsWith('Dispatch'))) {
        if (isFullyDispatched && !printStatus.includes('Completed')) {
          printStatus = `${printStatus} - Completed`;
        }
      } else if (['Dispatch', 'Partially Delivered', 'Delivered', 'Completed'].includes(order.status)) {
        if (isFullyDispatched || order.status === 'Delivered' || order.status === 'Completed') {
          if (order.status === 'Delivered' || order.status === 'Completed') {
            printStatus = order.status;
          } else {
            const agentCollections = (order.adjustments || [])
              .filter(a => a.description?.startsWith('Collection via Delivery Agent:') || a.description?.startsWith('Collection via Dispatch Agent:'));
            printStatus = agentCollections.length > 0 ? `Dispatch ${agentCollections.length} Completed` : 'Dispatch Completed';
          }
        }
      }

      doc.text('Status', midX + 2, currentY + 12);
      const wrappedStatus = doc.splitTextToSize(`: ${printStatus}`, rightColW - 14);
      doc.text(wrappedStatus, midX + 16, currentY + 12);
      let rightColEndY = (currentY + 12) + (wrappedStatus.length * 4.5);
      const dispatchAddress = (order.deliveryAgent?.address || '').trim();
      
      if (dispatchAddress) {
        const hasTamilDispatch = isTamil(dispatchAddress);
        doc.setFont(hasTamilDispatch ? primaryFont : 'helvetica', 'bold');
        doc.setFontSize(9);
        const wrappedDispatchAddr = doc.splitTextToSize(dispatchAddress, rightColW);
        doc.text(wrappedDispatchAddr, midX + 2, rightColEndY);
        rightColEndY += wrappedDispatchAddr.length * 4.5;
      }

      const sectionH = Math.max(leftColEndY - currentY, rightColEndY - currentY, 20) + 3;
      doc.setLineWidth(0.2);
      doc.line(midX, currentY, midX, currentY + sectionH);
      doc.line(margin, currentY + sectionH, pageWidth - margin, currentY + sectionH);
      currentY += sectionH;

      let totalItemsAmount = 0;
      const descImages = [];
      const itemsToRender = dispatchBatch 
        ? order.items.filter(item => {
            const batchItem = dispatchBatch.items.find(bi => (bi.orderItemId || bi._id || bi.product)?.toString() === item._id.toString());
            return batchItem && (batchItem.quantityDelivered > 0 || batchItem.quantity > 0);
          })
        : (order.items || []);

      if (itemsToRender.length > 0) {
        itemsToRender.forEach((item) => {
          const text = item.description ? `${item.name} (${item.description})` : item.name;
          descImages.push(createMultilineImage(text));
          
          const batchItem = dispatchBatch ? dispatchBatch.items.find(bi => (bi.orderItemId || bi._id || bi.product)?.toString() === item._id.toString()) : null;
          const qty = dispatchBatch 
            ? (batchItem?.quantityDelivered || batchItem?.quantity || 0)
            : ((item.isQtyNotSpecified || (item.isCustom && item.quantityOrdered === 0)) ? 1 : item.quantityOrdered);

          totalItemsAmount += qty * item.price;
        });
      }

      let finalGross = totalItemsAmount;
      if (!dispatchBatch && order.adjustments?.length > 0) {
        order.adjustments.forEach((adj) => {
          if (adj.type === 'charge') finalGross += adj.amount;
          else finalGross -= adj.amount;
        });
      }

      const rowH = 6;
      const numAdj = order.adjustments?.length || 0;
      const hasAdj = numAdj > 0;
      let footerH = (hasAdj ? rowH : 0) + 2 + rowH + (numAdj * rowH) + 3 + rowH;

      if (paymentSetting && paymentSetting.some(s => s && s.qrCode)) {
        const minQrFooterH = 26.5; 
        if (footerH < minQrFooterH) footerH = minQrFooterH;
      }

      const tableColumn = ["S.No", "Description", "Qty", "Unit", "Rate (₹)", "Amount (₹)"];
      const tableRows = itemsToRender.map((item, index) => {
        const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && item.quantityOrdered === 0);
        const batchItem = dispatchBatch ? dispatchBatch.items.find(bi => (bi.orderItemId || bi._id || bi.product)?.toString() === item._id.toString()) : null;
        const displayQty = dispatchBatch 
          ? (batchItem?.quantityDelivered || batchItem?.quantity || 0)
          : item.quantityOrdered;

        return [
          (index + 1).toString(),
          item.description ? `${item.name} (${item.description})` : item.name,
          isQtyHidden ? '' : Number(displayQty).toString(),
          item.unit || (item.isCustom ? '' : 'Nos'),
          formatCurrency(item.price),
          formatCurrency((isQtyHidden ? 1 : displayQty) * item.price)
        ];
      });

      const autoTableFunc = window.jspdf.autotable || doc.autoTable;
      autoTableFunc(doc, {
        startY: currentY,
        head: [tableColumn],
        body: tableRows,
        foot: [[
          { content: dispatchBatch ? 'Gross Total' : 'Gross Amount', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatCurrency(totalItemsAmount), styles: { halign: 'right', fontStyle: 'bold' } }
        ]],
        showFoot: 'lastPage',
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: 0, lineColor: 0, lineWidth: 0.2, halign: 'center', font: 'helvetica', fontStyle: 'bold', fontSize: 10 },
        footStyles: { fillColor: [245, 245, 245], textColor: 0, lineColor: 0, lineWidth: 0.2, fontSize: 13.5, fontStyle: 'bold' },
        styles: { font: primaryFont, fontSize: 13.5, lineColor: 0, lineWidth: 0.2, textColor: 0, valign: 'middle', cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: 16, halign: 'center' }, 2: { cellWidth: 15, halign: 'right' }, 3: { cellWidth: 16, halign: 'center', fontSize: 11 }, 4: { cellWidth: 20, halign: 'right' }, 5: { cellWidth: 24, halign: 'right' } },
        margin: { left: margin + 1, right: margin + 1, bottom: margin + 5 },
        didParseCell: (data) => {
          if (data.section === 'head' && (data.column.index === 4 || data.column.index === 5)) {
            data.cell.text = '';
            data.cell.styles.textColor = [230, 230, 230];
          }
          if (data.section === 'body' && data.column.index === 1) {
            data.cell.text = '';
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
          if (data.section === 'body' && data.column.index === 1 && data.row.index < itemsToRender.length) {
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
          if (withHeader) drawWatermark(doc);
        }
      });

      const minFooterH = 40;
      const dynamicFooterH = Math.max(minFooterH, footerH + 5);
      let bY = borderBottomY - dynamicFooterH;
      const fixedFooterY = bY;

      if (doc.lastAutoTable && doc.lastAutoTable.finalY > bY - 2) {
        doc.addPage();
        drawPageShell(doc);
        if (withHeader) drawWatermark(doc);
        bY = borderBottomY - dynamicFooterH;
      }

      doc.setLineWidth(0.3);
      doc.line(margin, bY, pageWidth - margin, bY);

      const verticalLineX = pageWidth - margin - 60;
      const footerBottomY = borderBottomY;
      doc.setLineWidth(0.4);
      doc.line(verticalLineX, bY, verticalLineX, footerBottomY);

      const rightEdge = pageWidth - margin - 2;
      const colonX = verticalLineX + (pageWidth - margin - verticalLineX) * 0.70;

      const drawRightRow = (labelText, valueText, y, bold = false) => {
        doc.setFont(primaryFont, bold ? 'bold' : 'normal');
        doc.setFontSize(bold ? 12 : 11);
        
        const totalW = doc.getTextWidth(labelText);
        const startX = colonX - 2 - totalW;
        doc.text(labelText, startX, y + rowH * 0.75);

        doc.text(':', colonX, y + rowH * 0.75);
        
        const valueW = doc.getTextWidth(valueText);
        doc.text(valueText, rightEdge - valueW, y + rowH * 0.75);
      };

      const qrSize = 20;
      const qrY = borderBottomY - qrSize - 3;
      
      if (finalGross > 0.01) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const amountInWords = numberToWords(finalGross);
        const wordWidth = (verticalLineX - margin) - 6;
        const wrappedWords = doc.splitTextToSize(`Rupees ${amountInWords}`, wordWidth);
        doc.text(wrappedWords, margin + 3, bY + rowH * 0.75);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Payment Details,', margin + 3, qrY - 3);

      doc.setLineWidth(0.2);
      doc.line(margin, qrY - 1, verticalLineX, qrY - 1);

      doc.setLineWidth(0.3);
      const totalLineY = borderBottomY - 9;
      doc.line(verticalLineX, totalLineY, pageWidth - margin, totalLineY);
      
      const finalTotalLabel = dispatchBatch ? 'Gross Total (₹)' : 'Total (₹)';
      drawRightRow(finalTotalLabel, formatCurrency(finalGross), totalLineY + 0.5, true);

      let rightRowY = fixedFooterY;

      drawRightRow('Gross Amount (₹)', formatCurrency(totalItemsAmount), rightRowY);
      rightRowY += rowH;

      if (!dispatchBatch && order.adjustments?.length > 0) {
        let deliveryCount = 0;
        order.adjustments.forEach((adj) => {
          const prefix = adj.type === 'charge' ? '+' : '';
          let label = adj.description;
          
          if (adj.type === 'payment' && adj.date) {
            const adjDate = new Date(adj.date);
            const dateStr = `${adjDate.getDate()}/${adjDate.getMonth() + 1}/${String(adjDate.getFullYear()).slice(-2)}`;
            label = `${label} (${dateStr})`;
          }

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
          
          drawRightRow(`${label} (₹)`, `${prefix}${formatCurrency(adj.amount)}`, rightRowY);
          rightRowY += rowH;
        });
      }

      const paymentSettingsArray = Array.isArray(paymentSetting) ? paymentSetting : (paymentSetting ? [paymentSetting] : []);
      if (paymentSettingsArray.length > 0) {
        try {
          const paymentDividerX = margin + (verticalLineX - margin) * 0.55; 
          const loopQrSize = 20;
          const loopQrY = borderBottomY - loopQrSize - 3;
          doc.setLineWidth(0.2);
          doc.line(paymentDividerX, loopQrY - 1, paymentDividerX, borderBottomY);

          for (let i = 0; i < paymentSettingsArray.length; i++) {
            const setting = paymentSettingsArray[i];
            if (!setting) continue;

            const qrX = paymentDividerX + (verticalLineX - paymentDividerX - loopQrSize) / 2;
            const loopItemQrY = borderBottomY - loopQrSize - 3; 

            if (setting.qrCode && typeof setting.qrCode === 'string' && setting.qrCode.length > 0) {
              const qrData = await loadImageAsDataUrl(setting.qrCode);
              if (qrData) {
                doc.addImage(qrData.dataUrl, 'PNG', qrX, loopItemQrY, loopQrSize, loopQrSize);
              }
            }

            if (setting.type === 'bank' && (setting.name || setting.accountNumber || setting.ifsc)) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8);
              
              const textLeftMargin = margin + 2;
              let textY = loopItemQrY + 3;
              
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

      {
        const footerY = borderBottomY + 4.5;
        if (withHeader) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(15, 82, 186);
          doc.text('www.kskvasu.co.in', margin, footerY);
          
          const textWidth = doc.getTextWidth('www.kskvasu.co.in');
          doc.link(margin, footerY - 3.5, textWidth, 4.5, { url: 'https://www.kskvasu.co.in' });
          
          doc.setDrawColor(15, 82, 186);
          doc.setLineWidth(0.2);
          doc.line(margin, footerY + 0.5, margin + textWidth, footerY + 0.5);
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text('Thank You..! Visit Again', pageWidth - margin, footerY, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }

      return doc;
    };

    // Run PDF generation inside WebView
    (async () => {
      try {
        const order = ${JSON.stringify(order)};
        const withHeader = ${withHeader};
        const paymentSetting = ${JSON.stringify(paymentSetting)};
        const selectedDate = ${JSON.stringify(selectedDate)};

        // Initialize constants
        const rateImg = createTextImage("Rate (₹)");
        const amountImg = createTextImage("Amount (₹)");
        const phoneIconData = createPhoneIcon();
        const mobileIconData = createMobileIcon();

        const doc = await buildPdf(order, withHeader, paymentSetting, null, null, selectedDate);
        const dataUrl = doc.output('datauristring');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PDF_SUCCESS',
          base64: dataUrl
        }));
      } catch (e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PDF_ERROR',
          message: e.message || String(e)
        }));
      }
    })();
  </script>
</body>
</html>
  `;
};
