import { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useCart } from '../../context/CartContext';
import * as userApi from '../../api/userApi';
import { colors, spacing } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export default function CartScreen({ navigation }) {
  const { cart, editContext, addToCart, updateCartItem, removeFromCart, placeOrder, clearCartState } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (editContext) {
      const fetchProducts = async () => {
        try {
          setLoadingProducts(true);
          const data = await userApi.getPublicProducts();
          setAllProducts(data || []);
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to load store catalogue products.');
        } finally {
          setLoadingProducts(false);
        }
      };
      fetchProducts();
    }
  }, [editContext]);

  const handlePlace = async () => {
    if (submittingRef.current) return;
    try {
      submittingRef.current = true;
      setSubmitting(true);
      const result = await placeOrder();
      Alert.alert('Success', result.message || 'Order placed!');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to place order');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const renderEditHeader = () => (
    <View style={styles.headerSection}>
      <Text style={styles.title}>Edit Order</Text>
      
      <Text style={styles.sectionTitle}>Items in this Order</Text>
      {cart.length === 0 ? (
        <View style={styles.emptyCartBox}>
          <Text style={styles.emptyCartText}>No items added to this order yet.</Text>
        </View>
      ) : (
        cart.map((item) => (
          <View key={String(item.productId)} style={styles.cartRow}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.productName}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              <Text style={styles.unit}>{item.unit}</Text>
            </View>
            <View style={styles.cartActionRow}>
              <TextInput
                style={styles.qty}
                value={String(item.quantity)}
                onChangeText={(v) => {
                  const q = parseFloat(v) || 0;
                  if (q > 0) updateCartItem(item.productId, q);
                }}
                keyboardType="decimal-pad"
              />
              <Pressable onPress={() => removeFromCart(item.productId)} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        ))
      )}
      
      <View style={styles.divider} />
      
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Catalogue Materials</Text>
        <Text style={styles.sectionSubtitle}>Tap "+" to add products directly to your order</Text>
      </View>
    </View>
  );

  const renderProductItem = ({ item: product }) => {
    const productInCart = cart.find((c) => c.productId === product._id);
    
    return (
      <View style={styles.productRow}>
        <View style={styles.info}>
          <Text style={styles.productName}>{product.name}</Text>
          {product.description ? <Text style={styles.description}>{product.description}</Text> : null}
          <Text style={styles.productPrice}>₹{product.price} / {product.unit}</Text>
        </View>
        
        {productInCart ? (
          <View style={styles.qtyContainer}>
            <Pressable
              onPress={() => {
                if (productInCart.quantity > 1) {
                  updateCartItem(product._id, productInCart.quantity - 1);
                } else {
                  removeFromCart(product._id);
                }
              }}
              style={styles.qtyBtn}
            >
              <Text style={styles.qtyBtnText}>-</Text>
            </Pressable>
            
            <TextInput
              style={styles.qtyInput}
              value={String(productInCart.quantity)}
              onChangeText={(v) => {
                const q = parseFloat(v) || 0;
                if (q > 0) updateCartItem(product._id, q);
              }}
              keyboardType="decimal-pad"
            />
            
            <Pressable
              onPress={() => updateCartItem(product._id, productInCart.quantity + 1)}
              style={styles.qtyBtn}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => addToCart(product, 1)}
            style={styles.addBtn}
          >
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.productName}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        <Text style={styles.unit}>{item.unit}</Text>
      </View>
      <TextInput
        style={styles.qty}
        value={String(item.quantity)}
        onChangeText={(v) => {
          const q = parseFloat(v) || 0;
          if (q > 0) updateCartItem(item.productId, q);
        }}
        keyboardType="decimal-pad"
      />
      <Pressable onPress={() => removeFromCart(item.productId)}>
        <Text style={styles.remove}>✕</Text>
      </Pressable>
    </View>
  );

  if (editContext && loadingProducts) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading catalogue products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={editContext ? allProducts : cart}
        keyExtractor={(item) => String(item._id || item.productId)}
        ListHeaderComponent={editContext ? renderEditHeader : <Text style={styles.title}>Your Cart</Text>}
        ListEmptyComponent={
          editContext ? (
            <Text style={styles.empty}>No products available in catalogue.</Text>
          ) : (
            <Text style={styles.empty}>Cart is empty</Text>
          )
        }
        renderItem={editContext ? renderProductItem : renderCartItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
      
      <View style={styles.footer}>
        <Pressable
          style={[styles.btn, submitting && styles.disabled]}
          onPress={handlePlace}
          disabled={submitting}
        >
          <Text style={styles.btnText}>
            {submitting ? '...' : editContext ? 'Update Order' : 'Place Order'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.clearBtn}
          onPress={() => {
            Alert.alert(editContext ? 'Discard Changes?' : 'Clear Cart?', '', [
              { text: 'Cancel', style: 'cancel' },
              { text: editContext ? 'Discard' : 'Clear', style: 'destructive', onPress: clearCartState },
            ]);
          }}
        >
          <Text style={styles.clearText}>{editContext ? 'Cancel Edit' : 'Clear'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: 22, fontWeight: '850', marginBottom: spacing.md, color: colors.text, letterSpacing: 0.5 },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: { flex: 1, marginRight: spacing.sm },
  name: { fontWeight: '700', color: colors.text, fontSize: 14 },
  description: { fontSize: 11, color: colors.textMuted, marginTop: 3, marginBottom: 3, lineHeight: 15 },
  unit: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  qty: {
    width: 65,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.background,
    fontWeight: '700',
    fontSize: 14,
  },
  remove: { color: colors.danger, fontSize: 18, padding: 8 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  footer: { paddingVertical: spacing.md },
  btn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  disabled: { opacity: 0.6 },
  clearBtn: { marginTop: spacing.sm, paddingVertical: 10, alignItems: 'center' },
  clearText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  
  // Edit Mode Specific Styles
  headerSection: { marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionSubtitle: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: '500' },
  sectionTitleRow: { marginTop: spacing.md },
  emptyCartBox: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.01)', alignItems: 'center', marginBottom: spacing.md },
  emptyCartText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 174, 255, 0.02)',
    borderColor: 'rgba(0, 174, 255, 0.08)',
    borderWidth: 1.2,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
  },
  cartActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  listContainer: { paddingBottom: spacing.lg },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productName: { fontSize: 14, fontWeight: '750', color: colors.text },
  productPrice: { fontSize: 12, fontWeight: '800', color: colors.primary, marginTop: 4 },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', height: 38, width: 110 },
  qtyBtn: { backgroundColor: colors.background, width: 32, height: '100%', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  qtyInput: { flex: 1, textAlign: 'center', height: '100%', color: colors.text, borderLeftWidth: 1.2, borderRightWidth: 1.2, borderColor: colors.border, backgroundColor: colors.card, padding: 0, fontWeight: '750', fontSize: 13 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, height: 38, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
});
