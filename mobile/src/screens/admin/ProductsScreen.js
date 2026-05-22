import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Image,
  Switch,
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

export default function ProductsScreen({ readOnly = false }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    unit: '',
    isVisible: true,
    image: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getProducts();
      let list = data.products || [];
      if (readOnly) list = list.filter((p) => p.isVisible);
      setProducts(list);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      description: '',
      price: '',
      unit: 'Pcs',
      isVisible: true,
      image: '',
    });
    setModalVisible(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: String(product.price || ''),
      unit: product.unit || 'Pcs',
      isVisible: product.isVisible ?? true,
      image: product.image || product.imageData || '',
    });
    setModalVisible(true);
  };

  const pickFormImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
    });
    if (result.canceled) return;
    const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
    setForm((f) => ({ ...f, image: base64 }));
  };

  const saveProduct = async () => {
    const priceNum = parseFloat(form.price);
    if (!form.name.trim() || isNaN(priceNum) || !form.unit.trim()) {
      Alert.alert('Validation Error', 'Please fill name, valid price, and unit.');
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: priceNum,
        unit: form.unit.trim(),
        isVisible: form.isVisible,
        image: form.image,
      };

      if (editingProduct) {
        await adminApi.updateProduct(editingProduct._id, payload);
        Alert.alert('Success', 'Product updated successfully.');
      } else {
        await adminApi.createProduct(payload);
        Alert.alert('Success', 'Product created successfully.');
      }
      setModalVisible(false);
      load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save product.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (product) => {
    Alert.alert(
      'Delete Product?',
      `Are you sure you want to permanently delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await adminApi.deleteProduct(product._id);
              Alert.alert('Success', 'Product deleted.');
              load();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete product.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const toggleVisibility = async (product, val) => {
    try {
      await adminApi.toggleProductVisibility(product._id, val);
      setProducts((list) =>
        list.map((p) => (p._id === product._id ? { ...p, isVisible: val } : p))
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update visibility.');
    }
  };

  if (loading && products.length === 0) return <Loading />;

  return (
    <View style={styles.container}>
      {!readOnly && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Products ({products.length})</Text>
          <Pressable style={styles.addBtn} onPress={openAddModal}>
            <Text style={styles.addBtnText}>+ Add Material</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={products}
        keyExtractor={(p) => p._id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.image || item.imageData ? (
              <Image source={{ uri: item.image || item.imageData }} style={styles.img} />
            ) : (
              <View style={[styles.img, styles.placeholder]}>
                <Text style={styles.brickEmoji}>🧱</Text>
              </View>
            )}
            <View style={styles.info}>
              <View style={styles.rowBetween}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.price}>₹{item.price} / {item.unit}</Text>
              </View>
              <Text style={styles.desc} numberOfLines={2}>
                {item.description || 'No description provided.'}
              </Text>
              
              {!readOnly && (
                <View style={styles.adminActions}>
                  <View style={styles.visRow}>
                    <Text style={styles.visText}>Visible</Text>
                    <Switch
                      value={item.isVisible}
                      onValueChange={(val) => toggleVisibility(item, val)}
                      trackColor={{ false: '#ccc', true: colors.primary }}
                    />
                  </View>
                  
                  <View style={styles.btnRow}>
                    <Pressable style={styles.editBtn} onPress={() => openEditModal(item)}>
                      <Text style={styles.btnText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.empty}>No products available.</Text>
          </View>
        }
      />

      {/* Premium Product Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Modify Material' : 'Add Construction Material'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBox}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <Pressable style={styles.imageSelector} onPress={pickFormImage}>
                {form.image ? (
                  <Image source={{ uri: form.image }} style={styles.formImg} />
                ) : (
                  <View style={styles.formImgPlaceholder}>
                    <Text style={styles.cameraIcon}>📸</Text>
                    <Text style={styles.imageSelText}>Select Material Image</Text>
                  </View>
                )}
              </Pressable>

              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. M-Sand, 20mm Jelly"
              />

              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                keyboardType="decimal-pad"
                placeholder="e.g. 4500"
              />

              <Text style={styles.label}>Billing Unit *</Text>
              <TextInput
                style={styles.input}
                value={form.unit}
                onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))}
                placeholder="e.g. Brass, Unit, Pcs, Bag"
              />

              <Text style={styles.label}>Material Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Describe material grade, source, or quality details..."
                multiline
                numberOfLines={3}
              />

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Make Visible</Text>
                  <Text style={styles.switchSub}>Show this product in customer catalog</Text>
                </View>
                <Switch
                  value={form.isVisible}
                  onValueChange={(val) => setForm((f) => ({ ...f, isVisible: val }))}
                  trackColor={{ false: '#ccc', true: colors.primary }}
                />
              </View>

              <Pressable
                style={[styles.saveBtn, formLoading && styles.disabled]}
                onPress={saveProduct}
                disabled={formLoading}
              >
                <Text style={styles.saveBtnText}>
                  {formLoading ? 'Saving changes...' : editingProduct ? 'Save Modifications' : 'Create Product Listing'}
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
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginBottom: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  img: { width: 105, height: '100%', minHeight: 110, backgroundColor: '#eee' },
  placeholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e9ecef' },
  brickEmoji: { fontSize: 32 },
  info: { flex: 1, padding: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '800', fontSize: 16, color: colors.text, flex: 1, marginRight: 8 },
  price: { fontWeight: '700', color: colors.primary, fontSize: 14 },
  desc: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  adminActions: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 8 },
  editBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  deleteBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 16 },
  
  // Modal Overlay Styles
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
  imageSelector: {
    alignSelf: 'center',
    width: '100%',
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.background,
  },
  formImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  formImgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraIcon: { fontSize: 28, marginBottom: 6 },
  imageSelText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
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
  switchLabel: { fontWeight: '700', fontSize: 14, color: colors.text },
  switchSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
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
