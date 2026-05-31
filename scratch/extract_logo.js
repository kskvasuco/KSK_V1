const fs = require('fs');
const path = require('path');

// 1. Read CustomerLedger.jsx
const filePath = 'client/src/admin/CustomerLedger.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 2. Find the base64 image
const regex = /data:image\/png;base64,([a-zA-Z0-9+/=]+)/;
const match = content.match(regex);

if (match) {
  const base64Data = match[1];
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Create images dir if not exists
  const imgDir = 'public/images';
  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
  }
  
  const logoPath = path.join(imgDir, 'logo.png');
  fs.writeFileSync(logoPath, buffer);
  console.log('Saved logo to:', logoPath);

  // Also write to client/public/images/logo.png if client has public folder
  const clientPublicDir = 'client/public/images';
  if (fs.existsSync('client/public')) {
    if (!fs.existsSync(clientPublicDir)) {
      fs.mkdirSync(clientPublicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(clientPublicDir, 'logo.png'), buffer);
    console.log('Saved logo to client public:', path.join(clientPublicDir, 'logo.png'));
  }

  // 3. Replace all occurrences of data:image/png;base64,... with /images/logo.png
  // To be safe, let's replace the src="..." part
  const replacedContent = content.replace(/src="data:image\/png;base64,([a-zA-Z0-9+/=]+)"/g, 'src="/images/logo.png"');
  fs.writeFileSync(filePath, replacedContent, 'utf8');
  console.log('Successfully updated CustomerLedger.jsx, removed huge base64 logo!');
} else {
  console.log('No base64 logo found.');
}
