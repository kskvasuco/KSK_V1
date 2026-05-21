import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import adminApi from '../../api/adminApi';
import OrderCard from '../../components/orders/OrderCard';
import { filterOrdersByStatus } from '../../utils/orderFilters';
import { useOrderPolling } from '../../hooks/useOrderPolling';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

export default function OrderListScreen({ route, isAdmin = true }) {
  const { status, title } = route.params || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await adminApi.getOrders();
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useOrderPolling(fetchOrders, true);

  const filtered = useMemo(() => {
    let list = filterOrdersByStatus(orders, status);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.user?.mobile?.includes(q) ||
          o.user?.name?.toLowerCase().includes(q) ||
          o.customOrderId?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, status, search]);

  const handleStatusChange = async (orderId, newStatus, data = {}) => {
    await adminApi.updateOrderStatus(orderId, newStatus, data);
    await fetchOrders();
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title} ({filtered.length})</Text>
      <TextInput
        style={styles.search}
        placeholder="Search mobile, name, order ID..."
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={(o) => o._id}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            isExpanded={expandedId === item._id}
            onToggleExpand={() => setExpandedId((id) => (id === item._id ? null : item._id))}
            onStatusChange={handleStatusChange}
            onRefresh={fetchOrders}
            api={adminApi}
            isAdmin={isAdmin}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No orders in this list.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
