const fs = require('fs');
const path = require('path');

// Helper to normalize content newlines
const normalize = s => s.replace(/\r\n/g, '\n');

// ── WEB (CustomerLedger.jsx) ───────────────────────────────────────────────
const webFile = path.join(__dirname, '..', 'client', 'src', 'admin', 'CustomerLedger.jsx');
let web = normalize(fs.readFileSync(webFile, 'utf8'));

// 1. Modify calculateSelectedProductsTotal to count empty/invalid qty as 1
const originalWebCount = web.length;
web = web.replace(
  /const calculateSelectedProductsTotal = \(items\) =>\s*items\.reduce\([\s\S]*?sum,\s*0\);/,
  `const calculateSelectedProductsTotal = (items) =>
        items.reduce((sum, { product, qty, price }) => {
            const effectiveQty = (qty === '' || qty == null || Number(qty) <= 0) ? 1 : Number(qty);
            return sum + ((price !== undefined ? price : (product?.price || 0)) * effectiveQty);
        }, 0);`
);

if (web.length === originalWebCount) {
  console.warn("WARNING: regex did not replace calculateSelectedProductsTotal in CustomerLedger.jsx");
} else {
  console.log("Success: Replaced calculateSelectedProductsTotal in CustomerLedger.jsx via regex");
}

fs.writeFileSync(webFile, web, 'utf8');


// ── MOBILE (CustomerLedgerScreen.js) ──────────────────────────────────────────
const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
let mob = normalize(fs.readFileSync(mobileFile, 'utf8'));

// 1. Modify calculateSelectedProductsTotal in mobile
const originalMobCount = mob.length;
mob = mob.replace(
  /const calculateSelectedProductsTotal = \(items\) =>\s*items\.reduce\([\s\S]*?sum,\s*0\);/,
  `const calculateSelectedProductsTotal = (items) =>
    items.reduce((sum, { product, qty, price }) => {
      const effectiveQty = (qty === '' || qty == null || Number(qty) <= 0) ? 1 : Number(qty);
      return sum + ((price !== undefined ? price : (product?.price || 0)) * effectiveQty);
    }, 0);`
);

if (mob.length === originalMobCount) {
  console.warn("WARNING: regex did not replace calculateSelectedProductsTotal in CustomerLedgerScreen.js");
} else {
  console.log("Success: Replaced calculateSelectedProductsTotal in CustomerLedgerScreen.js via regex");
}

fs.writeFileSync(mobileFile, mob, 'utf8');
console.log("Successfully completed regex updates");
