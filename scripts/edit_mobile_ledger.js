const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
let content = fs.readFileSync(filePath, 'utf8');

// Helper to replace text using regex
function regexReplace(regex, replacement, name) {
  if (regex.test(content)) {
    content = content.replace(regex, replacement);
    console.log(`Successfully replaced: ${name}`);
  } else {
    console.log(`Failed to match regex for: ${name}`);
  }
}

// 1. You Gave Quantity Input
// We want to match:
// <TextInput ... value={qty ? String(qty) : ''} ... onChangeText={(text) => { ... }} ... style={styles.qtyInput} />
// and replace value/onChangeText
const youGaveRegex = /(<TextInput\s+keyboardType="numeric"\s+value=\{qty \? String\(qty\) : ''\}\s+onChangeText=\{\(text\) => \{\s+const raw = text\.replace\(\/\\D\/g, ''\);\s+const val = raw === '' \? '' : Math\.max\(1, Math\.min\(999999, parseInt\(raw, 10\) \|\| 1\)\);[\s\S]*?\}\}\s+style=\{styles\.qtyInput\}\s+\/>)/;

const newYouGave = `TextInput
                               keyboardType="numeric"
                               value={qty && qty !== 0 && qty !== '0' ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\\D/g, '');
                                 const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseInt(raw, 10) || 0);
                                 setSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   syncAmountFromSelectedProducts(next);
                                   return next;
                                 });
                               }}
                               style={styles.qtyInput}
                             />`;

content = content.replace(/value=\{qty \? String\(qty\) : ''\}\s+onChangeText=\{\(text\) => \{\s+const raw = text\.replace\(\/\\D\/g, ''\);\s+const val = raw === '' \? '' : Math\.max\(1, Math\.min\(999999, parseInt\(raw, 10\) \|\| 1\)\);([\s\S]*?setSelectedProducts[\s\S]*?)\}/, `value={qty && qty !== 0 && qty !== '0' ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\\D/g, '');
                                 const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseInt(raw, 10) || 0);
                                 setSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   syncAmountFromSelectedProducts(next);
                                   return next;
                                 });
                               }`);

// 2. You Got Quantity Input
content = content.replace(/value=\{qty \? String\(qty\) : ''\}\s+onChangeText=\{\(text\) => \{\s+const raw = text;\s+const val = raw === '' \? '' : Math\.max\(1, parseInt\(raw\) \|\| 1\);([\s\S]*?setSelectedProducts[\s\S]*?)\}/, `value={qty && qty !== 0 && qty !== '0' ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\\D/g, '');
                                 const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseInt(raw, 10) || 0);
                                 setSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   syncAmountFromSelectedProducts(next);
                                   return next;
                                 });
                               }`);

// 3. Edit Quantity Input
content = content.replace(/value=\{qty \? String\(qty\) : ''\}\s+onChangeText=\{\(text\) => \{\s+const raw = text\.replace\(\/\\D\/g, ''\);\s+const val = raw === '' \? '' : Math\.max\(1, Math\.min\(999999, parseInt\(raw, 10\) \|\| 1\)\);([\s\S]*?setEditSelectedProducts[\s\S]*?)\}/, `value={qty && qty !== 0 && qty !== '0' ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\\D/g, '');
                                 const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseInt(raw, 10) || 0);
                                 setEditSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 0)), 0);
                                   setEditTxAmount(String(Math.round(total)));
                                   return next;
                                 });
                               }`);

// 4. Edit Tx Remove Button (if not already done)
content = content.replace(/\(parseInt\(it\.qty\) \|\| 1\)\), 0\);\s+setEditTxAmount\(String\(Math\.round\(total\)\)\);/g, `(parseInt(it.qty) || 0)), 0);
                                   setEditTxAmount(String(Math.round(total)));`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Mobile Ledger Screen updated with robust regexes!');
