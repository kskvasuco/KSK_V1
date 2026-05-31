const fs = require('fs');
const path = require('path');

// 1. Process client/src/admin/CustomerLedger.jsx
const webFile = path.join(__dirname, '..', 'client', 'src', 'admin', 'CustomerLedger.jsx');
if (fs.existsSync(webFile)) {
    console.log('Processing web file:', webFile);
    let content = fs.readFileSync(webFile, 'utf8');

    // First replacement (scoped PDF around line 1478)
    const target1 = `<div class="summary-value" style="color: \${balanceColor};">&#8377;\${formatPDFCurrency(Math.abs(closingBal))} (\${balanceLabel})</div>`;
    const replacement1 = `<div class="summary-value" style="color: \${balanceColor};">&#8377;\${formatPDFCurrency(Math.abs(closingBal))} (\${balanceLabel})</div>\n                          <div style="font-size: 11px; font-weight: bold; color: \${balanceColor}; margin-top: 4px;">\${closingBal === 0 ? 'Settled' : closingBal < 0 ? \`\${profile.name} Want to Give\` : \`\${profile.name} Got\`}</div>`;

    // Second replacement (full PDF around line 2128)
    const target2 = `<div class="summary-value" style="color: \${balanceColor};">&#8377;\${formatPDFCurrency(Math.abs(netVal))} (\${balanceLabel})</div>`;
    const replacement2 = `<div class="summary-value" style="color: \${balanceColor};">&#8377;\${formatPDFCurrency(Math.abs(netVal))} (\${balanceLabel})</div>\n                          <div style="font-size: 11px; font-weight: bold; color: \${balanceColor}; margin-top: 4px;">\${netVal === 0 ? 'Settled' : netVal < 0 ? \`\${profile.name} Want to Give\` : \`\${profile.name} Got\`}</div>`;

    if (content.includes(target1) && content.includes(target2)) {
        content = content.replace(target1, replacement1);
        content = content.replace(target2, replacement2);
        fs.writeFileSync(webFile, content, 'utf8');
        console.log('Web file updated successfully.');
    } else {
        console.error('Target strings not found in web file.');
    }
} else {
    console.error('Web file not found:', webFile);
}

// 2. Process mobile/src/screens/admin/CustomerLedgerScreen.js
const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
if (fs.existsSync(mobileFile)) {
    console.log('Processing mobile file:', mobileFile);
    let content = fs.readFileSync(mobileFile, 'utf8');

    const targetMobile = `<div class="summary-value" style="color: \${balanceColor};">&#8377;\${formatPDFCurrency(netVal)} (\${balanceLabel})</div>`;
    const replacementMobile = `<div class="summary-value" style="color: \${balanceColor};">&#8377;\${formatPDFCurrency(netVal)} (\${balanceLabel})</div>\n                      <div style="font-size: 11px; font-weight: bold; color: \${balanceColor}; margin-top: 4px;">\${netVal === 0 ? 'Settled' : netVal > 0 ? \`\${customer.name} Want to Give\` : \`\${customer.name} Got\`}</div>`;

    if (content.includes(targetMobile)) {
        content = content.replace(targetMobile, replacementMobile);
        fs.writeFileSync(mobileFile, content, 'utf8');
        console.log('Mobile file updated successfully.');
    } else {
        console.error('Target string not found in mobile file.');
    }
} else {
    console.error('Mobile file not found:', mobileFile);
}
