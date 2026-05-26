const fs = require('fs');

// 1. Modify models/LedgerTransaction.js to make description not required
const modelPath = 'd:/KSK/HOST/KSK REACT/KSK1/V_1 - Main/models/LedgerTransaction.js';
let modelContent = fs.readFileSync(modelPath, 'utf8').replace(/\r\n/g, '\n');
modelContent = modelContent.replace(
    /description: \{ type: String, required: true \}/g,
    `description: { type: String, required: false }`
);
fs.writeFileSync(modelPath, modelContent.replace(/\n/g, '\r\n'), 'utf8');
console.log('Success: Modified LedgerTransaction.js model');

// 2. Modify server.js
const serverPath = 'd:/KSK/HOST/KSK REACT/KSK1/V_1 - Main/server.js';
let serverContent = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');

// 2.1 Update POST validation (remove description required constraint)
serverContent = serverContent.replace(
    /if \(!userId \|\| !type \|\| !amount \|\| !description\) \{/g,
    `if (!userId || !type || !amount) {`
);

// 2.2 Update description assignment in POST
serverContent = serverContent.replace(
    /      description,\n      date: date/g,
    `      description: description || '',\n      date: date`
);

// 2.3 Update skuLine generation in POST (add price inside parenthesis)
serverContent = serverContent.replace(
    /      skuLine = validatedProducts\n        \.filter\(p => p\.sku\)\n        \.map\(p => `\$\{p\.sku\} × \$\{p\.qty\}`\)\n        \.join\(', '\);/g,
    `      skuLine = validatedProducts\n        .filter(p => p.sku)\n        .map(p => \`\${p.sku} (₹\${p.unitPrice}) × \${p.qty}\`)\n        .join(', ');`
);

// 2.4 Update skuLine generation in PUT
serverContent = serverContent.replace(
    /      const newSkuLine = validatedProducts\n        \.filter\(p => p\.sku\)\n        \.map\(p => `\$\{p\.sku\} × \$\{p\.qty\}`\)\n        \.join\(', '\);/g,
    `      const newSkuLine = validatedProducts\n        .filter(p => p.sku)\n        .map(p => \`\${p.sku} (₹\${p.unitPrice}) × \${p.qty}\`)\n        .join(', ');`
);

fs.writeFileSync(serverPath, serverContent.replace(/\n/g, '\r\n'), 'utf8');
console.log('Success: Modified server.js');

// 3. Modify client/src/admin/CustomerLedger.jsx to remove description fallback
const webPath = 'd:/KSK/HOST/KSK REACT/KSK1/V_1 - Main/client/src/admin/CustomerLedger.jsx';
let webContent = fs.readFileSync(webPath, 'utf8').replace(/\r\n/g, '\n');

// Update handleAddTransaction fallback (make empty)
webContent = webContent.replace(
    /        if \(!finalDescription\.trim\(\)\) finalDescription = type === 'dr' \? 'You Gave' : 'You Got';/g,
    `        if (!finalDescription.trim()) finalDescription = '';`
);

fs.writeFileSync(webPath, webContent.replace(/\n/g, '\r\n'), 'utf8');
console.log('Success: Modified CustomerLedger.jsx');

// 4. Modify mobile/src/screens/admin/CustomerLedgerScreen.js to remove description fallback
const mobilePath = 'd:/KSK/HOST/KSK REACT/KSK1/V_1 - Main/mobile/src/screens/admin/CustomerLedgerScreen.js';
let mobileContent = fs.readFileSync(mobilePath, 'utf8').replace(/\r\n/g, '\n');

mobileContent = mobileContent.replace(
    /    if \(!finalDescription\.trim\(\)\) finalDescription = type === 'dr' \? 'You Gave' : 'You Got';/g,
    `    if (!finalDescription.trim()) finalDescription = '';`
);

fs.writeFileSync(mobilePath, mobileContent.replace(/\n/g, '\r\n'), 'utf8');
console.log('Success: Modified CustomerLedgerScreen.js');
