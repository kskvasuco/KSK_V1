const fs = require('fs');
console.log("Starting sync copy...");
try {
    let source = '';
    if (fs.existsSync('C:/Windows/Fonts/Nirmala.ttf')) {
        source = 'C:/Windows/Fonts/Nirmala.ttf';
    } else if (fs.existsSync('C:/Windows/Fonts/latha.ttf')) {
        source = 'C:/Windows/Fonts/latha.ttf';
    } else if (fs.existsSync('C:/Windows/Fonts/arial.ttf')) {
        source = 'C:/Windows/Fonts/arial.ttf';
    }

    if (source) {
        console.log("Found source: " + source);
        fs.copyFileSync(source, 'client/public/tamil_font.ttf');
        console.log("Copied successfully! Size: " + fs.statSync('client/public/tamil_font.ttf').size);
    } else {
        console.log("No standard fonts found.");
    }
} catch (e) {
    console.log("Error: " + e.message);
}
