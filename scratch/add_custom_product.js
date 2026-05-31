const fs = require('fs');
const path = require('path');

// ─── WEB FILE ────────────────────────────────────────────────────────────────
const webFile = path.join(__dirname, '..', 'client', 'src', 'admin', 'CustomerLedger.jsx');
let web = fs.readFileSync(webFile, 'utf8');

// 1. Add custom product states after the product picker state block
const stateTarget = `    // Product picker state (for You Got modal)
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]); // [{product, qty}]
    const [useProductPicker, setUseProductPicker] = useState(false);`;

const stateReplacement = `    // Product picker state (for You Got modal)
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]); // [{product, qty}]
    const [useProductPicker, setUseProductPicker] = useState(false);

    // Custom product states (shared between You Gave / You Got modals)
    const [showCustomProductForm, setShowCustomProductForm] = useState(false);
    const [customProductName, setCustomProductName] = useState('');
    const [customProductPrice, setCustomProductPrice] = useState('');
    const [customProductQty, setCustomProductQty] = useState('1');

    // Custom product states for Edit Transaction modal
    const [showEditCustomProductForm, setShowEditCustomProductForm] = useState(false);
    const [editCustomProductName, setEditCustomProductName] = useState('');
    const [editCustomProductPrice, setEditCustomProductPrice] = useState('');
    const [editCustomProductQty, setEditCustomProductQty] = useState('1');`;

if (!web.includes(stateTarget)) {
    console.error('WEB: state target not found'); process.exit(1);
}
web = web.replace(stateTarget, stateReplacement);

// ─── Custom product form snippet (for You Gave / You Got) ────────────────────
// This goes right after the </select> closing tag in the You Gave / You Got pickers,
// before the selectedProducts.length > 0 check.
// The pickers in those two modals share the same state (selectedProducts), so one snippet works.
// We add it after each select closing: `e.target.value = ''; // Reset select dropdown`
// followed by `}}\n                                        style=...`

const customFormSnippetYG = `

                                    {/* ── Custom Product Entry ── */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => { setShowCustomProductForm(v => !v); setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty('1'); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1.5px dashed #6366f1', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#6366f1', fontWeight: '600', fontSize: '12px', width: '100%', justifyContent: 'center' }}
                                        >
                                            ✏️ {showCustomProductForm ? 'Cancel Custom Item' : 'Add Custom Item'}
                                        </button>
                                        {showCustomProductForm && (
                                            <div style={{ marginTop: '8px', padding: '10px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '8px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '6px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Item / Product name"
                                                        value={customProductName}
                                                        onChange={e => setCustomProductName(e.target.value)}
                                                        style={{ padding: '6px 10px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                                                    />
                                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <span style={{ position: 'absolute', left: '7px', fontSize: '11px', color: '#6366f1', fontWeight: '700' }}>₹</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Price"
                                                            value={customProductPrice}
                                                            onChange={e => setCustomProductPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                                                            style={{ width: '75px', padding: '6px 8px 6px 18px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'right' }}
                                                        />
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        placeholder="Qty"
                                                        value={customProductQty}
                                                        onChange={e => setCustomProductQty(e.target.value.replace(/[^0-9]/g, '') || '1')}
                                                        style={{ width: '50px', padding: '6px 8px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'center' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const name = customProductName.trim();
                                                            const price = parseFloat(customProductPrice) || 0;
                                                            const qty = parseInt(customProductQty, 10) || 1;
                                                            if (!name) return;
                                                            const customId = 'custom_' + Date.now();
                                                            setSelectedProducts(prev => {
                                                                const next = [...prev, { product: { _id: customId, name, sku: '', price, isCustom: true }, qty, price }];
                                                                syncAmountFromSelectedProducts(next);
                                                                return next;
                                                            });
                                                            setShowCustomProductForm(false);
                                                            setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty('1');
                                                        }}
                                                        style={{ padding: '6px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>`;

// You Gave picker: insert after the select's closing tag
const youGaveSelectEnd = `                                            e.target.value = ''; // Reset select dropdown
                                        }}
                                        style={{ ...formInputStyle, marginBottom: '12px', fontSize: '14px', cursor: 'pointer' }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>➕ Choose a product to add...</option>
                                        {availableProductsForPicker.map(p => (
                                            <option key={p._id} value={p._id}>
                                                {p.name} {p.sku ? \`(\${p.sku})\` : ''} — ₹{p.price}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedProducts.length > 0 ? (`;

