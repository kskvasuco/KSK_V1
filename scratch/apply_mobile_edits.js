const fs = require('fs');

const filePath = 'mobile/src/screens/admin/CustomerLedgerScreen.js';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF
content = content.replace(/\r\n/g, '\n');

// Helper to replace LF target strings
function safeReplace(target, replacement) {
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    return true;
  }
  return false;
}

// 1. Add States
const stateTarget = `  // Form Inputs
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');`;

const stateReplacement = `  // Form Inputs
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [editTxDate, setEditTxDate] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // Recycle Bin States
  const [isRecycleBinVisible, setIsRecycleBinVisible] = useState(false);
  const [recycleBinTxns, setRecycleBinTxns] = useState([]);
  const [recycleBinLoading, setRecycleBinLoading] = useState(false);`;

if (safeReplace(stateTarget, stateReplacement)) {
  console.log('1. Added states');
} else {
  console.log('Error: stateTarget not found!');
}

// 2. Update openEditTransaction
const openEditTarget = `  const openEditTransaction = async (tx) => {
    setEditTx(tx);
    setEditTxAmount(String(tx.amount || ''));
    setEditTxDescription(tx.description || '');`;

const openEditReplacement = `  const openEditTransaction = async (tx) => {
    setEditTx(tx);
    setEditTxAmount(String(tx.amount || ''));
    setEditTxDescription(tx.description || '');
    setEditTxDate(tx.date ? new Date(tx.date) : new Date());`;

if (safeReplace(openEditTarget, openEditReplacement)) {
  console.log('2. Updated openEditTransaction');
} else {
  console.log('Error: openEditTarget not found!');
}

// 3. Update handleSaveTransaction
const saveTarget = `      await adminApi.updateLedgerTransaction(editTx._id, {
        amount: numAmount,
        description: finalDescription,
        productItems: productItems.length > 0 ? productItems : undefined,
      });`;

const saveReplacement = `      await adminApi.updateLedgerTransaction(editTx._id, {
        amount: numAmount,
        description: finalDescription,
        date: editTxDate ? editTxDate.toISOString() : undefined,
        productItems: productItems.length > 0 ? productItems : undefined,
      });`;

if (safeReplace(saveTarget, saveReplacement)) {
  console.log('3. Updated handleSaveTransaction');
} else {
  console.log('Error: saveTarget not found!');
}

// 4. Add Date input in Edit modal
const editModalBodyTarget = `              <Text style={styles.formLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={editTxAmount}`;

const editModalBodyReplacement = `              <Text style={styles.formLabel}>Transaction Date</Text>
              <Pressable 
                style={[styles.formInput, { justifyContent: 'center', minHeight: 45, marginBottom: 15 }]}
                onPress={() => setShowEditDatePicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {formatToDMY(editTxDate)}
                </Text>
              </Pressable>

              {showEditDatePicker && (
                <DateTimePicker
                  value={editTxDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowEditDatePicker(false);
                    if (date) setEditTxDate(date);
                  }}
                />
              )}

              <Text style={styles.formLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={editTxAmount}`;

if (safeReplace(editModalBodyTarget, editModalBodyReplacement)) {
  console.log('4. Added Date field in Edit Modal');
} else {
  console.log('Error: editModalBodyTarget not found!');
}

// 5. Add Recycle Bin actions above renderHeader
const headerTarget = `  const renderHeader = () => {`;
const headerReplacement = `  const openRecycleBin = async () => {
    setIsRecycleBinVisible(true);
    setRecycleBinLoading(true);
    try {
      const data = await adminApi.getRecycleBin(userId);
      setRecycleBinTxns(data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load recycle bin.');
    } finally {
      setRecycleBinLoading(false);
    }
  };

  const handleRestoreTransaction = async (txId) => {
    Alert.alert(
      'Restore Entry?',
      'Are you sure you want to restore this statement back to the active ledger? Outstanding balances will be recalculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              await adminApi.revertRecycleBin(txId);
              Alert.alert('Success', 'Statement restored successfully.');
              await fetchLedger();
              const bin = await adminApi.getRecycleBin(userId);
              setRecycleBinTxns(bin || []);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to restore transaction.');
            }
          }
        }
      ]
    );
  };

  const handlePermanentDeleteTransaction = async (txId) => {
    Alert.alert(
      'PERMANENTLY DELETE?',
      'This action CANNOT be undone. This statement will be permanently erased from the database. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.permanentDeleteRecycleBin(txId);
              Alert.alert('Success', 'Statement permanently deleted.');
              const bin = await adminApi.getRecycleBin(userId);
              setRecycleBinTxns(bin || []);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete transaction.');
            }
          }
        }
      ]
    );
  };

  const renderHeader = () => {`;

