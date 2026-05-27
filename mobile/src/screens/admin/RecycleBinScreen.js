import { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, TextInput, RefreshControl } from 'react-native';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

export default function RecycleBinScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminApi.getDeletedOrders();
      setOrders(data.orders || []);
    } catch (e) {
      setError(e.message || 'Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((order) => {
        const idMatch = (order.customOrderId || order._id.toString()).toLowerCase().includes(q);
        const nameMatch = (order.user?.name || '').toLowerCase().includes(q);
        const phoneMatch = (order.user?.mobile || '').toLowerCase().includes(q);
        return idMatch || nameMatch || phoneMatch;
      });
    }
    filtered.sort((a, b) => {
      const da = new Date(a.deletedAt).getTime();
      const db = new Date(b.deletedAt).getTime();
      return db - da;
    });
    return filtered;
  }, [orders, searchQuery]);

  const handleRestore = async (orderId) => {
    Alert.alert('Restore Order', 'Are you sure you want to restore this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            await adminApi.restoreOrder(orderId);
            load();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handlePermanentDelete = async (orderId) => {
    Alert.alert(
      'Permanent Delete',
      'Are you sure you want to permanently delete this order? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.permanentDeleteOrder(orderId);
              load();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleBulkRestore = async () => {
    if (filteredOrders.length === 0) return;
    Alert.alert(
      'Restore All',
      `Are you sure you want to restore all ${filteredOrders.length} matched orders?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore All',
          onPress: async () => {
            try {
              for (const order of filteredOrders) {
                await adminApi.restoreOrder(order._id);
              }
              load();
            } catch (e) {
              Alert.alert('Error', `Bulk restore encountered an error: ${e.message}`);
              load();
            }
          },
        },
      ]
    );
  };

  const handleBulkPermanentDelete = async () => {
    if (filteredOrders.length === 0) return;
    Alert.alert(
      'Delete All Permanently',
      `Are you sure you want to permanently delete all ${filteredOrders.length} matched orders? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const order of filteredOrders) {
                await adminApi.permanentDeleteOrder(order._id);
              }
              load();
            } catch (e) {
              Alert.alert('Error', `Bulk delete encountered an error: ${e.message}`);
              load();
            }
          },
        },
      ]
    );
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗑️ Recycle Bin</Text>
        <Text style={styles.subtitle}>Manage deleted orders. Restore or delete permanently.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.searchInput}
        placeholder="Search Order ID, Name or Phone..."
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {filteredOrders.length > 0 ? (
        <View style={styles.bulkActions}>
          <Pressable style={[styles.btn, styles.restoreBtn]} onPress={handleBulkRestore}>
            <Text style={styles.btnText}>♻️ Restore All Found</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.deleteBtn]} onPress={handleBulkPermanentDelete}>
            <Text style={styles.btnText}>🗑️ Delete All Found</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filteredOrders}
        keyExtractor={(o) => o._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Recycle bin is empty.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.id}>#{item.customOrderId || item._id.slice(-6)}</Text>
                <Text style={styles.customer}>{item.user?.name || 'Unknown'}</Text>
                <Text style={styles.phone}>{item.user?.mobile || 'No Phone'}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.deletedDate}>Deleted: {formatDateDisplay(item.deletedAt)}</Text>
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.restoreBtn]} onPress={() => handleRestore(item._id)}>
                <Text style={styles.btnText}>♻️ Restore</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={() => handlePermanentDelete(item._id)}>
                <Text style={styles.btnText}>🗑️ Delete Forever</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  header: { marginBottom: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  error: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#f87171',
    color: '#b91c1c',
    padding: 12,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
    color: colors.text,
  },
  bulkActions: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  id: { fontWeight: '700', color: '#1a73e8', fontSize: 16 },
  customer: { fontWeight: '600', color: colors.text, marginTop: 4 },
  phone: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  statusBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  deletedDate: { color: '#dc2626', fontWeight: '600', marginTop: spacing.sm, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  btn: { padding: 8, borderRadius: 6, flex: 1, alignItems: 'center' },
  restoreBtn: { backgroundColor: '#16a34a' },
  deleteBtn: { backgroundColor: '#dc2626' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});