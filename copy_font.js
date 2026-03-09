const fs = require('fs');
const http = require('http');
const https = require('https');

const sources = [
    'C:/Windows/Fonts/Nirmala.ttf',
    'C:/Windows/Fonts/latha.ttf'
];
let copied = false;
for (const src of sources) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, 'client/public/tamil_font.ttf');
        console.log('Copied local font ' + src);
        copied = true;
        break;
    }
}

// Fallback to a Node library download if no local
if (!copied) {
    console.log('Downloading MuktaMalar via Node HTTP...');
    const url = 'https://github.com/google/fonts/raw/main/ofl/muktamalar/MuktaMalar-Regular.ttf';
    const filePath = 'client/public/tamil_font.ttf';

    // Quick helper to download and handle redirects
    const download = (url, dest, cb) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return download(res.headers.location, dest, cb);
            }
            if (res.statusCode !== 200) {
                console.log('Status: ' + res.statusCode);
                return;
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => {
                file.close(cb);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            if (cb) cb(err.message);
        });
    };

    download(url, filePath, (err) => {
        if (err) console.log(err);
        else console.log('Downloaded MuktaMalar from GitHub!');
    });
}