if (!web.includes(youGaveSelectEnd)) {
    console.error('WEB: youGaveSelectEnd not found'); process.exit(1);
}

// We need to insert the custom form between </select> and the selectedProducts check
// Replace the `\n\n                                    {selectedProducts.length > 0 ? (` part
const youGaveTarget = `                                    </select>

                                    {selectedProducts.length > 0 ? (`;
const youGaveReplacement = `                                    </select>
${customFormSnippetYG}

                                    {selectedProducts.length > 0 ? (`;

web = web.replace(youGaveTarget, youGaveReplacement);

// You Got picker has IDENTICAL structure - same replacement string appears twice
// But with the first replacement done, we use AllowMultiple via indexOf
const secondPickerTarget = `                                    </select>

                                    {selectedProducts.length > 0 ? (`;
const idx = web.indexOf(secondPickerTarget);
if (idx !== -1) {
    web = web.slice(0, idx) + `                                    </select>
${customFormSnippetYG}

                                    {selectedProducts.length > 0 ? (` + web.slice(idx + secondPickerTarget.length);
}

// ─── Custom product form snippet for EDIT TRANSACTION ────────────────────────
const customFormSnippetEdit = `

                                     {/* ── Custom Product Entry (Edit TX) ── */}
                                     <div style={{ marginBottom: '8px' }}>
                                         <button
                                             type="button"
                                             onClick={() => { setShowEditCustomProductForm(v => !v); setEditCustomProductName(''); setEditCustomProductPrice(''); setEditCustomProductQty('1'); }}
                                             style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1.5px dashed #6366f1', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#6366f1', fontWeight: '600', fontSize: '11px', width: '100%', justifyContent: 'center' }}
                                             disabled={editTx?.deleteRequest?.status === 'pending'}
                                         >
                                             ✏️ {showEditCustomProductForm ? 'Cancel Custom Item' : 'Add Custom Item'}
                                         </button>
                                         {showEditCustomProductForm && (
                                             <div style={{ marginTop: '6px', padding: '8px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '8px' }}>
                                                 <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '5px', alignItems: 'center' }}>
                                                     <input
                                                         type="text"
                                                         placeholder="Item / Product name"
                                                         value={editCustomProductName}
                                                         onChange={e => setEditCustomProductName(e.target.value)}
                                                         style={{ padding: '5px 8px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '11px', outline: 'none' }}
                                                         disabled={editTx?.deleteRequest?.status === 'pending'}
                                                     />
                                                     <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                         <span style={{ position: 'absolute', left: '6px', fontSize: '10px', color: '#6366f1', fontWeight: '700' }}>₹</span>
                                                         <input
                                                             type="number"
                                                             placeholder="Price"
                                                             value={editCustomProductPrice}
                                                             onChange={e => setEditCustomProductPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                                                             style={{ width: '68px', padding: '5px 6px 5px 16px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '11px', outline: 'none', textAlign: 'right' }}
                                                             disabled={editTx?.deleteRequest?.status === 'pending'}
                                                         />
                                                     </div>
                                                     <input
                                                         type="number"
                                                         min="1"
                                                         placeholder="Qty"
                                                         value={editCustomProductQty}
                                                         onChange={e => setEditCustomProductQty(e.target.value.replace(/[^0-9]/g, '') || '1')}
                                                         style={{ width: '45px', padding: '5px 6px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '11px', outline: 'none', textAlign: 'center' }}
                                                         disabled={editTx?.deleteRequest?.status === 'pending'}
                                                     />
                                                     <button
                                                         type="button"
                                                         onClick={() => {
                                                             const name = editCustomProductName.trim();
                                                             const price = parseFloat(editCustomProductPrice) || 0;
                                                             const qty = parseInt(editCustomProductQty, 10) || 1;
                                                             if (!name) return;
                                                             const customId = 'custom_' + Date.now();
                                                             setEditSelectedProducts(prev => {
                                                                 const next = [...prev, { product: { _id: customId, name, sku: '', price, isCustom: true }, qty, price }];
                                                                 const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseFloat(it.qty) || 0)), 0);
                                                                 setEditTxAmount(total.toFixed(2));
                                                                 return next;
                                                             });
                                                             setShowEditCustomProductForm(false);
                                                             setEditCustomProductName(''); setEditCustomProductPrice(''); setEditCustomProductQty('1');
                                                         }}
                                                         style={{ padding: '5px 10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                                         disabled={editTx?.deleteRequest?.status === 'pending'}
                                                     >
                                                         Add
                                                     </button>
                                                 </div>
                                             </div>
                                         )}
                                     </div>`;

