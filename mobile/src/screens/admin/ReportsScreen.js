import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import adminApi from '../../api/adminApi';
import { colors, spacing, shadows } from '../../theme';
import { formatPrice } from '../../utils/priceFormatter';

export default function ReportsScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Date inputs
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Load orders once, filter client-side dynamically
  const loadData = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getOrders();
      setOrders(data.orders || []);
    } catch (e) {
      Alert.alert('Load Error', e.message || 'Failed to fetch business reports data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick Presets
  const applyPreset = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    setEndDate(todayStr);

    if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
    } else if (preset === '30days') {
      const prior = new Date();
      prior.setDate(prior.getDate() - 30);
      setStartDate(prior.toISOString().slice(0, 10));
    } else if (preset === 'all') {
      setStartDate('2025-01-01'); // arbitrary early date to catch all
    }
  };

  // Live filtered orders list based on date ranges
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const dateStr = o.orderDate || o.createdAt;
      if (!dateStr) return false;
      const oDate = dateStr.slice(0, 10);
      
      const meetsStart = !startDate || oDate >= startDate;
      const meetsEnd = !endDate || oDate <= endDate;
      return meetsStart && meetsEnd && o.status !== 'Cancelled';
    });
  }, [orders, startDate, endDate]);

  // Analytics Aggregation
  const reportStats = useMemo(() => {
    let revenue = 0;
    let cashCollected = 0;
    let materialCount = 0;
    const demandMap = {};
    const talukMap = {};

    filteredOrders.forEach((o) => {
      // 1. Calculate Items Total
      const itemsTotal = o.items?.reduce((sum, item) => {
        const qty = item.isCustom && (item.quantityOrdered === 0 || item.quantityOrdered == null) ? 1 : item.quantityOrdered || 0;
        return sum + qty * (item.price || 0);
      }, 0) || 0;

      // 2. Adjustments Total
      let adjTotal = 0;
      o.adjustments?.forEach((a) => {
        if (a.type === 'charge' || a.type === 'advance') adjTotal += a.amount;
        else adjTotal -= a.amount;
        
        // Accumulate cash received from advances and payments
        if (a.type === 'advance' || a.type === 'payment') {
          cashCollected += a.amount;
        }
      });

      const orderVal = itemsTotal + adjTotal;
      revenue += orderVal;

      // Accumulate cash received from delivery logs / batch records if available
      o.deliveries?.forEach((del) => {
        cashCollected += del.receivedAmount || 0;
      });

      // 3. Material demand accumulation
      o.items?.forEach((item) => {
        const name = item.product?.name || item.name || 'Custom Material';
        const qty = item.quantityOrdered || 0;
        materialCount += qty;
        demandMap[name] = (demandMap[name] || 0) + qty;
      });

      // 4. Taluk Sales accumulation
      const taluk = o.user?.taluk || 'Walk-in / Unknown';
      if (!talukMap[taluk]) {
        talukMap[taluk] = { orders: 0, sales: 0 };
      }
      talukMap[taluk].orders += 1;
      talukMap[taluk].sales += orderVal;
    });

    // Format Material Demand into List
    const demandList = Object.keys(demandMap).map((name) => {
      const qty = demandMap[name];
      const pct = materialCount > 0 ? (qty / materialCount) * 100 : 0;
      return { name, qty, pct };
    }).sort((a, b) => b.qty - a.qty);

    // Format Taluk map into List
    const talukList = Object.keys(talukMap).map((taluk) => ({
      taluk,
      orders: talukMap[taluk].orders,
      sales: talukMap[taluk].sales,
    })).sort((a, b) => b.sales - a.sales);

    const pendingBalance = revenue - cashCollected;

    return {
      revenue,
      cashCollected,
      pendingBalance,
      materialCount,
      demandList,
      talukList,
    };
  }, [filteredOrders]);

  // PDF Export Trigger
  const exportPDFReport = async () => {
    try {
      const dateRangeStr = `${startDate || 'All Time'} to ${endDate}`;
      
      // Build HTML string
      const demandRows = reportStats.demandList.map((m) => `
        <tr>
          <td>${m.name}</td>
          <td>${m.qty.toFixed(1)}</td>
          <td>${m.pct.toFixed(1)}%</td>
        </tr>
      `).join('');

      const talukRows = reportStats.talukList.map((t) => `
        <tr>
          <td>${t.taluk}</td>
          <td>${t.orders}</td>
          <td>₹${formatPrice(t.sales)}</td>
        </tr>
      `).join('');

      const html = `
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2c3e50; padding: 30px; line-height: 1.6; }
            h1 { color: #c45500; font-size: 26px; border-bottom: 3px solid #c45500; padding-bottom: 12px; margin-bottom: 6px; }
            .subtitle { color: #7f8c8d; font-size: 14px; margin-bottom: 30px; font-weight: 500; }
            .metrics-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 35px; }
            .metric-card { flex: 1; min-width: 180px; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; }
            .metric-card.primary { border-color: #fed7aa; background-color: #fffaf0; }
            .metric-card.success { border-color: #bbf7d0; background-color: #f6fdf9; }
            .metric-card.danger { border-color: #fecaca; background-color: #fdf6f6; }
            .metric-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 8px; letter-spacing: 0.5px; }
            .metric-val { font-size: 22px; font-weight: 800; color: #1e293b; }
            .metric-card.primary .metric-val { color: #c45500; }
            .metric-card.success .metric-val { color: #067d62; }
            .metric-card.danger .metric-val { color: #b12704; }
            .section-title { font-size: 18px; font-weight: bold; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 30px; }
            th { background-color: #1e293b; color: white; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
            tr:nth-child(even) td { background-color: #f8fafc; }
            .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <h1>KSK VASUCO LOGISTICS REPORT</h1>
          <div class="subtitle">Generated Business Intelligence · Period: <strong>${dateRangeStr}</strong></div>
          
          <div class="metrics-grid">
            <div class="metric-card primary">
              <div class="metric-title">Total Revenue</div>
              <div class="metric-val">₹${formatPrice(reportStats.revenue)}</div>
            </div>
            <div class="metric-card success">
              <div class="metric-title">Cash Collected</div>
              <div class="metric-val">₹${formatPrice(reportStats.cashCollected)}</div>
            </div>
            <div class="metric-card danger">
              <div class="metric-title">Outstanding Balance</div>
              <div class="metric-val">₹${formatPrice(reportStats.pendingBalance)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Material Shipped</div>
              <div class="metric-val">${reportStats.materialCount.toFixed(1)} qty</div>
            </div>
          </div>

          <div class="section-title">Material Demand Share</div>
          <table>
            <thead>
              <tr>
                <th>Material Description</th>
                <th>Volume Shipped</th>
                <th>Demand Share</th>
              </tr>
            </thead>
            <tbody>
              ${demandRows || '<tr><td colspan="3" style="text-align:center;">No records inside this period.</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">Geographical Sales Breakdown (Taluk)</div>
          <table>
            <thead>
              <tr>
                <th>Taluk / Territory</th>
                <th>Completed Orders</th>
                <th>Aggregated Sales</th>
              </tr>
            </thead>
            <tbody>
              ${talukRows || '<tr><td colspan="3" style="text-align:center;">No records inside this period.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            KSK Vasuco Logistics Management System · Generated on ${new Date().toLocaleString()} · Confidential Report
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Export KSK Logistics Report PDF',
      });
    } catch (e) {
      Alert.alert('PDF Sharing Failure', e.message || 'Could not compile and export PDF.');
    }
  };

  if (loading && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Compiling business intelligence...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Sticky Header & Date Pickers */}
      <View style={styles.controlHeader}>
        <Text style={styles.headerTitle}>Business Analytics</Text>
        <Text style={styles.helperText}>Filter date range to compile charts & summaries:</Text>

        <View style={styles.dateInputsRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Start Date</Text>
            <TextInput
              style={styles.dateInput}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>End Date</Text>
            <TextInput
              style={styles.dateInput}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.presetsRow}>
          <Pressable style={styles.presetChip} onPress={() => applyPreset('30days')}>
            <Text style={styles.presetChipText}>Last 30 Days</Text>
          </Pressable>
          <Pressable style={styles.presetChip} onPress={() => applyPreset('month')}>
            <Text style={styles.presetChipText}>This Month</Text>
          </Pressable>
          <Pressable style={styles.presetChip} onPress={() => applyPreset('all')}>
            <Text style={styles.presetChipText}>All Time</Text>
          </Pressable>
          <Pressable style={[styles.presetChip, styles.refreshBtn]} onPress={loadData}>
            <Text style={[styles.presetChipText, { color: '#fff' }]}>🔄 Refresh</Text>
          </Pressable>
        </View>
      </View>

      {/* Main KPI Summary Grid */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricsRow}>
          <View style={[styles.kpiCard, styles.primaryKpi]}>
            <Text style={styles.kpiValue}>₹{formatPrice(reportStats.revenue)}</Text>
            <Text style={styles.kpiLabel}>Total Revenue</Text>
          </View>
          <View style={[styles.kpiCard, styles.successKpi]}>
            <Text style={styles.kpiValue}>₹{formatPrice(reportStats.cashCollected)}</Text>
            <Text style={styles.kpiLabel}>Cash Collections</Text>
          </View>
        </View>
        
        <View style={styles.metricsRow}>
          <View style={[styles.kpiCard, styles.dangerKpi]}>
            <Text style={styles.kpiValue}>₹{formatPrice(reportStats.pendingBalance)}</Text>
            <Text style={styles.kpiLabel}>Pending Balances</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: colors.info }]}>
              {reportStats.materialCount.toFixed(1)}
            </Text>
            <Text style={styles.kpiLabel}>Materials Shipped</Text>
          </View>
        </View>
      </View>

      {/* PDF Export Action */}
      <Pressable style={styles.pdfButton} onPress={exportPDFReport}>
        <Text style={styles.pdfButtonText}>📄 Export PDF Report & Share</Text>
      </Pressable>

      {/* Material Demand Visual Charts */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Material Demand Share</Text>
        {reportStats.demandList.length === 0 ? (
          <Text style={styles.emptyText}>No materials shipped during this period.</Text>
        ) : (
          reportStats.demandList.map((m, i) => (
            <View key={i} style={styles.barChartContainer}>
              <View style={styles.chartLabelRow}>
                <Text style={styles.chartName}>{m.name}</Text>
                <Text style={styles.chartQty}>
                  {m.qty.toFixed(1)} qty ({m.pct.toFixed(0)}%)
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${m.pct}%`,
                      backgroundColor:
                        i === 0
                          ? colors.primary
                          : i === 1
                          ? colors.info
                          : i === 2
                          ? colors.purple
                          : colors.gray,
                    },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </View>

      {/* Territorial breakdown table */}
      <View style={styles.talukSection}>
        <Text style={styles.sectionTitle}>Territorial Distribution (Taluk)</Text>
        {reportStats.talukList.length === 0 ? (
          <Text style={styles.emptyText}>No sales records inside this period.</Text>
        ) : (
          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCol, { flex: 2 }]}>Taluk</Text>
              <Text style={[styles.tableCol, { textAlign: 'center' }]}>Orders</Text>
              <Text style={[styles.tableCol, { textAlign: 'right' }]}>Sales</Text>
            </View>
            {reportStats.talukList.map((t, idx) => (
              <View
                key={idx}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 && { backgroundColor: '#fcfcfc' },
                ]}
              >
                <Text style={[styles.tableCol, styles.tableText, { flex: 2 }]}>{t.taluk}</Text>
                <Text style={[styles.tableCol, styles.tableText, { textAlign: 'center' }]}>
                  {t.orders}
                </Text>
                <Text style={[styles.tableCol, styles.tableText, { textAlign: 'right', fontWeight: '700' }]}>
                  ₹{formatPrice(t.sales)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  controlHeader: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.sm,
  },
  dateCol: {
    flex: 1,
    gap: 4,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: colors.background,
    color: colors.text,
    textAlign: 'center',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.md,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  refreshBtn: {
    backgroundColor: colors.adminSidebar,
    borderColor: colors.adminSidebar,
    marginLeft: 'auto',
  },

  // KPI Section
  metricsContainer: {
    padding: spacing.md,
    gap: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.md,
    gap: 4,
  },
  primaryKpi: {
    backgroundColor: '#fffaf0',
    borderColor: '#ffedd5',
  },
  successKpi: {
    backgroundColor: '#f6fdf9',
    borderColor: '#d1f2e1',
  },
  dangerKpi: {
    backgroundColor: '#fdf6f6',
    borderColor: '#fadcdb',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // PDF Export
  pdfButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },

  // Charts
  chartSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    padding: spacing.md,
  },
  barChartContainer: {
    gap: 6,
  },
  chartLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  chartQty: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Taluk section
  talukSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
    gap: spacing.md,
  },
  tableCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.adminSidebar,
    padding: 10,
  },
  tableCol: {
    flex: 1,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tableText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'none',
  },
});
