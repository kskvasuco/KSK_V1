const fs = require('fs');
const path = require('path');

const normalize = s => s.replace(/\r\n/g, '\n');

// ── SERVER (server.js) ───────────────────────────────────────────────────────
const serverFile = path.join(__dirname, '..', 'server.js');
let server = normalize(fs.readFileSync(serverFile, 'utf8'));

// Update POST route in server.js
const targetServerPost = `      validatedProducts = productItems.map(p => {
        const item = {
          name: p.name,
          sku: p.sku || '',
          qty: (p.qty === null || p.qty === undefined || p.qty === '') ? null : Number(p.qty),
          unitPrice: Number(p.unitPrice) || 0
        };
        if (p.productId && mongoose.Types.ObjectId.isValid(p.productId)) {
          item.productId = p.productId;
        }
        return item;
      });
      skuLine = validatedProducts
        .map(p => {
          const qtyStr = (p.qty === null || p.qty === undefined) ? '' : \`\${p.qty} X \`;
          return \`\${p.sku || p.name} - \${qtyStr}₹\${p.unitPrice}\`;
        })
        .join(', ');`;

if (server.includes(targetServerPost)) {
  console.log("Already updated: POST mapping in server.js");
}

// Update PUT route in server.js
const targetServerPut = `      if (productItems.length > 0) {
        validatedProducts = productItems.map(p => {
          const item = {
            name: p.name,
            sku: p.sku || '',
            qty: (p.qty === null || p.qty === undefined || p.qty === '') ? null : Number(p.qty),
            unitPrice: Number(p.unitPrice) || 0
          };
          if (p.productId && mongoose.Types.ObjectId.isValid(p.productId)) {
            item.productId = p.productId;
          }
          return item;
        });
      }
      txn.productItems = validatedProducts;

      const newSkuLine = validatedProducts
        .map(p => {
          const qtyStr = (p.qty === null || p.qty === undefined) ? '' : \`\${p.qty} X \`;
          return \`\${p.sku || p.name} - \${qtyStr}₹\${p.unitPrice}\`;
        })
        .join(', ');`;

if (server.includes(targetServerPut)) {
  console.log("Already updated: PUT mapping in server.js");
}


// ── WEB (CustomerLedger.jsx) ───────────────────────────────────────────────
const webFile = path.join(__dirname, '..', 'client', 'src', 'admin', 'CustomerLedger.jsx');
let web = normalize(fs.readFileSync(webFile, 'utf8'));

// 1. Update frontend handleAddTransaction mapping (qty null instead of 1 fallback)
web = web.replace(
  /qty: \(qty === '' \|\| qty == null \|\| Number\(qty\) <= 0\) \? 1 : parseFloat\(qty\),/g,
  `qty: (qty === '' || qty == null || Number(qty) <= 0) ? null : parseFloat(qty),`
);

// 2. Update Entries list rendering to check if qty is present using regex
const originalWeb = web.length;
web = web.replace(
  /\{p\.sku \|\| p\.name\} - \{p\.qty\} X ₹\{\(p\.unitPrice \|\| 0\)\.toLocaleString\('en-IN'\)\}/g,
  `{p.sku || p.name} - {p.qty ? \`\${p.qty} X \` : ''}₹{(p.unitPrice || 0).toLocaleString('en-IN')}`
);

if (web.length !== originalWeb) {
  console.log("Success: Updated entries list rendering in CustomerLedger.jsx via regex");
} else {
  console.warn("Warning: Regex did not match targetWebEntries in CustomerLedger.jsx");
}

// 3. Update Web PDF statement/report rendering
web = web.replace(
  /\`\${p\.sku \|\| p\.name} - \${p\.qty} X &#8377;\${formatPDFCurrency\(p\.unitPrice\)}\`/g,
  `\`\${p.sku || p.name} - \${p.qty ? \`\${p.qty} X \` : ''}&#8377;\${formatPDFCurrency(p.unitPrice)}\``
);

fs.writeFileSync(webFile, web, 'utf8');
console.log("Successfully patched CustomerLedger.jsx");


// ── MOBILE (CustomerLedgerScreen.js) ──────────────────────────────────────────
const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
let mob = normalize(fs.readFileSync(mobileFile, 'utf8'));

// 1. Update handleAddTransaction and handleSaveTransaction mappings in mobile
mob = mob.replace(
  /qty: \(qty === '' \|\| qty == null \|\| Number\(qty\) <= 0\) \? 1 : parseInt\(qty, 10\),/g,
  `qty: (qty === '' || qty == null || Number(qty) <= 0) ? null : parseInt(qty, 10),`
);

// 2. Update Entries list rendering in mobile
const targetMobEntries = `                          <Text key={pIdx} style={{ fontSize: 11, color: colors.textMuted }}>
                            📦 {p.name} - {p.qty ? \`\${p.qty} X \` : ''}₹{p.unitPrice}
                          </Text>`;

if (mob.includes(targetMobEntries)) {
  console.log("Already updated: entries list rendering in CustomerLedgerScreen.js");
}

// 3. Update Mobile PDF rendering in mobile (generateStatementHtml)
mob = mob.replace(
  /\`\${p\.sku \|\| p\.name} - \${p\.qty} X &#8377;\${formatPDFCurrency\(p\.unitPrice\)}\`/g,
  `\`\${p.sku || p.name} - \${p.qty ? \`\${p.qty} X \` : ''}&#8377;\${formatPDFCurrency(p.unitPrice)}\``
);

fs.writeFileSync(mobileFile, mob, 'utf8');
console.log("Successfully patched CustomerLedgerScreen.js");
