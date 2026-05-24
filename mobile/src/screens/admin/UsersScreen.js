import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';

const ALLOWED_LOCATIONS = {
  "Erode": ["Erode", "Modakkurichi", "Kodumudi", "Perundurai", "Bhavani", "Anthiyur", "Gobichettipalayam", "Sathyamangalam", "Nambiyur", "Thalavadi"],
  "Coimbatore": ["Coimbatore (North)", "Coimbatore (South)", "Mettupalayam", "Pollachi", "Valparai", "Sulur", "Annur", "Kinathukadavu", "Madukkarai", "Perur", "Anaimalai"],
  "Thirupur": ["Tiruppur (North)", "Tiruppur (South)", "Avinashi", "Palladam", "Dharapuram", "Kangayam", "Madathukulam", "Udumalaipettai", "Uthukuli"],
  "Namakal": ["Namakkal", "Rasipuram", "Tiruchengode", "Paramathi-Velur", "Kolli Hills", "Sendamangalam", "Kumarapalayam", "Mohanur"],
  "Salam": ["Salem", "Salem (West)", "Salem (South)", "Attur", "Edappadi", "Gangavalli", "Mettur", "Omalur", "Sankagiri", "Valapady", "Yercaud"]
};

export default function UsersScreen({ route }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    altMobile: '',
    email: '',
    district: 'Erode',
    taluk: 'Erode',
    pincode: '',
    address: '',
    isRateRequestEnabled: true,
  });
  const [formLoading, setFormLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAllUsers();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load user registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (route?.params?.openCreate) {
      openAddModal();
    }
  }, [route?.params?.openCreate]);

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const name = (u.name || '').toLowerCase();
    const mobile = (u.mobile || '');
    const district = (u.district || '').toLowerCase();
    const taluk = (u.taluk || '').toLowerCase();
    return name.includes(q) || mobile.includes(q) || district.includes(q) || taluk.includes(q);
  });

  const openAddModal = () => {
    setEditingUser(null);
    setForm({
      name: '',
      mobile: '',
      altMobile: '',
      email: '',
      district: 'Erode',
      taluk: 'Erode',
      pincode: '',
      address: '',
      isRateRequestEnabled: true,
    });
    setModalVisible(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    const dist = Object.keys(ALLOWED_LOCATIONS).includes(user.district) ? user.district : 'Erode';
    const taluks = ALLOWED_LOCATIONS[dist];
    const tlk = taluks.includes(user.taluk) ? user.taluk : taluks[0];

    setForm({
      name: user.name || '',
      mobile: user.mobile || '',
      altMobile: user.altMobile || '',
      email: user.email || '',
      district: dist,
      taluk: tlk,
      pincode: user.pincode || '',
      address: user.address || '',
      isRateRequestEnabled: user.isRateRequestEnabled ?? true,
    });
    setModalVisible(true);
  };

  const handleDistrictChange = (dist) => {
    const taluks = ALLOWED_LOCATIONS[dist] || [];
    setForm((f) => ({
      ...f,
      district: dist,
      taluk: taluks[0] || '',
    }));
  };

  const saveUser = async () => {
    if (!form.name.trim() || !form.mobile.trim()) {
      Alert.alert('Validation Error', 'Please enter Name and Mobile number.');
      return;
    }
    if (!/^\d{10}$/.test(form.mobile.trim())) {
      Alert.alert('Validation Error', 'Mobile number must be exactly 10 digits.');
      return;
    }
    if (form.altMobile.trim() && !/^\d{10}$/.test(form.altMobile.trim())) {
      Alert.alert('Validation Error', 'Alternative mobile must be 10 digits.');
      return;
    }
    if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) {
      Alert.alert('Validation Error', 'Pincode must be exactly 6 digits.');
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        altMobile: form.altMobile.trim(),
        email: form.email.trim(),
        district: form.district,
        taluk: form.taluk,
        pincode: form.pincode.trim(),
        address: form.address.trim(),
        isRateRequestEnabled: form.isRateRequestEnabled,
      };

      if (editingUser) {
        await adminApi.updateUser(editingUser._id, payload);
        Alert.alert('Success', 'User profile updated successfully.');
      } else {
        await adminApi.createUser(payload);
        Alert.alert('Success', 'User account registered successfully.');
      }
      setModalVisible(false);
      load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save customer account.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleBlock = (user) => {
    Alert.alert(
      user.isBlocked ? 'Unblock User?' : 'Block User?',
      `Are you sure you want to ${user.isBlocked ? 'unblock' : 'block'} "${user.name || user.mobile}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          style: user.isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await adminApi.blockUser(user._id, !user.isBlocked);
              Alert.alert('Success', `User ${user.isBlocked ? 'unblocked' : 'blocked'}.`);
              load();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to update user block status.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (user) => {
    Alert.alert(
      'Permanently Delete Account?',
      `This will completely delete the customer profile for "${user.name || user.mobile}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await adminApi.deleteUser(user._id);
              Alert.alert('Success', 'User deleted successfully.');
              load();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete user.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddToLedger = (user) => {
    Alert.alert(
      'Add to Digital Ledger',
      `Add "${user.name || user.mobile}" to the digital ledger. Choose the account role:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'As Customer',
          onPress: () => performAddToLedger(user._id, 'Customer', user.name),
        },
        {
          text: 'As Supplier',
          onPress: () => performAddToLedger(user._id, 'Supplier', user.name),
        },
      ]
    );
  };

  const performAddToLedger = async (userId, ledgerType, name) => {
    try {
      setLoading(true);
      await adminApi.addToLedger(userId, ledgerType);
      Alert.alert('Success', `Successfully registered "${name}" to ledger as a ${ledgerType}.`);
      load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to add user to ledger.');
      setLoading(false);
    }
  };

  if (loading && users.length === 0) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.headerTitle}>User Registry ({filteredUsers.length})</Text>
          <Pressable style={styles.addBtn} onPress={openAddModal}>
            <Text style={styles.addBtnText}>+ Add Customer</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.searchBar}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="🔍 Search users by name, mobile, district..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.empty}>No registered customers found.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.titleCol}>
                <Text style={styles.cardName}>{item.name || 'Anonymous Customer'}</Text>
                <Text style={styles.cardPhone}>📞 {item.mobile}</Text>
                {item.altMobile ? <Text style={styles.cardSubText}>Alt: {item.altMobile}</Text> : null}
                {item.email ? <Text style={styles.cardSubText}>✉️ {item.email}</Text> : null}
              </View>
              <View style={[
                styles.badge, 
                { backgroundColor: item.isBlocked ? colors.lightRed : colors.lightGreen }
              ]}>
                <Text style={[
                  styles.badgeText, 
                  { color: item.isBlocked ? colors.danger : colors.success }
                ]}>
                  {item.isBlocked ? 'Blocked' : 'Active'}
                </Text>
              </View>
            </View>

            <View style={styles.cardAddressBox}>
              <Text style={styles.locationTitle}>📍 Location details</Text>
              <View style={styles.locBadgeRow}>
                <View style={styles.locBadge}>
                  <Text style={styles.locBadgeText}>{item.district || 'No District'}</Text>
                </View>
                <View style={[styles.locBadge, { backgroundColor: '#eef2f3' }]}>
                  <Text style={[styles.locBadgeText, { color: '#475569' }]}>{item.taluk || 'No Taluk'}</Text>
                </View>
                {item.pincode ? (
                  <View style={[styles.locBadge, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[styles.locBadgeText, { color: '#d97706' }]}>{item.pincode}</Text>
                  </View>
                ) : null}
              </View>
              {item.address ? (
                <Text style={styles.fullAddressText} numberOfLines={2}>{item.address}</Text>
              ) : (
                <Text style={styles.noAddressText}>No physical address registered.</Text>
              )}
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.rateRequestOption}>
                <Text style={styles.rateRequestLabel}>Edit Rates:</Text>
                <Text style={[
                  styles.rateRequestValue, 
                  { color: item.isRateRequestEnabled !== false ? colors.success : colors.danger }
                ]}>
                  {item.isRateRequestEnabled !== false ? 'Allowed' : 'Disabled'}
                </Text>
              </View>
              <View style={styles.btnActions}>
                {!item.isAddedToLedger ? (
                  <Pressable style={styles.actionLedgerBtn} onPress={() => handleAddToLedger(item)}>
                    <Text style={styles.actionLedgerBtnText}>+ Ledger</Text>
                  </Pressable>
                ) : (
                  <View style={[styles.ledgerStatusBadge, { backgroundColor: item.ledgerType === 'Supplier' ? '#fef3c7' : '#dbeafe' }]}>
                    <Text style={[styles.ledgerStatusBadgeText, { color: item.ledgerType === 'Supplier' ? '#b45309' : '#1d4ed8' }]}>
                      {item.ledgerType || 'Customer'}
                    </Text>
                  </View>
                )}
                <Pressable style={styles.actionEditBtn} onPress={() => openEditModal(item)}>
                  <Text style={styles.actionEditBtnText}>Edit</Text>
                </Pressable>
                <Pressable 
                  style={[styles.actionBlockBtn, { backgroundColor: item.isBlocked ? colors.success : colors.warning }]} 
                  onPress={() => toggleBlock(item)}
                >
                  <Text style={styles.actionBlockBtnText}>{item.isBlocked ? 'Unblock' : 'Block'}</Text>
                </Pressable>
                <Pressable style={styles.actionDeleteBtn} onPress={() => handleDelete(item)}>
                  <Text style={styles.actionDeleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      {/* User Registration Form Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingUser ? 'Modify Customer Profile' : 'Register Customer Account'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBox}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. John Doe"
              />

              <Text style={styles.label}>10-Digit Mobile Number *</Text>
              <TextInput
                style={styles.input}
                value={form.mobile}
                onChangeText={(v) => setForm((f) => ({ ...f, mobile: v }))}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="e.g. 9876543210"
              />

              <Text style={styles.label}>Alternative Mobile (Optional)</Text>
              <TextInput
                style={styles.input}
                value={form.altMobile}
                onChangeText={(v) => setForm((f) => ({ ...f, altMobile: v }))}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="e.g. 9988776655"
              />

              <Text style={styles.label}>Email Address (Optional)</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="e.g. john@example.com"
              />

              <View style={styles.pickerRow}>
                <View style={styles.pickerCol}>
                  <Text style={styles.label}>District *</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={form.district}
                      onValueChange={(itemValue) => handleDistrictChange(itemValue)}
                      style={styles.picker}
                      dropdownIconColor={colors.primary}
                    >
                      {Object.keys(ALLOWED_LOCATIONS).map((dist) => (
                        <Picker.Item key={dist} label={dist} value={dist} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.pickerCol}>
                  <Text style={styles.label}>Taluk *</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={form.taluk}
                      onValueChange={(itemValue) => setForm((f) => ({ ...f, taluk: itemValue }))}
                      style={styles.picker}
                      dropdownIconColor={colors.primary}
                    >
                      {(ALLOWED_LOCATIONS[form.district] || []).map((taluk) => (
                        <Picker.Item key={taluk} label={taluk} value={taluk} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Pincode</Text>
              <TextInput
                style={styles.input}
                value={form.pincode}
                onChangeText={(v) => setForm((f) => ({ ...f, pincode: v }))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="e.g. 638001"
              />

              <Text style={styles.label}>Physical Address Details</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="Enter plot details, street address, and landmarks..."
                multiline
                numberOfLines={3}
              />

              <View style={styles.switchRow}>
                <View style={styles.switchTextCol}>
                  <Text style={styles.switchLabel}>Allow Custom Material Rates</Text>
                  <Text style={styles.switchSub}>Allow user to request rates, or admin to alter item prices manually</Text>
                </View>
                <Switch
                  value={form.isRateRequestEnabled}
                  onValueChange={(val) => setForm((f) => ({ ...f, isRateRequestEnabled: val }))}
                  trackColor={{ false: '#ccc', true: colors.primary }}
                />
              </View>

              <Pressable
                style={[styles.saveBtn, formLoading && styles.disabled]}
                onPress={saveUser}
                disabled={formLoading}
              >
                <Text style={styles.saveBtnText}>
                  {formLoading ? 'Saving changes...' : editingUser ? 'Modify User Profile' : 'Register Customer'}
                </Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    ...shadows.sm,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: colors.background,
    color: colors.text,
  },
  listContainer: { padding: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.sm,
  },
  titleCol: { flex: 1, gap: 2 },
  cardName: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardPhone: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 2 },
  cardSubText: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardAddressBox: {
    marginVertical: spacing.sm,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  locationTitle: { fontSize: 11, fontWeight: '800', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
  locBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  locBadge: {
    backgroundColor: '#ebf5fb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  locBadgeText: { fontSize: 10, fontWeight: '700', color: '#2980b9' },
  fullAddressText: { fontSize: 12, color: colors.text, lineHeight: 16 },
  noAddressText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: 2,
  },
  rateRequestOption: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateRequestLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  rateRequestValue: { fontSize: 12, fontWeight: '700' },
  btnActions: { flexDirection: 'row', gap: 8 },
  actionEditBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionEditBtnText: { color: colors.primary, fontWeight: '700', fontSize: 11 },
  actionBlockBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionBlockBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  actionDeleteBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionDeleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 16 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  closeBox: { padding: 4 },
  closeText: { fontSize: 18, color: colors.textMuted, fontWeight: '700' },
  formContainer: { padding: spacing.lg },
  label: { fontWeight: '700', fontSize: 13, color: colors.text, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  textArea: { height: 75, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.sm },
  pickerCol: { flex: 1 },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  picker: {
    height: 48,
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  switchTextCol: { flex: 1, paddingRight: 8 },
  switchLabel: { fontWeight: '700', fontSize: 14, color: colors.text },
  switchSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 14 },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
  actionLedgerBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionLedgerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  ledgerStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ledgerStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
