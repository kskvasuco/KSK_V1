import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';

const CHART_COLORS = [
  '#c45500',
  '#2980b9',
  '#8e44ad',
  '#e67e22',
  '#067d62',
  '#b12704',
];

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const analytics = await adminApi.getAnalytics();
      setData(analytics);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !refreshing) return <Loading />;

  const summary = data?.summary || {};
  const salesTrend = Array.isArray(data?.salesTrend) ? data.salesTrend : [];
  const statusDist = Array.isArray(data?.statusDistribution) ? data.statusDistribution : [];
  const topProducts = Array.isArray(data?.topProducts) ? data.topProducts : [];

  const totalOrders = statusDist.reduce((sum, s) => sum + (s.value || 0), 0);
  const maxRevenue = salesTrend.length > 0
    ? Math.max(...salesTrend.map(d => d.revenue || 0))
    : 1;

  const kpis = [
    {
      label: 'Lifetime Revenue',
      value: summary.lifetimeRevenue != null ? `₹${Number(summary.lifetimeRevenue).toLocaleString()}` : '—',
      icon: 'trending-up',
      color: colors.success,
      bg: '#e6f7f0',
      sub: [
        { label: 'Avg/Month', value: summary.avgMonthlyRevenue != null ? `₹${Number(summary.avgMonthlyRevenue).toLocaleString()}` : '—' },
        { label: 'Avg/Year', value: summary.avgYearlyRevenue != null ? `₹${Number(summary.avgYearlyRevenue).toLocaleString()}` : '—' },
      ],
    },
    {
      label: 'Active Orders',
      value: summary.activeOrders != null ? Number(summary.activeOrders).toLocaleString() : '—',
      icon: 'cart',
      color: '#2980b9',
      bg: '#eff6ff',
      badge: summary.momGrowth,
      sub: summary.momGrowth != null ? [{ label: 'MoM Growth', value: `${summary.momGrowth >= 0 ? '+' : ''}${summary.momGrowth}%` }] : [],
    },
    {
      label: 'Customers',
      value: summary.totalUsers != null ? Number(summary.totalUsers).toLocaleString() : '—',
      icon: 'people',
      color: '#8e44ad',
      bg: '#f5f3ff',
    },
    {
      label: 'Period Sales',
      value: summary.periodRevenue != null ? `₹${Number(summary.periodRevenue).toLocaleString()}` : '—',
      icon: 'bar-chart',
      color: colors.warning,
      bg: '#fffbeb',
    },
  ];

  const renderBarChart = () => {
    if (!salesTrend.length) {
      return <Text style={styles.noData}>No sales data available</Text>;
    }

    return (
      <View style={styles.barChartContainer}>
        {salesTrend.map((item, index) => {
          const revenue = item.revenue || 0;
          const height = maxRevenue > 0 ? Math.max((revenue / maxRevenue) * 110, 4) : 4;
          const color = CHART_COLORS[index % CHART_COLORS.length];

          return (
            <View key={index} style={styles.barWrapper}>
              <Text style={styles.barValue}>
                {revenue > 0 ? `₹${Math.round(revenue / 1000)}k` : '0'}
              </Text>
              <View style={[styles.bar, { height, backgroundColor: color }]} />
              <Text style={styles.barLabel}>{item.name || ''}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderStatusDistribution = () => {
    if (!statusDist.length) {
      return <Text style={styles.noData}>No order data available</Text>;
    }

    return statusDist.map((item, index) => {
      const count = item.value || 0;
      const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
      const color = CHART_COLORS[index % CHART_COLORS.length];

      return (
        <View key={index} style={styles.statusRow}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={styles.statusName}>{item.name || 'Unknown'}</Text>
            <Text style={styles.statusCount}>{count}</Text>
          </View>
          <View style={styles.statusBarBackground}>
            <View style={[styles.statusBarFill, { width: `${pct}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.statusPct}>{pct}%</Text>
        </View>
      );
    });
  };

  const renderTopProducts = () => {
    if (!topProducts.length) {
      return <Text style={styles.noData}>No product data available</Text>;
    }

    return topProducts.map((p, index) => (
      <View key={index} style={styles.productRow}>
        <Text style={styles.productName} numberOfLines={1}>{p.name || 'Product'}</Text>
        <View style={styles.productStats}>
          <Text style={styles.productQty}>{p.qty || 0} units</Text>
          <Text style={styles.productRevenue}>
            ₹{(p.revenue || 0).toLocaleString()}
          </Text>
        </View>
      </View>
    ));
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hai KSK Vasu ..! 👋</Text>
        <Text style={styles.subtext}>
          Welcome back! Here's what's happening with your business today.
        </Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        {kpis.map((kpi, idx) => (
          <View key={idx} style={[styles.kpiCard, shadows.md]}>
            <View style={[styles.kpiIcon, { backgroundColor: kpi.bg }]}>
              <Ionicons name={kpi.icon} size={20} color={kpi.color} />
            </View>

            <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{kpi.value}</Text>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>

            {kpi.badge !== undefined && (
              <View style={[
                styles.badge,
                kpi.badge >= 0 ? styles.badgePositive : styles.badgeNegative
              ]}>
                <Ionicons
                  name={kpi.badge >= 0 ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={kpi.badge >= 0 ? colors.success : colors.danger}
                />
                <Text style={styles.badgeText}>
                  {Math.abs(kpi.badge)}%
                </Text>
              </View>
            )}

            {kpi.sub && kpi.sub.length > 0 && (
              <View style={styles.kpiSub}>
                {kpi.sub.map((s, sIdx) => (
                  <View key={sIdx} style={styles.subItem}>
                    <Text style={styles.subValue} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
                    <Text style={styles.subLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Sales Velocity */}
      <View style={[styles.sectionCard, shadows.sm]}>
        <Text style={styles.sectionTitle}>Sales Velocity (Last 6 Months)</Text>
        {renderBarChart()}
      </View>

      {/* Order Distribution */}
      <View style={[styles.sectionCard, shadows.sm]}>
        <Text style={styles.sectionTitle}>Order Distribution</Text>
        <View style={styles.statusList}>
          {renderStatusDistribution()}
        </View>
        {totalOrders > 0 && (
          <Text style={styles.totalOrders}>Total Orders: {totalOrders}</Text>
        )}
      </View>

      {/* Top Products */}
      <View style={[styles.sectionCard, shadows.sm]}>
        <Text style={styles.sectionTitle}>Top Selling Products</Text>
        <View style={styles.productList}>
          {renderTopProducts()}
        </View>
      </View>

      {error && (
        <Pressable onPress={() => load(true)} style={styles.errorBanner}>
          <Text style={styles.errorText}>Failed to load latest data. Tap to retry.</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },

  header: {
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },

  // KPI
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgePositive: { backgroundColor: '#d4edda' },
  badgeNegative: { backgroundColor: '#f8d7da' },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  kpiSub: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  subItem: {
    flex: 1,
  },
  subValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  subLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Sections
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // Bar Chart
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    gap: 8,
    paddingTop: 8,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '70%',
    borderRadius: 4,
    minHeight: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },

  // Status Distribution
  statusList: {
    gap: 10,
  },
  statusRow: {
    marginBottom: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusName: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  statusCount: {
    fontWeight: '700',
    color: colors.text,
    marginRight: 8,
  },
  statusBarBackground: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statusBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusPct: {
    fontSize: 11,
    color: colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  totalOrders: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // Top Products
  productList: {
    gap: 8,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginRight: 8,
  },
  productStats: {
    alignItems: 'flex-end',
  },
  productQty: {
    fontSize: 12,
    color: colors.textMuted,
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
  },

  noData: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },

  errorBanner: {
    backgroundColor: '#fff3cd',
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  errorText: {
    color: '#856404',
    textAlign: 'center',
    fontSize: 13,
  },
});
