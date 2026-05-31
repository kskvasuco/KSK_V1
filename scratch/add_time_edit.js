const fs = require('fs');
const path = require('path');

// 1. Process client/src/admin/CustomerLedger.jsx
const webFile = path.join(__dirname, '..', 'client', 'src', 'admin', 'CustomerLedger.jsx');
if (fs.existsSync(webFile)) {
    console.log('Processing web file:', webFile);
    let content = fs.readFileSync(webFile, 'utf8');

    const targetDateSetter = "setEditTxDate(tx.date ? tx.date.split('T')[0] : '');";
    const replacementDateSetter = `const toLocalISOString = (dateObj) => {
            const tzOffset = dateObj.getTimezoneOffset() * 60000;
            return (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
        };
        setEditTxDate(tx.date ? toLocalISOString(new Date(tx.date)) : '');`;

    const targetInputDiv = `<div style={formGroupStyle}>
                                <label style={formLabelStyle}>Transaction Date *</label>
                                <input
                                    type="date"
                                    style={formInputStyle}
                                    value={editTxDate}
                                    onChange={e => setEditTxDate(e.target.value)}
                                    required
                                    disabled={editTx?.deleteRequest?.status === 'pending'}
                                />
                            </div>`;
    const replacementInputDiv = `<div style={formGroupStyle}>
                                <label style={formLabelStyle}>Transaction Date & Time *</label>
                                <input
                                    type="datetime-local"
                                    style={formInputStyle}
                                    value={editTxDate}
                                    onChange={e => setEditTxDate(e.target.value)}
                                    required
                                    disabled={editTx?.deleteRequest?.status === 'pending'}
                                />
                            </div>`;

    if (content.includes(targetDateSetter) && content.includes(targetInputDiv)) {
        content = content.replace(targetDateSetter, replacementDateSetter);
        content = content.replace(targetInputDiv, replacementInputDiv);
        fs.writeFileSync(webFile, content, 'utf8');
        console.log('Web file updated successfully.');
    } else {
        console.error('Target strings not found in web file.');
    }
} else {
    console.error('Web file not found:', webFile);
}

// 2. Process mobile/src/screens/admin/CustomerLedgerScreen.js
const mobileFile = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'admin', 'CustomerLedgerScreen.js');
if (fs.existsSync(mobileFile)) {
    console.log('Processing mobile file:', mobileFile);
    let content = fs.readFileSync(mobileFile, 'utf8');

    const targetState = "  const [showEditDatePicker, setShowEditDatePicker] = useState(false);";
    const replacementState = "  const [showEditDatePicker, setShowEditDatePicker] = useState(false);\n  const [showEditTimePicker, setShowEditTimePicker] = useState(false);";

    const targetPickerGroup = `              <Text style={styles.formLabel}>Transaction Date</Text>
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
              )}`;

    const replacementPickerGroup = `              <Text style={styles.formLabel}>Transaction Date</Text>
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
                    if (date) {
                      const newDate = new Date(editTxDate || new Date());
                      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setEditTxDate(newDate);
                    }
                  }}
                />
              )}

              <Text style={styles.formLabel}>Transaction Time</Text>
              <Pressable 
                style={[styles.formInput, { justifyContent: 'center', minHeight: 45, marginBottom: 15 }]}
                onPress={() => setShowEditTimePicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {editTxDate ? editTxDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                </Text>
              </Pressable>

              {showEditTimePicker && (
                <DateTimePicker
                  value={editTxDate || new Date()}
                  mode="time"
                  display="default"
                  onChange={(event, time) => {
                    setShowEditTimePicker(false);
                    if (time) {
                      const newDate = new Date(editTxDate || new Date());
                      newDate.setHours(time.getHours(), time.getMinutes());
                      setEditTxDate(newDate);
                    }
                  }}
                />
              )}`;

    if (content.includes(targetState) && content.includes(targetPickerGroup)) {
        content = content.replace(targetState, replacementState);
        content = content.replace(targetPickerGroup, replacementPickerGroup);
        fs.writeFileSync(mobileFile, content, 'utf8');
        console.log('Mobile file updated successfully.');
    } else {
        console.error('Target strings not found in mobile file.');
    }
} else {
    console.error('Mobile file not found:', mobileFile);
}
