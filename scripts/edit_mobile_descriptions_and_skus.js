const fs = require('fs');
const filePath = 'd:/KSK/HOST/KSK REACT/KSK1/V_1 - Main/mobile/src/screens/admin/CustomerLedgerScreen.js';

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Remove auto-populating product names in handleAddTransaction description (mobile)
content = content.replace(
    /    let finalDescription = description;\n    if \(useProductPicker && selectedProducts\.length > 0 && !description\.trim\(\)\) \{\n      finalDescription = selectedProducts\n        \.filter\(\(\{ qty \}\) => hasEnteredQty\(qty\)\)\n        \.map\(\(\{ product, qty \}\) => `\$\{product\.name\} ×\$\{qty\}`\)\n        \.join\(', '\);\n    \}/g,
    `    let finalDescription = description;`
);

// 2. Remove auto-populating product names in handleSaveTransaction description (mobile)
content = content.replace(
    /        if \(!finalDescription\.trim\(\)\) \{\n          finalDescription = editSelectedProducts\.map\(\(\{product, qty\}\) => `\$\{product\.name\} ×\$\{qty\}`\)\.join\(', '\);\n        \}/g,
    `        // Do not auto-populate description from product names`
);

// 3. Remove "🏷️ SKU: " text tag in PDF productLinesHtml (mobile)
content = content.replace(
    /productLinesHtml = `\s*<div style="font-size: 9.5px; color: #0369a1; margin-top: 2px; padding-left: 12px; font-weight: 600;">🏷️ SKU: \$\{t\.skuLine\}<\/div>\s*`;/g,
    `productLinesHtml = \`<div style="font-size: 9.5px; color: #0369a1; margin-top: 2px; padding-left: 12px; font-weight: 600;">\${t.skuLine}</div>\`;`
);

// 4. Remove "🏷️ SKU: " text tag in FlatList item render (mobile)
content = content.replace(
    /🏷️ SKU: \{item\.skuLine\}/g,
    `{item.skuLine}`
);

// Convert line endings back
const finalContent = content.includes('\n') ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Success: Updated descriptions and SKUs in CustomerLedgerScreen.js');
