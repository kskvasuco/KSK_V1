import { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

export default function RecycleBinScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await adminApi.getDeletedOrders();
      setOrders(data.orders || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading />;

  return (
    <FlatList
      style={styles.container}
      data={orders}
      keyExtractor={(o) => o._id}
      ListEmptyComponent={<Text style={styles.empty}>Recycle bin is empty.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.id}>{item.customOrderId}</Text>
          <Text>{item.user?.mobile}</Text>
          <View style={styles.row}>
            <Pressable
              style={styles.btn}
              onPress={async () => {
                try {
                  await adminApi.restoreOrder(item._id);
                  load();
                } catch (e) {
                  Alert.alert('Error', e.message);
                }
              }}
            >
              <Text style={styles.btnText}>Restore</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.danger]}
              onPress={() => {
                Alert.alert('Permanent delete?', '', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await adminApi.permanentDeleteOrder(item._id);
                        load();
                      } catch (e) {
                        Alert.alert('Error', e.message);
                      }
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.btnText}>Delete Forever</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  id: { fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  btn: { backgroundColor: colors.primary, padding: 8, borderRadius: 6 },
  danger: { backgroundColor: colors.danger },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
