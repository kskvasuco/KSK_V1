import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { formatPrice } from '../../utils/priceFormatter';
import { colors, shadows, spacing } from '../../theme';

function todayLocalDate() {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

export default function CreateOrderScreen({ isAdmin = true, navigation }) {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const userFormLoadingRef = useRef(false);

  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState({});

  const [searchUser, setSearchUser] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [orderDate, setOrderDate] = useState(todayLocalDate());

  const [customProductName, setCustomProductName] = useState('');
  const [customProductUnit, setCustomProductUnit] = useState('');
  const [customProductPrice, setCustomProductPrice] = useState('');
  const [customProductQty, setCustomProductQty] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [showHoldReasonModal, setShowHoldReasonModal] = useState(false);
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [userForm, setUserForm] = useState({
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

  const load = async () => {
    try {
      setLoading(true);
      const [usersRes, productsRes, locationsRes] = await Promise.all([
        adminApi.getAllUsers(),
        adminApi.getProducts(),
        adminApi.getLocations(),
      ]);
      setUsers(Array.isArray(usersRes) ? usersRes : usersRes.users || []);
      setProducts(productsRes.products || []);
      setLocations(locationsRes || {});
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load create-order data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchUser.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const mobile = String(u.mobile || '');
      return name.includes(q) || mobile.includes(q);
    });
  }, [users, searchUser]);

  const filteredProducts = useMemo(() => {
    const q = searchProduct.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (!p.isVisible) return false;
      if (!q) return true;
      return (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    });

    const cartProductIds = new Set(cart.map((it) => it.product._id));
    return [...filtered].sort((a, b) => {
      const aSelected = cartProductIds.has(a._id);
      const bSelected = cartProductIds.has(b._id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
  }, [products, searchProduct, cart]);

  const total = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        return sum + qty * price;
      }, 0),
    [cart]
  );

  const addProduct = (product) => {
    const limit = Number(product?.quantityLimit || 0);
    if (limit > 0 && 1 > limit) {
      Alert.alert('Limit exceeded', `You can only order up to ${limit} ${product?.unit || ''}.`);
      return;
    }
    setCart((prev) => {
      if (prev.some((it) => it.product._id === product._id)) return prev;
      return [...prev, { product, quantity: 1, price: Number(product.price || 0) }];
    });
  };

  const removeItem = (productId) => {
    setCart((prev) => prev.filter((it) => it.product._id !== productId));
  };

  const updateItem = (productId, field, value) => {
    setCart((prev) => {
      const current = prev.find((it) => it.product._id === productId);
      if (!current) return prev;

      if (field === 'quantity') {
        const parsed = value === '' ? '' : Number(value) || 0;
        const limit = Number(current.product?.quantityLimit || 0);
        if (parsed !== '' && limit > 0 && parsed > limit) {
          Alert.alert('Limit exceeded', `You can only order up to ${limit} ${current.product?.unit || ''}.`);
          return prev;
        }
      }

      return prev.map((it) => {
        if (it.product._id !== productId) return it;
        if (field === 'quantity') return { ...it, quantity: value === '' ? '' : Number(value) || 0 };
        if (field === 'price') return { ...it, price: value === '' ? '' : Number(value) || 0 };
        return it;
      });
    });
  };

  const addCustomItem = () => {
    if (!customProductName.trim() || !customProductPrice.trim()) {
      Alert.alert('Validation', 'Enter custom product name and price.');
      return;
    }

    const id = `custom_${Date.now()}`;
    const qtyVal = Number(customProductQty || 1) || 1;
    const priceVal = Number(customProductPrice || 0) || 0;

    setCart((prev) => [
      ...prev,
      {
        product: { _id: id, isCustom: true, name: customProductName.trim(), unit: customProductUnit.trim() },
        quantity: qtyVal,
        price: priceVal,
      },
    ]);

    setCustomProductName('');
    setCustomProductUnit('');
    setCustomProductPrice('');
    setCustomProductQty('');
  };

  const validateUser = () => {
    if (!userForm.name.trim() || !userForm.mobile.trim()) return 'Name and mobile are required.';
    if (!/^\d{10}$/.test(userForm.mobile.trim())) return 'Mobile number must be exactly 10 digits.';
    if (userForm.altMobile.trim() && !/^\d{10}$/.test(userForm.altMobile.trim())) return 'Alt mobile must be 10 digits.';
    if (userForm.pincode.trim() && !/^\d{6}$/.test(userForm.pincode.trim())) return 'Pincode must be 6 digits.';
    return null;
  };

  const createCustomer = async () => {
    if (userFormLoadingRef.current) return;
    const err = validateUser();
    if (err) {
      Alert.alert('Validation', err);
      return;
    }

    try {
      userFormLoadingRef.current = true;
      setUserFormLoading(true);
      const payload = {
        ...userForm,
        name: userForm.name.trim(),
        mobile: userForm.mobile.trim(),
        altMobile: userForm.altMobile.trim(),
        email: userForm.email.trim(),
        pincode: userForm.pincode.trim(),
        address: userForm.address.trim(),
      };
      const res = await adminApi.createUser(payload);
      const createdUser = res?.user;
      await load();
      if (createdUser?._id) setSelectedUser(createdUser);
      setShowUserModal(false);
      setStep(1);
      Alert.alert('Success', 'Customer created. You can select and continue.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create customer.');
    } finally {
      userFormLoadingRef.current = false;
      setUserFormLoading(false);
    }
  };

  const submitHoldOrder = async () => {
    if (submittingRef.current) return;
    if (!selectedUser?._id) {
      Alert.alert('Validation', 'Select a customer before creating the order.');
      return;
    }
    if (!cart.length) {
      Alert.alert('Validation', 'Add at least one item to cart.');
      return;
    }

    const invalid = cart.some((it) => !Number(it.quantity) || Number(it.quantity) <= 0 || Number(it.price) < 0);
    if (invalid) {
      Alert.alert('Validation', 'Each item must have quantity > 0 and valid price.');
      return;
    }
    const limitExceededItem = cart.find((it) => {
      if (it.product?.isCustom) return false;
      const limit = Number(it.product?.quantityLimit || 0);
      if (limit <= 0) return false;
      return Number(it.quantity) > limit;
    });
    if (limitExceededItem) {
      Alert.alert(
        'Limit exceeded',
        `You can only order up to ${limitExceededItem.product.quantityLimit} ${limitExceededItem.product.unit || ''}.`
      );
      return;
    }

    try {
      submittingRef.current = true;
      setSubmitting(true);
      const items = cart.map((it) => ({
        productId: it.product.isCustom ? null : it.product._id,
        quantity: Number(it.quantity),
        price: Number(it.price),
        isCustom: !!it.product.isCustom,
        name: it.product.isCustom ? it.product.name : undefined,
        unit: it.product.isCustom ? it.product.unit : undefined,
      }));

      await adminApi.createOrderForUserHold(
        selectedUser._id,
        items,
        orderDate,
        holdReason.trim()
      );

      Alert.alert('Success', 'Order created and placed on hold.');
      setHoldReason('');
      setCart([]);
      setSelectedUser(null);
      setSearchProduct('');
      setStep(1);
      navigation?.navigate('Pending');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to hold order.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const submitOrder = async () => {
    if (submittingRef.current) return;
    if (!selectedUser?._id) {
      Alert.alert('Validation', 'Select a customer before creating the order.');
      return;
    }
    if (!cart.length) {
      Alert.alert('Validation', 'Add at least one item to cart.');
      return;
    }

    const invalid = cart.some((it) => !Number(it.quantity) || Number(it.quantity) <= 0 || Number(it.price) < 0);
    if (invalid) {
      Alert.alert('Validation', 'Each item must have quantity > 0 and valid price.');
      return;
    }
    const limitExceededItem = cart.find((it) => {
      if (it.product?.isCustom) return false;
      const limit = Number(it.product?.quantityLimit || 0);
      if (limit <= 0) return false;
      return Number(it.quantity) > limit;
    });
    if (limitExceededItem) {
      Alert.alert(
        'Limit exceeded',
        `You can only order up to ${limitExceededItem.product.quantityLimit} ${limitExceededItem.product.unit || ''}.`
      );
      return;
    }

    try {
      submittingRef.current = true;
      setSubmitting(true);
      const items = cart.map((it) => ({
        productId: it.product.isCustom ? null : it.product._id,
        quantity: Number(it.quantity),
        price: Number(it.price),
        isCustom: !!it.product.isCustom,
        name: it.product.isCustom ? it.product.name : undefined,
        unit: it.product.isCustom ? it.product.unit : undefined,
      }));

      const hasPriceChange = cart.some(
        (it) => !it.product.isCustom && Number(it.price) !== Number(it.product.price)
      );

      if (!isAdmin && hasPriceChange) {
        await adminApi.createOrderForUserRateRequest(selectedUser._id, items, orderDate);
      } else {
        await adminApi.createOrderForUser(selectedUser._id, items, orderDate);
      }

      Alert.alert('Success', 'Order created successfully.');
      setCart([]);
      setSelectedUser(null);
      setSearchProduct('');
      setStep(1);
      navigation?.navigate('Pending');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create order.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  const districts = Object.keys(locations).sort();
  const taluks = (locations[userForm.district] || []).sort();

  return (
    <View style={styles.container}>
      <View style={styles.stepper}>
        {[1, 2, 3].map((s) => (
          <Pressable
            key={s}
            style={[styles.stepChip, step === s && styles.stepChipActive]}
            onPress={() => {
              if (s === 2 && !selectedUser) return;
              if (s === 3 && (!selectedUser || !cart.length)) return;
              setStep(s);
            }}
          >
            <Text style={[styles.stepText, step === s && styles.stepTextActive]}>
              {s === 1 ? 'Customer' : s === 2 ? 'Products' : 'Review'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>Customer: {selectedUser ? `${selectedUser.name || 'Customer'} (${selectedUser.mobile})` : 'Not selected'}</Text>
          <Text style={styles.summaryText}>Items: {cart.length}</Text>
          <Text style={styles.summaryText}>Total: Rs {formatPrice(total)}</Text>
        </View>

        {step === 1 && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.title}>Select Customer</Text>
              <Pressable style={styles.smallPrimaryBtn} onPress={() => setShowUserModal(true)}>
                <Text style={styles.btnText}>+ New Customer</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={searchUser}
              onChangeText={setSearchUser}
              placeholder="Search by name or mobile"
              placeholderTextColor={colors.textMuted}
            />
            <FlatList
              data={filteredUsers.slice(0, 40)}
              keyExtractor={(u) => u._id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.userRow, selectedUser?._id === item._id && styles.userRowActive]}
                  onPress={() => setSelectedUser(item)}
                >
                  <Text style={styles.userName}>{item.name || 'Customer'}</Text>
                  <Text style={styles.userMeta}>{item.mobile}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No customers found.</Text>}
            />
            <Pressable
              style={[styles.primaryBtn, !selectedUser && styles.disabled]}
              onPress={() => selectedUser && setStep(2)}
              disabled={!selectedUser}
            >
              <Text style={styles.btnText}>Continue to Products</Text>
            </Pressable>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.title}>Add Products</Text>
            <TextInput
              style={styles.input}
              value={searchProduct}
              onChangeText={setSearchProduct}
              placeholder="Search products by name or SKU"
              placeholderTextColor={colors.textMuted}
            />
            <FlatList
              data={filteredProducts.slice(0, 50)}
              keyExtractor={(p) => p._id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isSelected = cart.some((it) => it.product._id === item._id);
                return (
                  <Pressable
                    style={[styles.productRow, isSelected && styles.productRowSelected]}
                    onPress={() => {
                      if (isSelected) {
                        removeItem(item._id);
                      } else {
                        addProduct(item);
                      }
                    }}
                  >
                    {isSelected && (
                      <View style={styles.tickBadge}>
                        <Text style={styles.tickText}>✓</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{item.name}</Text>
                      <Text style={styles.userMeta}>SKU: {item.sku || 'N/A'}</Text>
                      {Number(item.quantityLimit || 0) > 0 ? (
                        <Text style={styles.limitText}>
                          Max: {item.quantityLimit} {item.unit || ''}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.price}>Rs {formatPrice(item.price)}</Text>
                  </Pressable>
                );
              }}
            />

            <View style={styles.customBox}>
              <Text style={styles.subtitle}>Add Custom Item</Text>
              <TextInput style={styles.input} value={customProductName} onChangeText={setCustomProductName} placeholder="Name" />
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.flex]} value={customProductQty} onChangeText={setCustomProductQty} placeholder="Qty" keyboardType="decimal-pad" />
                <TextInput style={[styles.input, styles.flex]} value={customProductPrice} onChangeText={setCustomProductPrice} placeholder="Price" keyboardType="decimal-pad" />
                <TextInput style={[styles.input, styles.flex]} value={customProductUnit} onChangeText={setCustomProductUnit} placeholder="Unit" />
              </View>
              <Pressable style={styles.secondaryBtn} onPress={addCustomItem}>
                <Text style={styles.btnText}>Add Custom Item</Text>
              </Pressable>
            </View>

            <View style={styles.row}>
              <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => setStep(1)}>
                <Text style={styles.btnText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, styles.flex, !cart.length && styles.disabled]}
                onPress={() => cart.length && setStep(3)}
                disabled={!cart.length}
              >
                <Text style={styles.btnText}>Review Order</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.title}>Review & Create</Text>
            <TextInput
              style={styles.input}
              value={orderDate}
              onChangeText={setOrderDate}
              placeholder="Order Date (YYYY-MM-DD)"
            />
            {cart.map((it) => (
              <View key={it.product._id} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{it.product.name}</Text>
                  {!it.product.isCustom ? (
                    <Text style={styles.userMeta}>Base: Rs {formatPrice(it.product.price)}</Text>
                  ) : null}
                </View>
                <TextInput
                  style={[styles.input, styles.qty]}
                  value={String(it.quantity)}
                  onChangeText={(v) => updateItem(it.product._id, 'quantity', v)}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.input, styles.priceInput]}
                  value={String(it.price)}
                  onChangeText={(v) => updateItem(it.product._id, 'price', v)}
                  keyboardType="decimal-pad"
                />
                <Pressable onPress={() => removeItem(it.product._id)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <Text style={styles.total}>Total: Rs {formatPrice(total)}</Text>

            <View style={styles.row}>
              <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => setStep(2)}>
                <Text style={styles.btnText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.flex, submitting && styles.disabled]} onPress={submitOrder} disabled={submitting}>
                <Text style={styles.btnText}>{submitting ? 'Creating...' : 'Create Order'}</Text>
              </Pressable>
              <Pressable style={[styles.holdBtn, styles.flex, submitting && styles.disabled]} onPress={() => setShowHoldReasonModal(true)} disabled={submitting}>
                <Text style={styles.holdBtnText}>Hold Order</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={showUserModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.title}>Create Customer</Text>
            <ScrollView>
              <TextInput style={styles.input} value={userForm.name} onChangeText={(v) => setUserForm((f) => ({ ...f, name: v }))} placeholder="Name *" />
              <TextInput style={styles.input} value={userForm.mobile} onChangeText={(v) => setUserForm((f) => ({ ...f, mobile: v }))} placeholder="Mobile *" keyboardType="phone-pad" maxLength={10} />
              <TextInput style={styles.input} value={userForm.altMobile} onChangeText={(v) => setUserForm((f) => ({ ...f, altMobile: v }))} placeholder="Alt Mobile" keyboardType="phone-pad" maxLength={10} />
              <TextInput style={styles.input} value={userForm.email} onChangeText={(v) => setUserForm((f) => ({ ...f, email: v }))} placeholder="Email" keyboardType="email-address" />
              <View style={styles.pickerWrap}>
                <Picker selectedValue={userForm.district} onValueChange={(v) => setUserForm((f) => ({ ...f, district: v, taluk: (locations[v] || [])[0] || '' }))}>
                  {districts.map((d) => (
                    <Picker.Item key={d} label={d} value={d} />
                  ))}
                </Picker>
              </View>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={userForm.taluk} onValueChange={(v) => setUserForm((f) => ({ ...f, taluk: v }))}>
                  {taluks.map((t) => (
                    <Picker.Item key={t} label={t} value={t} />
                  ))}
                </Picker>
              </View>
              <TextInput style={styles.input} value={userForm.pincode} onChangeText={(v) => setUserForm((f) => ({ ...f, pincode: v }))} placeholder="Pincode" keyboardType="number-pad" maxLength={6} />
              <TextInput style={[styles.input, styles.textArea]} value={userForm.address} onChangeText={(v) => setUserForm((f) => ({ ...f, address: v }))} placeholder="Address" multiline />
              <View style={styles.rowBetween}>
                <Text style={styles.userMeta}>Allow Rate Request</Text>
                <Switch value={userForm.isRateRequestEnabled} onValueChange={(v) => setUserForm((f) => ({ ...f, isRateRequestEnabled: v }))} />
              </View>
              <View style={styles.row}>
                <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => setShowUserModal(false)}>
                  <Text style={styles.btnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.primaryBtn, styles.flex, userFormLoading && styles.disabled]} onPress={createCustomer} disabled={userFormLoading}>
                  <Text style={styles.btnText}>{userFormLoading ? 'Saving...' : 'Save Customer'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showHoldReasonModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.title}>Hold Order</Text>
            <Text style={[styles.userMeta, { marginBottom: spacing.sm }]}>
              Enter a reason for putting this order on hold.
            </Text>
            <ScrollView>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={holdReason}
                onChangeText={setHoldReason}
                placeholder="Type reason here..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <View style={styles.row}>
                <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => { setShowHoldReasonModal(false); setHoldReason(''); }}>
                  <Text style={styles.btnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.primaryBtn, styles.flex, submitting && styles.disabled]} onPress={() => { setShowHoldReasonModal(false); submitHoldOrder(); }} disabled={submitting}>
                  <Text style={styles.btnText}>{submitting ? 'Holding...' : 'Confirm Hold'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  stepper: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  stepChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.border,
  },
  stepChipActive: { backgroundColor: colors.primary },
  stepText: { color: colors.textMuted, fontWeight: '700' },
  stepTextActive: { color: '#fff' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  summaryCard: {
    backgroundColor: colors.lightWarning,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
  },
  summaryText: { color: colors.text, fontWeight: '600', marginBottom: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  smallPrimaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryBtn: {
    backgroundColor: colors.adminSidebar,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  holdBtnText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  holdBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  userRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  userRowActive: { borderColor: colors.primary, backgroundColor: colors.lightWarning },
  userName: { color: colors.text, fontWeight: '700' },
  userMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  limitText: { color: colors.danger, fontSize: 11, marginTop: 2, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textMuted, marginVertical: 10 },
  productRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.lightInfo,
    opacity: 0.85,
  },
  tickBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  tickText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  price: { fontWeight: '700', color: colors.primary },
  customBox: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
  },
  qty: { width: 70, marginBottom: 0 },
  priceInput: { width: 90, marginBottom: 0 },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  total: { fontSize: 16, fontWeight: '800', color: colors.text, marginVertical: spacing.sm },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: spacing.md,
    maxHeight: '90%',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
});
