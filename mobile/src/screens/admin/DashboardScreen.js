import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const analytics = await adminApi.getAnalytics();
      setData(analytics);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading />;

  const stats = [
    { label: 'Total Orders', value: data?.totalOrders ?? '—' },
    { label: 'Total Users', value: data?.totalUsers ?? '—' },
    { label: 'Revenue', value: data?.totalRevenue != null ? `₹${data.totalRevenue}` : '—' },
    { label: 'Pending', value: data?.pendingOrders ?? '—' },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.title}>Dashboard</Text>
      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: 12,
    width: '47%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
  statLabel: { marginTop: 4, color: colors.textMuted },
});
