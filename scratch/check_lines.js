const fs = require('fs');
const content = fs.readFileSync('client/src/admin/CustomerLedger.jsx', 'utf8');
const lines = content.split('\n');
console.log('Line 1302 starts with:', lines[1301].slice(0, 200));
console.log('Line 1302 ends with:', lines[1301].slice(-200));
console.log('Line 1958 starts with:', lines[1957].slice(0, 200));
console.log('Line 1958 ends with:', lines[1957].slice(-200));
