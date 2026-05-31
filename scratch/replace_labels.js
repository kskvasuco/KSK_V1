const fs = require('fs');
const path = require('path');

// 1. Process client/src/admin/CustomerLedger.jsx
const webFile = path.join(__dirname, '..', 'client', 'src', 'admin', 'CustomerLedger.jsx');
if (fs.existsSync(webFile)) {
    console.log('Processing web file:', webFile);
    let content = fs.readFileSync(webFile, 'utf8');
    let lines = content.split('\n');
    let modifiedCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        // Ignore lines inside the PDF generation functions (lines 870 to 2180)
        if (lineNum >= 870 && lineNum <= 2180) {
            continue;
        }

        let originalLine = lines[i];
        let newLine = lines[i]
            .replace(/Total Debit/g, 'Total You Gave')
            .replace(/Total Credit/g, 'Total You Got')
            .replace(/Confirm Debit/g, 'Confirm You Gave')
            .replace(/Confirm Credit/g, 'Confirm You Got')
            .replace(/🔴 Debit/g, '🔴 You Gave')
            .replace(/🟢 Credit/g, '🟢 You Got')
            .replace(/Debit Entry/g, 'You Gave Entry')
            .replace(/Credit Entry/g, 'You Got Entry')
            .replace(/Debit \/ Sales Booking/g, 'You Gave / Sales Booking')
            .replace(/Credit \/ Payments Booking/g, 'You Got / Payments Booking')
            .replace(/>Debit</g, '>You Gave<')
            .replace(/>Credit</g, '>You Got<')
            .replace(/'🔴 Debit'/g, "'🔴 You Gave'")
            .replace(/'🟢 Credit'/g, "'🟢 You Got'")
            .replace(/"🔴 Debit"/g, '"🔴 You Gave"')
            .replace(/"🟢 Credit"/g, '"🟢 You Got"');

        if (newLine !== originalLine) {
            lines[i] = newLine;
            modifiedCount++;
        }
    }

    fs.writeFileSync(webFile, lines.join('\n'), 'utf8');
    console.log(`Web file processed successfully. Modified ${modifiedCount} lines.`);
} else {
    console.error('Web file not found:', webFile);
}

// 2. Process mobile/src/screens/admin/CustomerLedgerScreen.js
const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
if (fs.existsSync(mobileFile)) {
    console.log('Processing mobile file:', mobileFile);
    let content = fs.readFileSync(mobileFile, 'utf8');
    let lines = content.split('\n');
    let modifiedCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        // Ignore lines inside the PDF generation function generateStatementHtml (lines 900 to 1530)
        if (lineNum >= 900 && lineNum <= 1530) {
            continue;
        }

        let originalLine = lines[i];
        let newLine = lines[i]
            .replace(/TOTAL DEBIT/g, 'TOTAL YOU GAVE')
            .replace(/TOTAL CREDIT/g, 'TOTAL YOU GOT')
            .replace(/DEBIT ₹/g, 'YOU GAVE ₹')
            .replace(/CREDIT ₹/g, 'YOU GOT ₹')
            .replace(/Confirm Debit/g, 'Confirm You Gave')
            .replace(/Confirm Credit/g, 'Confirm You Got')
            .replace(/🔴 Debit/g, '🔴 You Gave')
            .replace(/🟢 Credit/g, '🟢 You Got')
            .replace(/Debit Entry/g, 'You Gave Entry')
            .replace(/Credit Entry/g, 'You Got Entry')
            .replace(/'🔴 Debit'/g, "'🔴 You Gave'")
            .replace(/'🟢 Credit'/g, "'🟢 You Got'")
            .replace(/"🔴 Debit"/g, '"🔴 You Gave"')
            .replace(/"🟢 Credit"/g, '"🟢 You Got"')
            .replace(/CREDIT/g, 'YOU GOT')
            .replace(/DEBIT/g, 'YOU GAVE');

        if (newLine !== originalLine) {
            lines[i] = newLine;
            modifiedCount++;
        }
    }

    fs.writeFileSync(mobileFile, lines.join('\n'), 'utf8');
    console.log(`Mobile file processed successfully. Modified ${modifiedCount} lines.`);
} else {
    console.error('Mobile file not found:', mobileFile);
}
