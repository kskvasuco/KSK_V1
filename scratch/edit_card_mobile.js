const fs = require('fs');

const filePath = 'd:\\KSK\\HOST\\KSK REACT\\KSK1\\V_1 - Main\\mobile\\src\\components\\orders\\OrderCard.js';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Declare state variables at the beginning (around line 115)
const stateTarget = "  const [selectedPdfDate, setSelectedPdfDate] = useState(new Date().toISOString().slice(0, 10));\n  const [productsList, setProductsList] = useState([]);";
const stateReplacement = "  const [selectedPdfDate, setSelectedPdfDate] = useState(new Date().toISOString().slice(0, 10));\n  const [productsList, setProductsList] = useState([]);\n  const [pdfPageSize, setPdfPageSize] = useState('a5'); // 'a5' or 'a4'";

if (content.includes(stateTarget)) {
    content = content.replace(stateTarget, stateReplacement);
    console.log("Injected pdfPageSize state variable.");
} else {
    console.log("Error: stateTarget not found!");
}

// 2. Add selector UI to printPaymentModal (around line 1984, before submit button)
const uiTarget = `              </View>

              <Pressable
                style={[styles.saveSubmitBtn, isGeneratingPDF && styles.btnDisabled]}
                onPress={() => generateBillPDFDirect(printWithHeader, selectedPrintPayments)}
                disabled={isGeneratingPDF}
              >`;
const uiReplacement = `              </View>

              <Text style={styles.fieldLabel}>Select Paper Size</Text>
              <View style={{ display: 'flex', flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <Pressable
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: pdfPageSize === 'a4' ? '#0f52ba' : '#cbd5e1',
                    backgroundColor: pdfPageSize === 'a4' ? '#0f52ba' : '#fff',
                    alignItems: 'center'
                  }}
                  onPress={() => setPdfPageSize('a4')}
                >
                  <Text style={{ color: pdfPageSize === 'a4' ? '#fff' : '#1e293b', fontWeight: 'bold' }}>A4 Size</Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: pdfPageSize === 'a5' ? '#0f52ba' : '#cbd5e1',
                    backgroundColor: pdfPageSize === 'a5' ? '#0f52ba' : '#fff',
                    alignItems: 'center'
                  }}
                  onPress={() => setPdfPageSize('a5')}
                >
                  <Text style={{ color: pdfPageSize === 'a5' ? '#fff' : '#1e293b', fontWeight: 'bold' }}>A5 Size</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.saveSubmitBtn, isGeneratingPDF && styles.btnDisabled]}
                onPress={() => generateBillPDFDirect(printWithHeader, selectedPrintPayments)}
                disabled={isGeneratingPDF}
              >`;

if (content.includes(uiTarget)) {
    content = content.replace(uiTarget, uiReplacement);
    console.log("Injected A4/A5 selection UI into print modal.");
} else {
    console.log("Error: uiTarget not found!");
}

// 3. Make generateBillPDFDirect dynamic based on pdfPageSize
const directFuncTarget = "  const generateBillPDFDirect = async (headerFlag, chosenGateways) => {\n    try {\n      setIsGeneratingPDF(true);";
const directFuncReplacement = `  const generateBillPDFDirect = async (headerFlag, chosenGateways) => {
    try {
      setIsGeneratingPDF(true);
      const isA4 = pdfPageSize === 'a4';
      const tdPadding = isA4 ? '6px' : '4px';
      const tdFontSize = isA4 ? '11px' : '8.5px';
      const tdUnitFontSize = isA4 ? '10px' : '7.5px';
      const bankFontSize = isA4 ? '9px' : '7.5px';
      const qrSize = isA4 ? '58px' : '42px';
      const qrContainerSize = isA4 ? '62px' : '46px';`;

if (content.includes(directFuncTarget)) {
    content = content.replace(directFuncTarget, directFuncReplacement);
    console.log("Configured generateBillPDFDirect with dynamic size metrics.");
} else {
    console.log("Error: directFuncTarget not found!");
}

// 4. Update elements inside generateBillPDFDirect
// Bank details font-size
content = content.replace('font-size: 9px; line-height: 1.4;', 'font-size: ${bankFontSize}; line-height: 1.4;');
// QR code dimensions
content = content.replace('width: 62px; height: 62px; ${chosenGateways.bank ? \'border-left: 1px solid #000; padding-left: 8px;\' : \'\'} flex: 0.8;', 'width: ${qrContainerSize}; height: ${qrContainerSize}; ${chosenGateways.bank ? \'border-left: 1px solid #000; padding-left: 8px;\' : \'\'} flex: 0.8;');
content = content.replace('width: 58px; height: 58px;', 'width: ${qrSize}; height: ${qrSize};');
// CSS Stylesheet rule for size
content = content.replace('size: auto; margin: 0;', 'size: ${isA4 ? \'A4\' : \'A5\'} portrait; margin: 0;');
content = content.replace('padding: 20px; margin: 0;', 'padding: ${isA4 ? \'20px\' : \'12px\'}; margin: 0;');
content = content.replace('title { text-align: center; font-size: 14.5px;', 'title { text-align: center; font-size: ${isA4 ? \'14.5px\' : \'11px\'};');
content = content.replace('meta-td { padding: 6px;', 'meta-td { padding: ${isA4 ? \'6px\' : \'4px\'};');
content = content.replace('th { background-color: #e6e6e6; padding: 6px; border: 1px solid #000; font-size: 10px;', 'th { background-color: #e6e6e6; padding: ${isA4 ? \'6px\' : \'4px\'}; border: 1px solid #000; font-size: ${isA4 ? \'10px\' : \'8px\'};');
content = content.replace('totals-section { display: flex; border-top: 2px solid #000; margin-top: 6px; min-height: 105px; }', 'totals-section { display: flex; border-top: 2px solid #000; margin-top: 6px; min-height: ${isA4 ? \'105px\' : \'80px\'}; }');

