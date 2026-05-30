import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import * as userApi from '../../api/userApi';
import ProductCard from '../../components/ProductCard';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

export default function HomeScreen({ navigation }) {
  const { isUser } = useAuth();
  const { cart, addToCart, editContext } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProducts();
  }, [isUser]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await userApi.getPublicProducts();
      setProducts(data);
    } catch (e) {
      console.warn('Failed to load products:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const t = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(t) ||
        p.description?.toLowerCase().includes(t) ||
        p.unit?.toLowerCase().includes(t)
    );
  }, [products, search]);

  const handleAdd = async (product, quantity) => {
    if (!isUser) {
      navigation.navigate('Login');
      return;
    }
    const limit = product.quantityLimit || 0;
    if (limit > 0) {
      try {
        const active = await userApi.getActiveOrderQuantities();
        const inOrders = active[product._id] || 0;
        const inCart = cart.find((i) => i.productId === product._id)?.quantity || 0;
        if (inOrders + inCart + quantity > limit) {
          Alert.alert('Limit exceeded', `Max ${limit} ${product.unit} allowed.`);
          return;
        }
      } catch {
        const inCart = cart.find((i) => i.productId === product._id)?.quantity || 0;
        if (inCart + quantity > limit) {
          Alert.alert('Limit exceeded', `Max ${limit} ${product.unit} in cart.`);
          return;
        }
      }
    }
    try {
      await addToCart(product, quantity);
      setMessage(`${product.name} added to ${editContext ? 'order' : 'cart'}.`);
      setTimeout(() => setMessage(''), 2000);
    } catch {
      Alert.alert('Error', 'Failed to add to cart.');
    }
  };

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.title}>KSK VASU & Co</Text>
            {!isUser && (
              <Pressable style={styles.loginHeaderBtn} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginHeaderBtnText}>🔑 Login</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search products..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {isUser && (cart.length > 0 || editContext) && (
            <Pressable style={styles.cartBtn} onPress={() => navigation.navigate('Cart')}>
              <Text style={styles.cartBtnText}>
                Cart ({cart.length})
              </Text>
            </Pressable>
          )}
        </View>
        {message ? <Text style={styles.msg}>{message}</Text> : null}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={loadProducts}
          renderItem={({ item }) => (
            <ProductCard product={item} isLoggedIn={isUser} onAddToCart={handleAdd} />
          )}
          ListEmptyComponent={
            error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Failed to load products.</Text>
                <Pressable style={styles.retryBtn} onPress={loadProducts}>
                  <Text style={styles.retryBtnText}>🔄 Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.empty}>No products found.</Text>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.card,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  loginHeaderBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  loginHeaderBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.primary },
  search: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.background,
    color: colors.text,
  },
  cartBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cartBtnText: { color: '#fff', fontWeight: '600' },
  msg: { textAlign: 'center', color: colors.success, padding: spacing.sm },
  list: { padding: spacing.sm },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    padding: spacing.md,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
