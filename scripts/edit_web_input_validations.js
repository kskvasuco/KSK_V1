const fs = require('fs');
const filePath = 'd:/KSK/HOST/KSK REACT/KSK1/V_1 - Main/client/src/admin/CustomerLedger.jsx';

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Update You Gave and You Got selected products price input onChange
const originalPriceOnChange = `onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    setSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                                                        syncAmountFromSelectedProducts(next);
                                                                        return next;
                                                                    });
                                                                }}`.replace(/\r\n/g, '\n');

const newPriceOnChange = `onChange={(e) => {
                                                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                                    const parts = raw.split('.');
                                                                    if (parts.length > 2) return;
                                                                    if (parts[1] && parts[1].length > 2) return;
                                                                    const val = parseFloat(raw) || 0;
                                                                    if (val > 99999999) return;
                                                                    setSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                                                        syncAmountFromSelectedProducts(next);
                                                                        return next;
                                                                    });
                                                                }}`.replace(/\r\n/g, '\n');

content = content.split(originalPriceOnChange).join(newPriceOnChange);

// 2. Update You Gave and You Got selected products quantity input onChange
const originalQtyOnChange = `onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    const val = raw === '' ? '' : Math.max(1, parseInt(raw) || 1);
                                                                    setSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                                                        syncAmountFromSelectedProducts(next);
                                                                        return next;
                                                                    });
                                                                }}`.replace(/\r\n/g, '\n');

const newQtyOnChange = `onChange={(e) => {
                                                                    const raw = e.target.value.replace(/\\D/g, '');
                                                                    const val = raw === '' ? '' : Math.max(1, Math.min(999999, parseInt(raw, 10) || 1));
                                                                    setSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                                                        syncAmountFromSelectedProducts(next);
                                                                        return next;
                                                                    });
                                                                }}`.replace(/\r\n/g, '\n');

content = content.split(originalQtyOnChange).join(newQtyOnChange);

// 3. Update Edit Transaction selected products price input onChange
const originalEditPriceOnChange = `onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    setEditSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                                                        const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 1)), 0);
                                                                        setEditTxAmount(total.toFixed(2));
                                                                        return next;
                                                                    });
                                                                }}`.replace(/\r\n/g, '\n');

const newEditPriceOnChange = `onChange={(e) => {
                                                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                                    const parts = raw.split('.');
                                                                    if (parts.length > 2) return;
                                                                    if (parts[1] && parts[1].length > 2) return;
                                                                    const val = parseFloat(raw) || 0;
                                                                    if (val > 99999999) return;
                                                                    setEditSelectedProducts(prev => {
                                                                        const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                                                        const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 1)), 0);
                                                                        setEditTxAmount(total.toFixed(2));
                                                                        return next;
                                                                    });
                                                                }}`.replace(/\r\n/g, '\n');

content = content.split(originalEditPriceOnChange).join(newEditPriceOnChange);

// 4. Update Edit Transaction selected products quantity input onChange
const originalEditQtyOnChange = `onChange={(e) => {
                                                                 const raw = e.target.value;
                                                                 const val = raw === '' ? '' : Math.max(1, parseInt(raw) || 1);
                                                                 setEditSelectedProducts(prev => {
                                                                     const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                                                     const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 1)), 0);
                                                                     setEditTxAmount(total.toFixed(2));
                                                                     return next;
                                                                 });
                                                             }}`.replace(/\r\n/g, '\n');

const newEditQtyOnChange = `onChange={(e) => {
                                                                 const raw = e.target.value.replace(/\\D/g, '');
                                                                 const val = raw === '' ? '' : Math.max(1, Math.min(999999, parseInt(raw, 10) || 1));
                                                                 setEditSelectedProducts(prev => {
                                                                     const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                                                     const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 1)), 0);
                                                                     setEditTxAmount(total.toFixed(2));
                                                                     return next;
                                                                 });
                                                             }}`.replace(/\r\n/g, '\n');

content = content.split(originalEditQtyOnChange).join(newEditQtyOnChange);

// Convert line endings back
const finalContent = content.includes('\n') ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Success: Added robust validation for quantity and price fields in CustomerLedger.jsx');
