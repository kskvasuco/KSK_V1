const fs = require('fs');
const path = require('path');

const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
let mob = fs.readFileSync(mobileFile, 'utf8');

// Check if states already added
if (!mob.includes('showEditCustomProductForm')) {
    // Add states after existing product picker states
    const stateTarget = '  // Product Picker States\n  const [products, setProducts] = useState([]);\n  const [productSearch, setProductSearch] = useState(\'\');\n  const [selectedProducts, setSelectedProducts] = useState([]); // [{product, qty}]\n  const [useProductPicker, setUseProductPicker] = useState(false);';
    if (!mob.includes(stateTarget)) {
        console.error('State target not found'); process.exit(1);
    }
    mob = mob.replace(stateTarget, stateTarget + `

  // Custom product states (You Gave / You Got modals)
  const [showCustomProductForm, setShowCustomProductForm] = useState(false);
  const [customProductName, setCustomProductName] = useState('');
  const [customProductPrice, setCustomProductPrice] = useState('');
  const [customProductQty, setCustomProductQty] = useState('1');

  // Custom product states (Edit Transaction modal)
  const [showEditCustomProductForm, setShowEditCustomProductForm] = useState(false);
  const [editCustomProductName, setEditCustomProductName] = useState('');
  const [editCustomProductPrice, setEditCustomProductPrice] = useState('');
  const [editCustomProductQty, setEditCustomProductQty] = useState('1');`);
    console.log('States added.');
} else {
    console.log('States already present.');
}

// Check if YG custom form already added
if (!mob.includes('showCustomProductForm')) {
    console.error('showCustomProductForm state missing'); process.exit(1);
}

// Add custom form in Edit TX picker if not present
if (!mob.includes('Custom Item Entry (Edit TX)')) {
    // Find the line with </View> before {editSelectedProducts.length > 0
    // Using a line-by-line approach for precision
    const lines = mob.split('\n');
    let insertIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '</View>' && 
            i + 1 < lines.length && lines[i+1].trim() === '' &&
            i + 2 < lines.length && lines[i+2].includes('editSelectedProducts.length > 0')) {
            // Check this is inside the edit product picker (preceded by </Picker>)
            // Look back for </Picker> within 10 lines
            let hasPicker = false;
            for (let j = Math.max(0, i-10); j < i; j++) {
                if (lines[j].includes('</Picker>')) { hasPicker = true; break; }
            }
            if (hasPicker) {
                insertIdx = i + 1; // insert after the </View> blank line
                break;
            }
        }
    }

    if (insertIdx === -1) {
        console.error('Edit TX picker insertion point not found'); process.exit(1);
    }

    const customFormLines = `
                  {/* ── Custom Item Entry (Edit TX) ── */}
                  <View style={{ marginBottom: 8 }}>
                    <Pressable
                      onPress={() => { setShowEditCustomProductForm(v => !v); setEditCustomProductName(''); setEditCustomProductPrice(''); setEditCustomProductQty('1'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6366f1', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 4 }}
                    >
                      <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 11 }}>{'\\u270F\\uFE0F ' + (showEditCustomProductForm ? 'Cancel Custom Item' : 'Add Custom Item')}</Text>
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
                            placeholder="Price (Rs)"
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

    lines.splice(insertIdx, 0, ...customFormLines.split('\n'));
    mob = lines.join('\n');
    console.log(`Edit TX custom form inserted at line ${insertIdx}`);
} else {
    console.log('Edit TX custom form already present.');
}

// Check if YG custom forms already added
if (!mob.includes('Custom Item Entry')) {
    console.error('You Gave / You Got custom forms missing'); process.exit(1);
}

fs.writeFileSync(mobileFile, mob, 'utf8');
console.log('Mobile file saved successfully.');
