const fs = require('fs');
try {
  const content = fs.readFileSync('server.js', 'utf8');
  const lines = content.split(/\r?\n/);
  const out = [];
  lines.forEach((l, i) => {
    if(l.includes('checkAndMarkOrderCompleted') || l.includes('/api/admin/delivery-batches') || l.includes('Completed')) {
      out.push(`${i+1}: ${l}`);
    }
  });
  fs.writeFileSync('out.txt', out.join('\n'));
} catch (e) {
  fs.writeFileSync('out.txt', e.toString());
}
