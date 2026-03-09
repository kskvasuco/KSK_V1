const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
    execSync('npm install adm-zip', { stdio: 'ignore' });
} catch (e) { }

const AdmZip = require('adm-zip');

const zipUrl = 'https://fonts.google.com/download?family=Mukta%20Malar';
const zipPath = path.join(__dirname, 'MuktaMalar.zip');
const targetPath = path.join(__dirname, 'client/public/tamil_font.ttf');

https.get(zipUrl, (response) => {
    let rawData = [];
    response.on('data', (chunk) => rawData.push(chunk));
    response.on('end', () => {
        const buffer = Buffer.concat(rawData);
        fs.writeFileSync(zipPath, buffer);
        console.log('Zip downloaded, extracting...');

        try {
            const zip = new AdmZip(zipPath);
            const zipEntries = zip.getEntries();

            for (let i = 0; i < zipEntries.length; i++) {
                if (zipEntries[i].entryName.endsWith('MuktaMalar-Regular.ttf')) {
                    const ttfBuffer = zipEntries[i].getData();
                    fs.writeFileSync(targetPath, ttfBuffer);
                    console.log('Successfully extracted MuktaMalar-Regular.ttf (size: ' + ttfBuffer.length + ') to ' + targetPath);
                    break;
                }
            }
            fs.unlinkSync(zipPath); // Cleanup
        } catch (err) {
            console.error('Error unzipping:', err);
        }
    });
}).on('error', (e) => console.error(e));
