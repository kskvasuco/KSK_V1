import { useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useCart } from '../../context/CartContext';
import { colors, spacing } from '../../theme';

export default function CartScreen({ navigation }) {
  const { cart, editContext, updateCartItem, removeFromCart, placeOrder, clearCartState } = useCart();
  const [submitting, setSubmitting] = useState(false);

  const handlePlace = async () => {
    try {
      setSubmitting(true);
      const result = await placeOrder();
      Alert.alert('Success', result.message || 'Order placed!');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{editContext ? 'Edit Order' : 'Your Cart'}</Text>
      <FlatList
        data={cart}
        keyExtractor={(item) => String(item.productId)}
        ListEmptyComponent={<Text style={styles.empty}>Cart is empty</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.productName}</Text>
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
        )}
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
            Alert.alert('Clear cart?', '', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: clearCartState },
            ]);
          }}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: 22, fontWeight: '700', marginBottom: spacing.md },
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
  info: { flex: 1 },
  name: { fontWeight: '600' },
  unit: { fontSize: 12, color: colors.textMuted },
  qty: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 6,
    textAlign: 'center',
    marginRight: 8,
  },
  remove: { color: colors.danger, fontSize: 18, padding: 8 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  footer: { paddingVertical: spacing.md },
  btn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  clearBtn: { marginTop: spacing.sm, alignItems: 'center' },
  clearText: { color: colors.danger },
});
