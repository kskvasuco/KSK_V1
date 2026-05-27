import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Image,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';

export default function PaymentSettingsScreen() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'bank', // 'primary' or 'bank'
    accountName: '',
    bankName: '',
    accountNumber: '',
    ifsc: '',
    qrCode: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getPaymentSettings();
      setSettings(Array.isArray(data) ? data : [data].filter(Boolean));
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load payment configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const openAddModal = () => {
    setEditingSetting(null);
    setForm({
      name: '',
      type: 'bank',
      accountName: '',
      bankName: '',
      accountNumber: '',
      ifsc: '',
      qrCode: '',
    });
    setModalVisible(true);
  };

  const openEditModal = (setting) => {
    setEditingSetting(setting);
    setForm({
      name: setting.name || '',
      type: setting.type || 'bank',
      accountName: setting.accountName || '',
      bankName: setting.bankName || '',
      accountNumber: setting.accountNumber || '',
      ifsc: setting.ifsc || '',
      qrCode: setting.qrCode || '',
    });
    setModalVisible(true);
  };

  const pickQrImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to select QR code.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
    });
    if (result.canceled) return;
    const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
    setForm((f) => ({ ...f, qrCode: base64 }));
  };

  const saveSetting = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name (e.g. GPay, HDFC Bank).');
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        name: form.name.trim(),
        type: form.type,
        accountName: form.accountName.trim(),
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        ifsc: form.ifsc.trim(),
        qrCode: form.type === 'primary' ? form.qrCode : '',
      };

      if (editingSetting) {
        await adminApi.updatePaymentSetting(editingSetting._id, payload);
        Alert.alert('Success', 'Payment gateway updated.');
      } else {
        await adminApi.createPaymentSetting(payload);
        Alert.alert('Success', 'Payment gateway configured.');
      }
      setModalVisible(false);
      loadSettings();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save configuration.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (setting) => {
    Alert.alert(
      'Delete Gateway?',
      `Are you sure you want to delete "${setting.name || 'Payment Details'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await adminApi.deletePaymentSetting(setting._id);
              Alert.alert('Success', 'Configuration deleted.');
              loadSettings();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete configuration.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading && settings.length === 0) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gateways ({settings.length})</Text>
        <Pressable style={styles.addBtn} onPress={openAddModal}>
          <Text style={styles.addBtnText}>+ Add Gateway</Text>
        </Pressable>
      </View>

      <FlatList
        data={settings}
        keyExtractor={(item) => item._id || String(Math.random())}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💳</Text>
            <Text style={styles.empty}>No payment gateways configured yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.titleCol}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={[
                  styles.badge, 
                  { backgroundColor: item.type === 'primary' ? colors.lightInfo : colors.lightPurple }
                ]}>
                  <Text style={[
                    styles.badgeText, 
                    { color: item.type === 'primary' ? colors.info : colors.purple }
                  ]}>
                    {item.type === 'primary' ? 'UPI / QR CODE' : 'BANK DEPOSIT'}
                  </Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable style={styles.iconBtn} onPress={() => openEditModal(item)}>
                  <Text style={styles.editIcon}>✏️</Text>
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.cardContent}>
              {item.accountName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Acc Holder:</Text>
                  <Text style={styles.detailValue}>{item.accountName}</Text>
                </View>
              ) : null}

              {item.type === 'bank' ? (
                <>
                  {item.bankName ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Bank:</Text>
                      <Text style={styles.detailValue}>{item.bankName}</Text>
                    </View>
                  ) : null}
                  {item.accountNumber ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>A/C No:</Text>
                      <Text style={styles.detailValue}>{item.accountNumber}</Text>
                    </View>
                  ) : null}
                  {item.ifsc ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>IFSC Code:</Text>
                      <Text style={styles.detailValue}>{item.ifsc}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  {item.accountNumber ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>UPI ID:</Text>
                      <Text style={styles.detailValue}>{item.accountNumber}</Text>
                    </View>
                  ) : null}
                  {item.qrCode ? (
                    <Image source={{ uri: item.qrCode }} style={styles.qrImage} />
                  ) : (
                    <View style={styles.noQrBox}>
                      <Text style={styles.noQrText}>No QR Code Uploaded</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}
      />

      {/* Gateway Form Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingSetting ? 'Modify Gateway' : 'Add Payment Gateway'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBox}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={styles.label}>Gateway Type *</Text>
              <View style={styles.tabRow}>
                <Pressable
                  style={[styles.tabBtn, form.type === 'bank' && styles.tabActive]}
                  onPress={() => setForm((f) => ({ ...f, type: 'bank' }))}
                >
                  <Text style={[styles.tabText, form.type === 'bank' && styles.tabTextActive]}>
                    🏦 Bank Deposit
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.tabBtn, form.type === 'primary' && styles.tabActive]}
                  onPress={() => setForm((f) => ({ ...f, type: 'primary' }))}
                >
                  <Text style={[styles.tabText, form.type === 'primary' && styles.tabTextActive]}>
                    📱 UPI / QR Code
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Gateway Name * (e.g. SBI Bank, GPay Account)</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Name"
              />

              <Text style={styles.label}>Account / Display Holder Name</Text>
              <TextInput
                style={styles.input}
                value={form.accountName}
                onChangeText={(v) => setForm((f) => ({ ...f, accountName: v }))}
                placeholder="Account Holder Name"
              />

              {form.type === 'bank' ? (
                <>
                  <Text style={styles.label}>Bank Name</Text>
                  <TextInput
                    style={styles.input}
                    value={form.bankName}
                    onChangeText={(v) => setForm((f) => ({ ...f, bankName: v }))}
                    placeholder="Bank Name"
                  />

                  <Text style={styles.label}>Account Number</Text>
                  <TextInput
                    style={styles.input}
                    value={form.accountNumber}
                    onChangeText={(v) => setForm((f) => ({ ...f, accountNumber: v }))}
                    keyboardType="number-pad"
                    placeholder="Account Number"
                  />

                  <Text style={styles.label}>IFSC Code</Text>
                  <TextInput
                    style={styles.input}
                    value={form.ifsc}
                    onChangeText={(v) => setForm((f) => ({ ...f, ifsc: v }))}
                    autoCapitalize="characters"
                    placeholder="IFSC Code"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.label}>UPI ID / Mobile Pay Address</Text>
                  <TextInput
                    style={styles.input}
                    value={form.accountNumber}
                    onChangeText={(v) => setForm((f) => ({ ...f, accountNumber: v }))}
                    autoCapitalize="none"
                    placeholder="e.g. ksk@oksbi or 9876543210@upl"
                  />

                  <Text style={styles.label}>QR Code Image</Text>
                  <Pressable style={styles.qrSelector} onPress={pickQrImage}>
                    {form.qrCode ? (
                      <Image source={{ uri: form.qrCode }} style={styles.formQrImg} />
                    ) : (
                      <View style={styles.qrPlaceholder}>
                        <Text style={styles.qrIcon}>📷</Text>
                        <Text style={styles.qrSelText}>Upload QR Code Image</Text>
                      </View>
                    )}
                  </Pressable>
                </>
              )}

              <Pressable
                style={[styles.saveBtn, formLoading && styles.disabled]}
                onPress={saveSetting}
                disabled={formLoading}
              >
                <Text style={styles.saveBtnText}>
                  {formLoading ? 'Saving...' : editingSetting ? 'Save Configurations' : 'Setup Gateway'}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
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
  listContainer: { padding: spacing.md },
  card: {
    backgroundColor: colors.card,
    marginBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleCol: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 12 },
  iconBtn: { padding: 4 },
  editIcon: { fontSize: 18 },
  deleteIcon: { fontSize: 18 },
  cardContent: { gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  detailValue: { fontSize: 13, color: colors.text, fontWeight: '700' },
  qrImage: {
    width: 130,
    height: 130,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noQrBox: {
    height: 60,
    backgroundColor: colors.background,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  noQrText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

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
    borderWidth: 1.5,
    borderColor: colors.border,
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
  tabRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
    marginTop: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lightWarning,
  },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  qrSelector: {
    alignSelf: 'center',
    width: '100%',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.background,
  },
  formQrImg: { width: '100%', height: '100%', resizeMode: 'contain' },
  qrPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrIcon: { fontSize: 26, marginBottom: 6 },
  qrSelText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
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
});