// Edit TX picker ends with: e.target.value = ''; then } and then {editSelectedProducts.length > 0 ? (
const editSelectEnd = `                                     </select>

                                    {editSelectedProducts.length > 0 ? (`;

if (!web.includes(editSelectEnd)) {
    console.error('WEB: editSelectEnd not found'); process.exit(1);
}

web = web.replace(editSelectEnd,
    `                                     </select>
${customFormSnippetEdit}

                                    {editSelectedProducts.length > 0 ? (`);

fs.writeFileSync(webFile, web, 'utf8');
console.log('Web file updated successfully.');

// ─── MOBILE FILE ─────────────────────────────────────────────────────────────
const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
let mob = fs.readFileSync(mobileFile, 'utf8');

// 1. Add states after product picker states
const mobStateTarget = `  // Product Picker States
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]); // [{product, qty}]
  const [useProductPicker, setUseProductPicker] = useState(false);`;

const mobStateReplacement = `  // Product Picker States
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]); // [{product, qty}]
  const [useProductPicker, setUseProductPicker] = useState(false);

  // Custom product states (You Gave / You Got modals)
  const [showCustomProductForm, setShowCustomProductForm] = useState(false);
  const [customProductName, setCustomProductName] = useState('');
  const [customProductPrice, setCustomProductPrice] = useState('');
  const [customProductQty, setCustomProductQty] = useState('1');

  // Custom product states (Edit Transaction modal)
  const [showEditCustomProductForm, setShowEditCustomProductForm] = useState(false);
  const [editCustomProductName, setEditCustomProductName] = useState('');
  const [editCustomProductPrice, setEditCustomProductPrice] = useState('');
  const [editCustomProductQty, setEditCustomProductQty] = useState('1');`;

if (!mob.includes(mobStateTarget)) {
    console.error('MOBILE: state target not found'); process.exit(1);
}
mob = mob.replace(mobStateTarget, mobStateReplacement);

// 2. Custom product JSX block for You Gave / You Got (shared selectedProducts)
const mobCustomFormYG = `

                  {/* Custom Item Entry */}
                  <View style={{ marginBottom: 8 }}>
                    <Pressable
                      onPress={() => { setShowCustomProductForm(v => !v); setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty('1'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6366f1', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 4 }}
                    >
                      <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 12 }}>✏️ {showCustomProductForm ? 'Cancel Custom Item' : 'Add Custom Item'}</Text>
                    </Pressable>
                    {showCustomProductForm && (
                      <View style={{ padding: 10, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 8, marginTop: 4 }}>
                        <TextInput
                          placeholder="Item / Product name"
                          value={customProductName}
                          onChangeText={setCustomProductName}
                          style={{ borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 6, padding: 7, fontSize: 12, marginBottom: 6, backgroundColor: '#fff' }}
                        />
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                          <TextInput
                            placeholder="Price (₹)"
                            keyboardType="numeric"
                            value={customProductPrice}
                            onChangeText={t => setCustomProductPrice(t.replace(/[^0-9.]/g, ''))}
                            style={{ flex: 1, borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 6, padding: 7, fontSize: 12, backgroundColor: '#fff', textAlign: 'right' }}
                          />
                          <TextInput
                            placeholder="Qty"
                            keyboardType="numeric"
                            value={customProductQty}
                            onChangeText={t => setCustomProductQty(t.replace(/[^0-9]/g, '') || '1')}
                            style={{ width: 55, borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 6, padding: 7, fontSize: 12, backgroundColor: '#fff', textAlign: 'center' }}
                          />
                        </View>
                        <Pressable
                          onPress={() => {
                            const name = customProductName.trim();
                            const price = parseFloat(customProductPrice) || 0;
                            const qty = parseInt(customProductQty, 10) || 1;
                            if (!name) return;
                            const customId = 'custom_' + Date.now();
                            setSelectedProducts(prev => {
                              const next = [...prev, { product: { _id: customId, name, sku: '', price, isCustom: true }, qty, price }];
                              syncAmountFromSelectedProducts(next);
                              return next;
                            });
                            setShowCustomProductForm(false);
                            setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty('1');
                          }}
                          style={{ backgroundColor: '#6366f1', borderRadius: 6, paddingVertical: 8, alignItems: 'center' }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Add Custom Item</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>`;

