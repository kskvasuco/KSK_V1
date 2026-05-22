import { useState } from 'react';
import { View, Text, Image, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { colors, spacing } from '../theme';

export default function ProductCard({ product, isLoggedIn, onAddToCart }) {
  const [quantity, setQuantity] = useState('');

  const handleAdd = () => {
    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a valid quantity.');
      return;
    }
    onAddToCart(product, qty);
    setQuantity('');
  };

  return (
    <View style={styles.card}>
      {product.imageData ? (
        <Image source={{ uri: product.imageData }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderIcon}>🧱</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
      {product.description ? (
        <Text style={styles.desc} numberOfLines={2}>{product.description}</Text>
      ) : null}
      <Text style={styles.unit}>{product.unit || ''}</Text>
      {isLoggedIn && (
        <View style={styles.actions}>
          <TextInput
            style={styles.qtyInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="Qty"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: spacing.sm,
    margin: spacing.xs,
    flex: 1,
    minWidth: 150,
    maxWidth: '48%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: 100, borderRadius: 6 },
  placeholder: { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  placeholderIcon: { fontSize: 32 },
  name: { fontWeight: '700', marginTop: spacing.sm, fontSize: 14 },
  desc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  unit: { fontSize: 12, color: colors.primary, marginTop: 2 },
  actions: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.xs },
  qtyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