// table item td styling
const directTdTarget = `          <tr>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 11px;">\${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">\${item.product?.name || item.name} \${item.description ? \`(\${item.description})\` : ''}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">\${qty}</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 10px;">\${item.product?.unit || item.unit || 'Nos'}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">₹\${formatPrice(item.price)}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">₹\${formatPrice(amount)}</td>
          </tr>`;
const directTdReplacement = `          <tr>
            <td style="text-align: center; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize};">\${idx + 1}</td>
            <td style="padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize}; font-weight: bold;">\${item.product?.name || item.name} \${item.description ? \`(\${item.description})\` : ''}</td>
            <td style="text-align: right; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize};">\${qty}</td>
            <td style="text-align: center; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdUnitFontSize};">\${item.product?.unit || item.unit || 'Nos'}</td>
            <td style="text-align: right; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize};">₹\${formatPrice(item.price)}</td>
            <td style="text-align: right; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize}; font-weight: bold;">₹\${formatPrice(amount)}</td>
          </tr>`;

if (content.includes(directTdTarget)) {
    content = content.replace(directTdTarget, directTdReplacement);
    console.log("Updated table item td styling in generateBillPDFDirect.");
} else {
    console.log("Error: directTdTarget not found!");
}

// dynamic adjustment font size
content = content.replace('font-size: 11px; margin-bottom: 3.5px; color: #000; font-weight: bold;', 'font-size: ${tdFontSize}; margin-bottom: 3.5px; color: #000; font-weight: bold;');
content = content.replace('colspan="5" style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; color: #000;"', 'colspan="5" style="text-align: right; padding: ${tdPadding}; border: 1px solid #000; font-size: ${tdFontSize}; color: #000;"');
content = content.replace('text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; color: #000;', 'text-align: right; padding: ${tdPadding}; border: 1px solid #000; font-size: ${tdFontSize}; color: #000;');

// Update printToFileAsync in generateBillPDFDirect
const directFileTarget = `                const { uri } = await Print.printToFileAsync({
                  html,
                  width: 595,
                  height: 842
                });`;
const directFileReplacement = `                const { uri } = await Print.printToFileAsync({
                  html,
                  width: isA4 ? 595 : 420,
                  height: isA4 ? 842 : 595
                });`;

if (content.includes(directFileTarget)) {
    content = content.replace(directFileTarget, directFileReplacement);
    console.log("Updated file width/height dimensions for generateBillPDFDirect.");
} else {
    console.log("Error: directFileTarget not found!");
}


// 5. Make generateDispatchBatchPDF dynamic based on pdfPageSize
const batchFuncTarget = "  const generateDispatchBatchPDF = async (batch, headerFlag) => {\n    try {\n      const formatOrderId = (id) => {";
const batchFuncReplacement = `  const generateDispatchBatchPDF = async (batch, headerFlag) => {
    try {
      const isA4 = pdfPageSize === 'a4';
      const tdPadding = isA4 ? '6px' : '4px';
      const tdFontSize = isA4 ? '11px' : '8.5px';
      const tdUnitFontSize = isA4 ? '10px' : '7.5px';
      const bankFontSize = isA4 ? '9px' : '7.5px';
      const qrSize = isA4 ? '58px' : '42px';
      const qrContainerSize = isA4 ? '62px' : '46px';
      const formatOrderId = (id) => {`;

if (content.includes(batchFuncTarget)) {
    content = content.replace(batchFuncTarget, batchFuncReplacement);
    console.log("Configured generateDispatchBatchPDF with dynamic size metrics.");
} else {
    console.log("Error: batchFuncTarget not found!");
}

// table dispatch item td styling
const batchTdTarget = `          <tr>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 11px;">\${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">\${itemName}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">\${qty}</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 10px;">\${unit}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">₹\${formatPrice(rate)}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">₹\${formatPrice(amount)}</td>
          </tr>`;
const batchTdReplacement = `          <tr>
            <td style="text-align: center; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize};">\${idx + 1}</td>
            <td style="padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize}; font-weight: bold;">\${itemName}</td>
            <td style="text-align: right; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize};">\${qty}</td>
            <td style="text-align: center; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdUnitFontSize};">\${unit}</td>
            <td style="text-align: right; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize};">₹\${formatPrice(rate)}</td>
            <td style="text-align: right; padding: \${tdPadding}; border: 1px solid #000; font-size: \${tdFontSize}; font-weight: bold;">₹\${formatPrice(amount)}</td>
          </tr>`;

if (content.includes(batchTdTarget)) {
    content = content.replace(batchTdTarget, batchTdReplacement);
    console.log("Updated table item td styling in generateDispatchBatchPDF.");
} else {
    console.log("Error: batchTdTarget not found!");
}

// Update printToFileAsync in generateDispatchBatchPDF
const batchFileTarget = `                const { uri } = await Print.printToFileAsync({
                  html,
                  width: 595,
                  height: 842
                });`;
const batchFileReplacement = `                const { uri } = await Print.printToFileAsync({
                  html,
                  width: isA4 ? 595 : 420,
                  height: isA4 ? 842 : 595
                });`;

if (content.includes(batchFileTarget)) {
    content = content.replace(batchFileTarget, batchFileReplacement);
    console.log("Updated file width/height dimensions for generateDispatchBatchPDF.");
} else {
    console.log("Error: batchFileTarget not found!");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done patching OrderCard.js");
