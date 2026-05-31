import { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, TextInput, RefreshControl } from 'react-native';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

export default function RecycleBinScreen() {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'customers'
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      if (activeTab === 'orders') {
        const data = await adminApi.getDeletedOrders();
        setOrders(data.orders || []);
      } else {
        const data = await adminApi.getDeletedUsers();
        setCustomers(Array.isArray(data) ? data : data.users || []);
      }
    } catch (e) {
      setError(e.message || `Failed to load deleted ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery('');
    load();
  }, [activeTab]);

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

  // Orders Memo
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

  // Customers Memo
  const filteredCustomers = useMemo(() => {
    let filtered = customers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((user) => {
        const nameMatch = (user.name || '').toLowerCase().includes(q);
        const phoneMatch = (user.mobile || '').toLowerCase().includes(q);
        const districtMatch = (user.district || '').toLowerCase().includes(q);
        const talukMatch = (user.taluk || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || districtMatch || talukMatch;
      });
    }
    filtered.sort((a, b) => {
      const da = new Date(a.updatedAt).getTime();
      const db = new Date(b.updatedAt).getTime();
      return db - da;
    });
    return filtered;
  }, [customers, searchQuery]);

  // Order Handlers
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

  // User Handlers
  const handleRestoreUser = async (userId) => {
    Alert.alert('Restore Customer', 'Are you sure you want to restore this customer account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            await adminApi.restoreUser(userId);
            load();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handlePermanentDeleteUser = async (userId) => {
    Alert.alert(
      'Permanently Delete Customer?',
      'Are you sure you want to PERMANENTLY delete this customer? This will erase their profile and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.permanentDeleteUser(userId);
              load();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  // Bulk Actions
  const handleBulkRestore = async () => {
    const list = activeTab === 'orders' ? filteredOrders : filteredCustomers;
    if (list.length === 0) return;
    Alert.alert(
      'Restore All',
      `Are you sure you want to restore all ${list.length} matched ${activeTab}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore All',
          onPress: async () => {
            try {
              for (const item of list) {
                if (activeTab === 'orders') {
                  await adminApi.restoreOrder(item._id);
                } else {
                  await adminApi.restoreUser(item._id);
                }
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
    const list = activeTab === 'orders' ? filteredOrders : filteredCustomers;
    if (list.length === 0) return;
    Alert.alert(
      'Delete All Permanently',
      `Are you sure you want to permanently delete all ${list.length} matched ${activeTab}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const item of list) {
                if (activeTab === 'orders') {
                  await adminApi.permanentDeleteOrder(item._id);
                } else {
                  await adminApi.permanentDeleteUser(item._id);
                }
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

  if (loading && !refreshing) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗑️ Recycle Bin</Text>
        <Text style={styles.subtitle}>Manage deleted orders or customers. Restore or delete permanently.</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tabButton, activeTab === 'orders' && styles.activeTabButton]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>📦 Deleted Orders</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'customers' && styles.activeTabButton]}
          onPress={() => setActiveTab('customers')}
        >
          <Text style={[styles.tabText, activeTab === 'customers' && styles.activeTabText]}>👥 Deleted Customers</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.searchInput}
        placeholder={activeTab === 'orders' ? "Search Order ID, Name or Phone..." : "Search Name, Phone, Taluk or District..."}
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {((activeTab === 'orders' && filteredOrders.length > 0) || (activeTab === 'customers' && filteredCustomers.length > 0)) ? (
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
        data={activeTab === 'orders' ? filteredOrders : filteredCustomers}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Recycle bin is empty for {activeTab}.</Text>}
        renderItem={({ item }) => {
          if (activeTab === 'orders') {
            return (
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
            );
          } else {
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.id}>{item.name || 'Unnamed Customer'}</Text>
                    <Text style={styles.customer}>📞 {item.mobile || 'No Phone'}</Text>
                    <Text style={styles.phone}>📍 {item.taluk ? `${item.taluk}, ` : ''}{item.district || 'No District'}</Text>
                  </View>
                </View>
                <Text style={styles.deletedDate}>Deleted: {formatDateDisplay(item.updatedAt)}</Text>
                <View style={styles.row}>
                  <Pressable style={[styles.btn, styles.restoreBtn]} onPress={() => handleRestoreUser(item._id)}>
                    <Text style={styles.btnText}>♻️ Restore</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.deleteBtn]} onPress={() => handlePermanentDeleteUser(item._id)}>
                    <Text style={styles.btnText}>🗑️ Delete Forever</Text>
                  </Pressable>
                </View>
              </View>
            );
          }
        }}
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0f52ba',
    fontWeight: '700',
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