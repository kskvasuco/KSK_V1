const fs = require('fs');
const https = require('https');

const url = 'https://raw.githubusercontent.com/googlefonts/muktamalar/main/fonts/ttf/MuktaMalar-Regular.ttf';
const dest = 'client/public/tamil_font.ttf';

https.get(url, (res) => {
    if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log('Successfully downloaded: ' + dest);
        });
    } else {
        console.log('Failed, status: ' + res.statusCode);

        // Try alternate URL
        const url2 = 'https://raw.githubusercontent.com/google/fonts/main/ofl/muktamalar/MuktaMalar-Regular.ttf';
        https.get(url2, (res2) => {
            if (res2.statusCode === 200) {
                const file2 = fs.createWriteStream(dest);
                res2.pipe(file2);
                file2.on('finish', () => { file2.close(); console.log('Successfully downloaded alternate: ' + dest); });
            } else {
                console.log('Alternate failed too: ' + res2.statusCode);
            }
        })
    }
}).on('error', (err) => console.log('Error: ' + err.message));
