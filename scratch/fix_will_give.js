const fs = require('fs');
const path = require('path');

// 1. Process client/src/admin/CustomerLedger.jsx
const webFile = path.join(__dirname, '..', 'client', 'src', 'admin', 'CustomerLedger.jsx');
if (fs.existsSync(webFile)) {
    console.log('Processing web file:', webFile);
    let content = fs.readFileSync(webFile, 'utf8');
    content = content.replace(/Want to Give/g, 'Will Give');
    fs.writeFileSync(webFile, content, 'utf8');
    console.log('Web file updated successfully.');
}

// 2. Process mobile/src/screens/admin/CustomerLedgerScreen.js
const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
if (fs.existsSync(mobileFile)) {
    console.log('Processing mobile file:', mobileFile);
    let content = fs.readFileSync(mobileFile, 'utf8');
    content = content.replace(/Want to Give/g, 'Will Give');
    fs.writeFileSync(mobileFile, content, 'utf8');
    console.log('Mobile file updated successfully.');
}
