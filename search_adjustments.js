const fs = require('fs');
try {
  let content = fs.readFileSync('server.js');
  // Attempt to decode utf16le if it starts with BOM or has many nulls
  let text = content.toString('utf8');
  if (text.indexOf('\0') !== -1) {
    text = content.toString('utf16le');
  }
  const lines = text.split(/\r?\n/);
  const out = [];
  lines.forEach((l, i) => {
    if(l.toLowerCase().includes('adjustment')) {
      out.push(`[${i+1}]: ${l.trim()}`);
    }
  });
  fs.writeFileSync('out.txt', out.join('\n'));
} catch (e) {
  fs.writeFileSync('out.txt', e.toString());
}
