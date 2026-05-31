const fs = require('fs');
const path = require('path');

// ── WEB ──────────────────────────────────────────────────────────────────────
const webFile = path.join(__dirname, '..', 'client', 'src', 'admin', 'CustomerLedger.jsx');
let web = fs.readFileSync(webFile, 'utf8');

// 1. Initial state: useState('1') → useState('')
web = web.replace(
    `const [customProductQty, setCustomProductQty] = useState('1');`,
    `const [customProductQty, setCustomProductQty] = useState('');`
);
web = web.replace(
    `const [editCustomProductQty, setEditCustomProductQty] = useState('1');`,
    `const [editCustomProductQty, setEditCustomProductQty] = useState('');`
);

// 2. onChange handlers: || '1' → || '' (don't force '1' when empty)
web = web.replace(
    /setCustomProductQty\(e\.target\.value\.replace\(\/\[^0-9\]\/g, ''\) \|\| '1'\)/g,
    `setCustomProductQty(e.target.value.replace(/[^0-9]/g, ''))`
);
web = web.replace(
    /setEditCustomProductQty\(e\.target\.value\.replace\(\/\[^0-9\]\/g, ''\) \|\| '1'\)/g,
    `setEditCustomProductQty(e.target.value.replace(/[^0-9]/g, ''))`
);

// 3. Reset on cancel/add: setCustomProductQty('1') → setCustomProductQty('')
web = web.replace(/setCustomProductQty\('1'\)/g, `setCustomProductQty('')`);
web = web.replace(/setEditCustomProductQty\('1'\)/g, `setEditCustomProductQty('')`);

// 4. onClick toggles: setCustomProductQty('1') already handled above

fs.writeFileSync(webFile, web, 'utf8');
console.log('Web: customProductQty initial values set to empty.');

// ── MOBILE ───────────────────────────────────────────────────────────────────
const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
let mob = fs.readFileSync(mobileFile, 'utf8');

// 1. Initial states
mob = mob.replace(
    `const [customProductQty, setCustomProductQty] = useState('1');`,
    `const [customProductQty, setCustomProductQty] = useState('');`
);
mob = mob.replace(
    `const [editCustomProductQty, setEditCustomProductQty] = useState('1');`,
    `const [editCustomProductQty, setEditCustomProductQty] = useState('');`
);

// 2. onChange: || '1' → remove fallback
mob = mob.replace(
    /setCustomProductQty\(t\.replace\(\/\[^0-9\]\/g, ''\) \|\| '1'\)/g,
    `setCustomProductQty(t.replace(/[^0-9]/g, ''))`
);
mob = mob.replace(
    /setEditCustomProductQty\(t\.replace\(\/\[^0-9\]\/g, ''\) \|\| '1'\)/g,
    `setEditCustomProductQty(t.replace(/[^0-9]/g, ''))`
);

// 3. Reset calls
mob = mob.replace(/setCustomProductQty\('1'\)/g, `setCustomProductQty('')`);
mob = mob.replace(/setEditCustomProductQty\('1'\)/g, `setEditCustomProductQty('')`);

fs.writeFileSync(mobileFile, mob, 'utf8');
console.log('Mobile: customProductQty initial values set to empty.');

// ── VERIFY ───────────────────────────────────────────────────────────────────
const webCheck = fs.readFileSync(webFile, 'utf8');
const mobCheck = fs.readFileSync(mobileFile, 'utf8');

const webBad = (webCheck.match(/customProductQty.*'1'/g) || []).filter(l => !l.includes('parseInt'));
const mobBad = (mobCheck.match(/customProductQty.*'1'/g) || []).filter(l => !l.includes('parseInt'));

if (webBad.length) console.warn('Web still has qty=1:', webBad);
else console.log('Web: no leftover qty=1 references.');

if (mobBad.length) console.warn('Mobile still has qty=1:', mobBad);
else console.log('Mobile: no leftover qty=1 references.');
