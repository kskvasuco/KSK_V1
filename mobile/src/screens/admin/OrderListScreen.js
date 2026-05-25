import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import adminApi from '../../api/adminApi';
import OrderCard from '../../components/orders/OrderCard';
import { filterOrdersByStatus } from '../../utils/orderFilters';
import { useOrderPolling } from '../../hooks/useOrderPolling';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

function targetScreenForStatus(statusText) {
  if (!statusText) return 'Pending';
  if (statusText === 'Ordered') return 'Pending';
  if (statusText === 'Rate Requested') return 'RateRequested';
  if (statusText === 'Rate Approved') return 'RateApproved';
  if (statusText === 'Confirmed') return 'Confirmed';
  if (statusText === 'Paused') return 'Paused';
  if (statusText === 'Hold') return 'Hold';
  if (statusText === 'Cancelled') return 'Cancelled';
  if (statusText === 'Completed') return 'Completed';
  if (statusText === 'Delivered') return 'Delivered';
  if (statusText.startsWith('Dispatch') || statusText === 'Partially Delivered') return 'Dispatch';
  return 'Pending';
}

export default function OrderListScreen({ route, isAdmin = true }) {
  const navigation = useNavigation();
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

  useEffect(() => {
    const targetOrderId = route?.params?.targetOrderId;
    if (!targetOrderId) return;

    const existsInList = filtered.some((o) => o._id === targetOrderId);
    if (existsInList) {
      setExpandedId(targetOrderId);
      navigation.setParams({ targetOrderId: undefined });
    }
  }, [filtered, route?.params?.targetOrderId, navigation]);

  const handleStatusChange = async (orderId, newStatus, data = {}) => {
    await adminApi.updateOrderStatus(orderId, newStatus, data);
    await fetchOrders();
    const targetScreen = targetScreenForStatus(newStatus);
    navigation.navigate(targetScreen, { targetOrderId: orderId });
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title} ({filtered.length})</Text>
      <TextInput
        style={styles.search}
        placeholder="Search mobile, name, order ID..."
        placeholderTextColor={colors.textMuted}
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
  title: { fontSize: 18, fontWeight: '700', marginBottom: spacing.sm, color: colors.text },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    color: colors.text,
  },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
