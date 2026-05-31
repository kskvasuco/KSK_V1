const fs = require('fs');

const filePath = 'client/src/admin/CustomerLedger.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF for consistent replacement, we will write back as LF or CRLF
// Actually keeping LF is totally fine in git
content = content.replace(/\r\n/g, '\n');

// 1. Add States
const stateTarget = '    const [isEditTxOpen, setIsEditTxOpen] = useState(false);';
const stateReplacement = `    const [isEditTxOpen, setIsEditTxOpen] = useState(false);
    const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
    const [recycleBinTxns, setRecycleBinTxns] = useState([]);
    const [recycleBinLoading, setRecycleBinLoading] = useState(false);`;

if (content.includes(stateTarget)) {
  content = content.replace(stateTarget, stateReplacement);
  console.log('1. Added Recycle Bin states');
} else {
  console.log('Error: stateTarget not found!');
}

// 2. Add Recycle Bin style
const styleTarget = 'const closeBalanceBtnStyle = {';
const styleReplacement = `const recycleBinBtnStyle = {
    background: 'rgba(75, 85, 99, 0.07)',
    color: '#4b5563',
    border: '1px solid rgba(75, 85, 99, 0.18)',
    padding: '7px 14px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
    letterSpacing: '0.2px'
};

const closeBalanceBtnStyle = {`;

if (content.includes(styleTarget)) {
  content = content.replace(styleTarget, styleReplacement);
  console.log('2. Added Recycle Bin button style');
} else {
  console.log('Error: styleTarget not found!');
}

// 3. Add Recycle Bin Button next to Close Balance button
const btnTarget = `<button style={closeBalanceBtnStyle} onClick={openCloseBalance}>🔒 Close Balance</button>`;
const btnReplacement = `<button style={closeBalanceBtnStyle} onClick={openCloseBalance}>🔒 Close Balance</button>
                            <button style={recycleBinBtnStyle} onClick={async () => {
                                setIsRecycleBinOpen(true);
                                setRecycleBinLoading(true);
                                try {
                                    const bin = await adminApi.getRecycleBin(userId);
                                    setRecycleBinTxns(bin || []);
                                } catch (e) {
                                    console.error(e);
                                } finally {
                                    setRecycleBinLoading(false);
                                }
                            }}>🗑️ Recycle Bin</button>`;

if (content.includes(btnTarget)) {
  content = content.replace(btnTarget, btnReplacement);
  console.log('3. Added Recycle Bin button in profile card');
} else {
  console.log('Error: btnTarget not found!');
}

// 4. Update openEditTransaction to set editTxDate
const openEditTarget = '    const openEditTransaction = async (tx) => {\n        setEditTx(tx);\n        setEditTxAmount(String(tx.amount || \'\'));\n        setEditTxDescription(tx.description || \'\');';
const openEditReplacement = `    const openEditTransaction = async (tx) => {
        setEditTx(tx);
        setEditTxAmount(String(tx.amount || ''));
        setEditTxDescription(tx.description || '');
        setEditTxDate(tx.date ? new Date(tx.date).toISOString().split('T')[0] : '');`;

if (content.includes(openEditTarget)) {
  content = content.replace(openEditTarget, openEditReplacement);
  console.log('4. Updated openEditTransaction');
} else {
  // Let's try matching with single quotes or different whitespace
  const openEditAlternative = '        setEditTx(tx);\n        setEditTxAmount(String(tx.amount || \'\'));\n        setEditTxDescription(tx.description || \'\');';
  const openEditAltReplacement = `        setEditTx(tx);
        setEditTxAmount(String(tx.amount || ''));
        setEditTxDescription(tx.description || '');
        setEditTxDate(tx.date ? new Date(tx.date).toISOString().split('T')[0] : '');`;
  if (content.includes(openEditAlternative)) {
    content = content.replace(openEditAlternative, openEditAltReplacement);
    console.log('4. Updated openEditTransaction (Alternative)');
  } else {
    console.log('Error: openEditTransaction targets not found!');
  }
}

// 5. In handleSaveTransaction, add date field in payload
const saveTarget = `            await adminApi.updateLedgerTransaction(editTx._id, {
                amount: numAmount,
                description: finalDescription,
                productItems: productItems.length > 0 ? productItems : undefined
            });`;

const saveReplacement = `            await adminApi.updateLedgerTransaction(editTx._id, {
                amount: numAmount,
                description: finalDescription,
                date: editTxDate ? new Date(editTxDate) : undefined,
                productItems: productItems.length > 0 ? productItems : undefined
            });`;

if (content.includes(saveTarget)) {
  content = content.replace(saveTarget, saveReplacement);
  console.log('5. Updated handleSaveTransaction payload');
} else {
  console.log('Error: saveTarget not found!');
}

// 6. Make Edit Transaction popup container scrollable
const scrollTarget = `<div style={{ ...modalContentStyle, maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>`;
const scrollReplacement = `<div style={{ ...modalContentStyle, maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>`;

if (content.includes(scrollTarget)) {
  content = content.replace(scrollTarget, scrollReplacement);
  console.log('6. Made Edit Transaction modal scrollable');
} else {
  console.log('Error: scrollTarget not found!');
}

// 7. Add Date Field inside Edit Transaction Modal
const descFieldTarget = `                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Description / Notes</label>
                                <textarea
                                    style={{ ...formTextareaStyle, minHeight: '70px' }}
                                    value={editTxDescription}
                                    onChange={e => setEditTxDescription(e.target.value)}
                                    placeholder="Enter description"
                                    disabled={editTx?.deleteRequest?.status === 'pending'}
                                />
                            </div>`;

const descFieldReplacement = `                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Description / Notes</label>
                                <textarea
                                    style={{ ...formTextareaStyle, minHeight: '70px' }}
                                    value={editTxDescription}
                                    onChange={e => setEditTxDescription(e.target.value)}
                                    placeholder="Enter description"
                                    disabled={editTx?.deleteRequest?.status === 'pending'}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Transaction Date</label>
                                <input
                                    type="date"
                                    style={formInputStyle}
                                    value={editTxDate}
                                    onChange={e => setEditTxDate(e.target.value)}
                                    disabled={editTx?.deleteRequest?.status === 'pending'}
                                />
                            </div>`;

if (content.includes(descFieldTarget)) {
  content = content.replace(descFieldTarget, descFieldReplacement);
  console.log('7. Added Transaction Date field inside Edit Modal');
} else {
  console.log('Error: descFieldTarget not found!');
}

// 8. Insert Recycle Bin Modal at the bottom of the JSX before the outer closing div
const closingTarget = `                    </div>
                </div>
            )}
        </div>`;

const recycleBinModalHtml = fs.readFileSync('scratch/recycle_bin_modal.txt', 'utf8').replace(/\r\n/g, '\n');

const closingReplacement = `                    </div>
                </div>
            )}

${recycleBinModalHtml}
        </div>`;

if (content.includes(closingTarget)) {
  content = content.replace(closingTarget, closingReplacement);
  console.log('8. Added Recycle Bin Modal markup successfully!');
} else {
  console.log('Error: closingTarget not found!');
}

// Write back updated file
fs.writeFileSync(filePath, content, 'utf8');
console.log('CustomerLedger.jsx edits completed!');