// Insert after </Picker> closing and </View> (dropdownWrapper) in You Gave, before selectedProducts check
// Pattern: `      </View>\n\n                  {selectedProducts.length > 0 ? (`
const mobYGPickerInsert = `                  </View>

                  {selectedProducts.length > 0 ? (`;
const mobYGCount = (mob.match(new RegExp(mobYGPickerInsert.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`MOBILE: Found ${mobYGCount} occurrences of YG picker insert point`);

// Do it for both You Gave and You Got (first 2 occurrences)
let replaced = 0;
mob = mob.replace(new RegExp(mobYGPickerInsert.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (match) => {
    replaced++;
    if (replaced <= 2) {
        return `                  </View>
${mobCustomFormYG}

                  {selectedProducts.length > 0 ? (`;
    }
    return match;
});
console.log(`MOBILE: Replaced ${replaced} YG picker instances`);

// 3. Custom product form for Edit Transaction (editSelectedProducts)
const mobCustomFormEdit = `

                  {/* Custom Item Entry (Edit TX) */}
                  <View style={{ marginBottom: 8 }}>
                    <Pressable
                      onPress={() => { setShowEditCustomProductForm(v => !v); setEditCustomProductName(''); setEditCustomProductPrice(''); setEditCustomProductQty('1'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6366f1', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 4 }}
                    >
                      <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 11 }}>✏️ {showEditCustomProductForm ? 'Cancel Custom Item' : 'Add Custom Item'}</Text>
                    </Pressable>
                    {showEditCustomProductForm && (
                      <View style={{ padding: 8, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 8, marginTop: 4 }}>
                        <TextInput
                          placeholder="Item / Product name"
                          value={editCustomProductName}
                          onChangeText={setEditCustomProductName}
                          style={{ borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 6, padding: 6, fontSize: 11, marginBottom: 5, backgroundColor: '#fff' }}
                        />
                        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 5 }}>
                          <TextInput
                            placeholder="Price (₹)"
                            keyboardType="numeric"
                            value={editCustomProductPrice}
                            onChangeText={t => setEditCustomProductPrice(t.replace(/[^0-9.]/g, ''))}
                            style={{ flex: 1, borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 6, padding: 6, fontSize: 11, backgroundColor: '#fff', textAlign: 'right' }}
                          />
                          <TextInput
                            placeholder="Qty"
                            keyboardType="numeric"
                            value={editCustomProductQty}
                            onChangeText={t => setEditCustomProductQty(t.replace(/[^0-9]/g, '') || '1')}
                            style={{ width: 50, borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 6, padding: 6, fontSize: 11, backgroundColor: '#fff', textAlign: 'center' }}
                          />
                        </View>
                        <Pressable
                          onPress={() => {
                            const name = editCustomProductName.trim();
                            const price = parseFloat(editCustomProductPrice) || 0;
                            const qty = parseInt(editCustomProductQty, 10) || 1;
                            if (!name) return;
                            const customId = 'custom_' + Date.now();
                            setEditSelectedProducts(prev => {
                              const next = [...prev, { product: { _id: customId, name, sku: '', price, isCustom: true }, qty, price }];
                              const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 0)), 0);
                              setEditTxAmount(String(Math.round(total)));
                              return next;
                            });
                            setShowEditCustomProductForm(false);
                            setEditCustomProductName(''); setEditCustomProductPrice(''); setEditCustomProductQty('1');
                          }}
                          style={{ backgroundColor: '#6366f1', borderRadius: 6, paddingVertical: 7, alignItems: 'center' }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>Add Custom Item</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>`;

// Edit TX picker insert: after </View> (dropdownWrapper) before editSelectedProducts check
const mobEditPickerInsert = `                   </View>\n\n                   {editSelectedProducts.length > 0 ? (`;
if (!mob.includes(mobEditPickerInsert)) {
    console.error('MOBILE: editPickerInsert not found'); process.exit(1);
}
mob = mob.replace(mobEditPickerInsert, `                   </View>
${mobCustomFormEdit}

                   {editSelectedProducts.length > 0 ? (`);

fs.writeFileSync(mobileFile, mob, 'utf8');
console.log('Mobile file updated successfully.');