if (safeReplace(headerTarget, headerReplacement)) {
  console.log('5. Added Recycle Bin actions above renderHeader');
} else {
  console.log('Error: headerTarget not found!');
}

// 6. Add Recycle button in actionTabRow next to close balance
const tabTarget = `          <Pressable style={styles.actionTabItem} onPress={openCloseBalance}>
            <Ionicons name="lock-closed-outline" size={20} color="#dc2626" />
            <Text style={[styles.actionTabLabel, { color: '#dc2626' }]}>Close Bal</Text>
          </Pressable>
        </View>`;

const tabReplacement = `          <Pressable style={styles.actionTabItem} onPress={openCloseBalance}>
            <Ionicons name="lock-closed-outline" size={20} color="#dc2626" />
            <Text style={[styles.actionTabLabel, { color: '#dc2626' }]}>Close Bal</Text>
          </Pressable>
          <Pressable style={styles.actionTabItem} onPress={openRecycleBin}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={[styles.actionTabLabel, { color: colors.danger }]}>Recycle</Text>
          </Pressable>
        </View>`;

if (safeReplace(tabTarget, tabReplacement)) {
  console.log('6. Added Recycle Bin tab button');
} else {
  console.log('Error: tabTarget not found!');
}

// 7. Insert Recycle Bin modal markup
const modalClosingTarget = `    </Modal>
    </View>
  );
}`;

const recycleBinModalHtml = `    </Modal>

    {/* ═══════════════════════════════════════════
       MODAL: RECYCLE BIN
    ═══════════════════════════════════════════ */}
    <Modal visible={isRecycleBinVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <View style={[styles.modalTitleDot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.modalTitle, { color: colors.danger }]}>Recycle Bin</Text>
            </View>
            <Pressable style={styles.modalCloseBtn} onPress={() => setIsRecycleBinVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {recycleBinLoading ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.danger} />
              <Text style={{ marginTop: 10, color: colors.textMuted }}>Loading deleted statements...</Text>
            </View>
          ) : (
            <FlatList
              data={recycleBinTxns}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ padding: 15 }}
              ListEmptyComponent={() => (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>No deleted statements found.</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <View style={{
                  backgroundColor: colors.card,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  marginBottom: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: 'bold',
                        color: item.type === 'credit' ? colors.success : colors.danger,
                        backgroundColor: item.type === 'credit' ? '#ecfdf5' : '#fdf2f2',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        marginRight: 6
                      }}>
                        {item.type === 'credit' ? 'CREDIT' : 'DEBIT'}
                      </Text>
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text }}>
                        ₹{item.amount}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>
                      📅 {formatDateOnly(item.date)} • {formatTimeOnly(item.date)}
                    </Text>
                    {item.description ? (
                      <Text style={{ fontSize: 12, color: colors.text, marginBottom: 2 }}>
                        📝 {item.description}
                      </Text>
                    ) : null}
                    {item.skuLine ? (
                      <Text style={{ fontSize: 11, color: colors.primary }}>
                        🛍️ {formatSkuLine(item.skuLine)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      onPress={() => handleRestoreTransaction(item._id)}
                      style={{
                        backgroundColor: colors.success,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 6
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Restore</Text>
                    </Pressable>
                    {isAdmin && (
                      <Pressable
                        onPress={() => handlePermanentDeleteTransaction(item._id)}
                        style={{
                          backgroundColor: colors.danger,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 6
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
    </View>
  );
}`;

if (safeReplace(modalClosingTarget, recycleBinModalHtml)) {
  console.log('7. Added Recycle Bin Modal markup successfully!');
} else {
  console.log('Error: modalClosingTarget not found!');
}

// Write back updated file
fs.writeFileSync(filePath, content, 'utf8');
console.log('CustomerLedgerScreen.js edits completed!');
