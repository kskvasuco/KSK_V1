const fs = require('fs');
const content = fs.readFileSync('client/src/admin/CustomerLedger.jsx', 'utf8');
console.log('File length in characters:', content.length);
console.log('File length in bytes:', Buffer.byteLength(content, 'utf8'));
const lines = content.split('\n');
console.log('Total lines:', lines.length);
const sortedLines = lines.map((l, i) => ({ index: i + 1, length: l.length }))
  .sort((a, b) => b.length - a.length);
console.log('Top 10 longest lines:');
sortedLines.slice(0, 10).forEach(l => {
  console.log(`Line ${l.index}: ${l.length} chars`);
});
