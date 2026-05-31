const fs = require('fs');
const path = require('path');

const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
let mob = fs.readFileSync(mobileFile, 'utf8');

const customFormYG = `
                  {/* ── Custom Item Entry ── */}
                  <View style={{ marginBottom: 8 }}>
                    <Pressable
                      onPress={() => { setShowCustomProductForm(v => !v); setCustomProductName(''); setCustomProductPrice(''); setCustomProductQty('1'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6366f1', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 4 }}
                    >
                      <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 12 }}>{showCustomProductForm ? 'Cancel Custom Item' : '+ Add Custom Item'}</Text>
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
                            placeholder="Price"
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

// Insert after each </View> (dropdownWrapper close) before {selectedProducts.length > 0 ?
// There are exactly 2 such occurrences (You Gave + You Got)
const lines = mob.split('\n');
let inserted = 0;
const newLines = [];
for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);
    // After a </View> line, if next non-empty line contains `{selectedProducts.length > 0 ? (`
    // and we haven't already inserted for this block
    if (lines[i].trim() === '</View>' && inserted < 2) {
        // Peek ahead: skip blank lines to see if next content is selectedProducts check
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') { j++; }
        if (j < lines.length && lines[j].includes('{selectedProducts.length > 0 ? (')) {
            // Check: preceded by </Picker> within 10 lines back
            let hasPicker = false;
            for (let k = Math.max(0, i - 10); k < i; k++) {
                if (lines[k].includes('</Picker>')) { hasPicker = true; break; }
            }
            if (hasPicker) {
                // Only add if not already inserted here
                if (!newLines.some(l => l.includes('Custom Item Entry'))) {
                    // push the blank line that was already added for line[i], then insert form
                }
                // Insert the form lines
                customFormYG.split('\n').forEach(l => newLines.push(l));
                inserted++;
                console.log(`Inserted YG custom form at line ${i} (insertion #${inserted})`);
            }
        }
    }
}

if (inserted < 2) {
    console.error(`Only inserted ${inserted} YG custom forms, expected 2`);
    process.exit(1);
}

mob = newLines.join('\n');
fs.writeFileSync(mobileFile, mob, 'utf8');
console.log('Mobile You Gave/You Got custom forms inserted successfully.');
