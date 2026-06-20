const fs = require('fs');

const filePath = 'd:\\KSK\\HOST\\KSK REACT\\KSK1\\V_1 - Main\\client\\src\\admin\\CustomerLedger.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove state variable: const [ledgerPageSize, setLedgerPageSize] = useState('a5'); ...
const stateRegex = /const\s+\[ledgerPageSize,\s*setLedgerPageSize\]\s*=\s*useState\('a5'\);[^\n]*/;
if (stateRegex.test(content)) {
    content = content.replace(stateRegex, "");
    console.log("State variable removed.");
} else {
    console.log("Warning: State regex not found!");
}

// 2. Replace const pageSize = ledgerPageSize;
const assignRegex = /const\s+pageSize\s*=\s*ledgerPageSize\s*;/;
if (assignRegex.test(content)) {
    content = content.replace(assignRegex, "const pageSize = 'a5';");
    console.log("Page size assignment updated.");
} else {
    console.log("Warning: Assignment regex not found!");
}

// 3. Remove UI container for Paper Size
// We will look for <label ...>Select Paper Size *</label> and its surrounding container.
// Specifically from <div style={{ marginBottom: '16px' }}> containing Select Paper Size * to the closing </div> and the following <hr />
// We can use a regex that matches from the label's parent div to the <hr />
const uiRegex = /<div\s+style=\{\{\s*marginBottom:\s*'16px'\s*\}\}>\s*<label[^>]*Select\s+Paper\s+Size\s+\*<\/label>[\s\S]*?<\/div>\s*<\/div>\s*<hr\s+style=\{\{\s*border:\s*'0',\s*borderTop:\s*'1px\s+solid\s+#e2e8f0',\s*margin:\s*'16px\s+0'\s*\}\}\s*\/>/;

if (uiRegex.test(content)) {
    content = content.replace(uiRegex, "");
    console.log("UI container removed.");
} else {
    console.log("Warning: UI container regex not found! Trying fallback...");
    // Let's do a simpler label regex match and delete its containing elements if possible, or print surrounding lines
    const labelMatch = content.match(/Select Paper Size \*/);
    if (labelMatch) {
        console.log("Found text 'Select Paper Size *' at index", labelMatch.index);
        const startIdx = content.lastIndexOf('<div', labelMatch.index);
        const endIdx = content.indexOf('</div>', labelMatch.index) + 6;
        // Let's print around it
        console.log("Snippet:", content.substring(startIdx - 100, endIdx + 200));
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Finished patching CustomerLedger.jsx.");
