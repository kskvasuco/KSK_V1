const fs = require('fs');
const filePath = 'd:/KSK/HOST/KSK REACT/KSK1/V_1 - Main/mobile/src/screens/admin/CustomerLedgerScreen.js';

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Update You Gave and You Got selected products price input onChangeText in mobile
const originalPriceOnChangeMobile = `value={price !== undefined ? String(price) : String(product.price)}
                                onChangeText={(text) => {
                                  const val = parseFloat(text) || 0;
                                  setSelectedProducts(prev => {
                                    const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                    syncAmountFromSelectedProducts(next);
                                    return next;
                                  });
                                }}`.replace(/\r\n/g, '\n');

const newPriceOnChangeMobile = `value={price !== undefined ? String(price) : String(product.price)}
                                onChangeText={(text) => {
                                  const raw = text.replace(/[^0-9.]/g, '');
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

content = content.split(originalPriceOnChangeMobile).join(newPriceOnChangeMobile);

// 2. Update You Gave and You Got selected products quantity input onChangeText in mobile
const originalQtyOnChangeMobile = `value={qty ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text;
                                 const val = raw === '' ? '' : Math.max(1, parseInt(raw) || 1);
                                 setSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   syncAmountFromSelectedProducts(next);
                                   return next;
                                 });
                               }}`.replace(/\r\n/g, '\n');

const newQtyOnChangeMobile = `value={qty ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\\D/g, '');
                                 const val = raw === '' ? '' : Math.max(1, Math.min(999999, parseInt(raw, 10) || 1));
                                 setSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   syncAmountFromSelectedProducts(next);
                                   return next;
                                 });
                               }}`.replace(/\r\n/g, '\n');

content = content.split(originalQtyOnChangeMobile).join(newQtyOnChangeMobile);

// 3. Update Edit Transaction selected products price input onChangeText in mobile
const originalEditPriceOnChangeMobile = `value={price !== undefined ? String(price) : String(product.price)}
                                onChangeText={(text) => {
                                  const val = parseFloat(text) || 0;
                                  setEditSelectedProducts(prev => {
                                    const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                    const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 1)), 0);
                                    setEditTxAmount(String(Math.round(total)));
                                    return next;
                                  });
                                }}`.replace(/\r\n/g, '\n');

const newEditPriceOnChangeMobile = `value={price !== undefined ? String(price) : String(product.price)}
                                onChangeText={(text) => {
                                  const raw = text.replace(/[^0-9.]/g, '');
                                  const parts = raw.split('.');
                                  if (parts.length > 2) return;
                                  if (parts[1] && parts[1].length > 2) return;
                                  const val = parseFloat(raw) || 0;
                                  if (val > 99999999) return;
                                  setEditSelectedProducts(prev => {
                                    const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                    const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 1)), 0);
                                    setEditTxAmount(String(Math.round(total)));
                                    return next;
                                  });
                                }}`.replace(/\r\n/g, '\n');

content = content.split(originalEditPriceOnChangeMobile).join(newEditPriceOnChangeMobile);

// 4. Update Edit Transaction selected products quantity input onChangeText in mobile
const originalEditQtyOnChangeMobile = `value={qty ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text;
                                 const val = raw === '' ? '' : Math.max(1, parseInt(raw) || 1);
                                 setEditSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 1)), 0);
                                   setEditTxAmount(String(Math.round(total)));
                                   return next;
                                 });
                               }}`.replace(/\r\n/g, '\n');

const newEditQtyOnChangeMobile = `value={qty ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\\D/g, '');
                                 const val = raw === '' ? '' : Math.max(1, Math.min(999999, parseInt(raw, 10) || 1));
                                 setEditSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 1)), 0);
                                   setEditTxAmount(String(Math.round(total)));
                                   return next;
                                 });
                               }}`.replace(/\r\n/g, '\n');

content = content.split(originalEditQtyOnChangeMobile).join(newEditQtyOnChangeMobile);

// Convert line endings back
const finalContent = content.includes('\n') ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Success: Added robust validation for quantity and price fields in CustomerLedgerScreen.js');
