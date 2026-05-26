const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all (parseInt(it.qty) || 1) with (parseInt(it.qty) || 0)
const search = '(parseInt(it.qty) || 1)';
const replacement = '(parseInt(it.qty) || 0)';

if (content.includes(search)) {
  content = content.split(search).join(replacement);
  console.log('Successfully replaced occurrences of parseInt(it.qty) || 1');
} else {
  console.log('Search pattern not found!');
}

fs.writeFileSync(filePath, content, 'utf8');
