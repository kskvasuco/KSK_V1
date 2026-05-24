import {
  useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import BrickSpinner from '../../components/BrickSpinner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as userApi from '../../api/userApi';
import { useCart } from '../../context/CartContext';
import { useOrderPolling } from '../../hooks/useOrderPolling';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';

const CELEBRATED_KEY = 'celebratedOrders';

const numberToWords = (num) => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const g = ['', 'Thousand', 'Million', 'Billion'];
  const grp = n => ('000' + n).substr(-3);
  const rem = n => n.substr(0, n.length - 3);
  const fmt = ([h, t, o]) => {
    let str = '';
    str += h !== '0' ? a[h] + 'Hundred ' : '';
    str += t !== '0' ? (str !== '' ? 'and ' : '') + (b[t] || a[t + o]) + ' ' : '';
    str += t !== '0' && b[t] && o !== '0' ? a[o] : (t === '0' && o !== '0' ? a[o] : '');
    return str;
  };
  if (isNaN(num)) return '';
  if (num === 0) return 'Zero Only';
  let str = '', i = 0;
  let n = Math.floor(num).toString();
  while (n.length > 0) {
    const g1 = grp(n);
    const f = fmt(g1);
    if (f !== '') str = f + g[i] + ' ' + str;
    n = rem(n);
    i++;
  }
  return str.trim() + ' Only';
};

const formatPrice = (val) => {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const statusColors = {
  Ordered: '#6b7280',
  'Rate Requested': '#d97706',
  'Rate Approved': '#0ea5e9',
  Confirmed: '#7c3aed',
  Dispatch: '#2563eb',
  'Partially Delivered': '#0891b2',
  Delivered: '#059669',
  Completed: '#059669',
  Paused: '#d97706',
  Hold: '#dc2626',
  Cancelled: '#9ca3af',
};

export default function MyOrdersScreen({ navigation }) {
  const { isUser } = useAuth();
  const { startEditOrder } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [historyModal, setHistoryModal] = useState(null);
  const [isPrinting, setIsPrinting] = useState({});

  const loadOrders = useCallback(async (showSpinner = false) => {
    if (!isUser) return;
    try {
      if (showSpinner) setLoading(true);
      const data = await userApi.getMyOrders();
      setOrders(data);
      data.forEach((o) => {
        if (o.status === 'Delivered') celebrate(o._id);
      });
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [isUser]);

  useEffect(() => { loadOrders(true); }, [loadOrders]);
  useOrderPolling(loadOrders, true);

  const celebrate = async (orderId) => {
    const raw = await AsyncStorage.getItem(CELEBRATED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (list.includes(orderId)) return;
    list.push(orderId);
    await AsyncStorage.setItem(CELEBRATED_KEY, JSON.stringify(list));
    Alert.alert('🎉 Order Delivered!', 'Your order has been delivered. Thank you!');
  };

  const handleEdit = (order) => {
    if (order.status !== 'Ordered' && order.status !== 'Paused') {
      Alert.alert('Cannot edit', 'Only pending orders can be edited.');
      return;
    }
    const items = order.items.map((i) => ({
      productId: i.product?._id || i.product,
      productName: i.product?.name || i.name,
      quantity: i.quantityOrdered,
      unit: i.product?.unit || i.unit,
    }));
    startEditOrder(order._id, items);
    navigation.navigate('Home');
    navigation.navigate('Cart');
  };

  const handleCancel = (order) => {
    Alert.alert('Cancel order?', 'This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await userApi.cancelOrder(order._id);
            loadOrders();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const showHistory = async (orderId) => {
    try {
      const h = await userApi.getDeliveryHistory(orderId);
      setHistoryModal({ orderId, items: h });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const generateOrderPDF = async (order, withHeader) => {
    const key = `${order._id}_${withHeader}`;
    setIsPrinting((p) => ({ ...p, [key]: true }));
    try {
      const orderId = order.customOrderId || order._id.slice(-8);
      const _d = new Date(order.createdAt || new Date());
      const orderDate = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()}`;

      const itemsTotal = order.items?.reduce((sum, item) => {
        const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && (item.quantityOrdered === 0 || item.quantityOrdered == null));
        const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
        return sum + qty * (item.price || 0);
      }, 0) || 0;

      let adjTotal = 0;
      order.adjustments?.forEach((a) => {
        if (a.type === 'charge') adjTotal += a.amount;
        else adjTotal -= a.amount;
      });
      const balance = itemsTotal + adjTotal;

      const itemRowsHtml = order.items?.map((item, idx) => {
        const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && (item.quantityOrdered === 0 || item.quantityOrdered == null));
        const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
        const amount = qty * (item.price || 0);
        return `
          <tr>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 11px;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">${item.product?.name || item.name} ${item.description ? `(${item.description})` : ''}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">${qty}</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 10px;">${item.product?.unit || item.unit || 'Nos'}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">₹${formatPrice(item.price)}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">₹${formatPrice(amount)}</td>
          </tr>
        `;
      }).join('') || '';

      const adjRowsHtml = order.adjustments?.map((a) => {
        const prefix = a.type === 'charge' ? '+' : '-';
        return `
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; color: #111;">
            <span style="font-weight: 500;">${a.description || a.type.toUpperCase()}:</span>
            <span style="font-weight: bold;">${prefix} ₹${formatPrice(a.amount)}</span>
          </div>
        `;
      }).join('') || '';

      const html = `
        <html>
        <head>
          <meta charset="utf-8">
          <style>
             body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2c3e50; padding: 6mm; font-size: 10.5px; line-height: 1.3; }
             .invoice-box { border: 2px solid #000; padding: 8px; border-radius: 8px; }
             .header-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
             .title { text-align: center; font-size: 15px; font-weight: bold; margin: 3px 0; color: #000; text-transform: uppercase; }
             .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; }
            .meta-td { padding: 4px 6px; vertical-align: top; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th { background-color: #f1f5f9; padding: 6px; border: 1px solid #000; font-size: 9.5px; text-transform: uppercase; font-weight: bold; }
            .totals-section { display: flex; justify-content: space-between; border-top: 1.5px solid #000; padding-top: 8px; margin-top: 4px; }
            .words-col { flex: 1.2; padding-right: 10px; }
            .adj-col { flex: 0.9; border-left: 1.5px solid #000; padding-left: 10px; }
            .footer-note { text-align: center; font-size: 8px; color: #888; margin-top: 15px; border-top: 1px dashed #000; padding-top: 6px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            ${withHeader ? `
              <table class="header-table">
                <tr>
                  <td style="width: 65%;">
                    <div style="font-size: 18px; font-weight: 900; color: #2563eb; letter-spacing: 0.5px;">KSK VASU &amp; Co</div>
                    <div style="font-size: 9px; color: #555; font-weight: bold; margin-top: 1px;">Building Materials Service Center</div>
                    <div style="font-size: 8px; color: #777; margin-top: 2px;">www.kskvasu.co.in</div>
                  </td>
                  <td style="width: 35%; text-align: right; font-size: 10px; font-weight: 800;">
                    <div>&#x1F4DE; 9443350464</div>
                    <div style="margin-top: 1px;">&#x1F4DE; 9566530464</div>
                  </td>
                </tr>
              </table>
            ` : `<div style="height: 5px;"></div>`}

            <div class="title">ESTIMATE</div>
            <div style="text-align: right; font-size: 10px; font-weight: bold; margin-top: -16px; margin-bottom: 8px;">No: ${orderId}</div>

            <table class="meta-table">
              <tr>
                <td class="meta-td" style="width: 55%; border-right: 1.5px solid #000;">
                  <div style="font-size: 8.5px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; letter-spacing: 0.3px;">Customer Billing Details</div>
                  <div style="font-size: 12px; font-weight: 800; color: #000;">${order.user?.name || 'Walk-in Customer'}</div>
                  <div style="margin-top: 1px; font-weight: bold;">Mobile: ${order.user?.mobile || 'N/A'}</div>
                  ${order.user?.address ? `<div style="margin-top: 1px; color: #444; font-size: 9.5px;">Address: ${order.user.address}</div>` : ''}
                </td>
                <td class="meta-td" style="width: 45%; padding-left: 8px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>Date:</span>
                    <span style="font-weight: bold;">${orderDate}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>Status:</span>
                    <span style="font-weight: bold; text-transform: uppercase; color: #2563eb;">${order.status}</span>
                  </div>
                </td>
              </tr>
            </table>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 8%;">S.No</th>
                  <th style="width: 47%;">Description of Material</th>
                  <th style="width: 10%;">Qty</th>
                  <th style="width: 10%;">Unit</th>
                  <th style="width: 11%;">Rate</th>
                  <th style="width: 14%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemRowsHtml}
                <tr style="background-color: #fafafa; font-weight: bold;">
                  <td colspan="5" style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 10.5px;">Gross Materials Total:</td>
                  <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 10.5px;">₹${formatPrice(itemsTotal)}</td>
                </tr>
              </tbody>
            </table>

            <div class="totals-section">
              <div class="words-col">
                ${balance > 0.01 ? `
                  <div style="font-size: 10px; font-weight: bold; line-height: 1.4;">
                    Amount in Words:<br/>
                    <span style="color: #2563eb; font-style: italic;">Rupees ${numberToWords(balance)}</span>
                  </div>
                ` : ''}
              </div>
              <div class="adj-col">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: #555;">
                  <span>Gross Items Value:</span>
                  <span style="font-weight: bold;">₹${formatPrice(itemsTotal)}</span>
                </div>
                ${adjRowsHtml}
                <div style="height: 1.5px; background-color: #000; margin: 6px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #000; margin-top: 4px;">
                  <span>Net Due:</span>
                  <span style="color: #b12704;">₹${formatPrice(balance)}</span>
                </div>
              </div>
            </div>

            <div class="footer-note">
              ${withHeader ? 'www.kskvasu.co.in &nbsp;|&nbsp; ' : ''}Thank You..! Visit Again
            </div>
          </div>
        </body>
        </html>
      `;

      await Print.printAsync({
        html,
      });
    } catch (e) {
      Alert.alert('PDF Error', e.message || 'Failed to generate PDF.');
    } finally {
      setIsPrinting((p) => ({ ...p, [key]: false }));
    }
  };

  if (!isUser) {
    return (
      <View style={styles.guestContainer}>
        <Text style={styles.guestIcon}>📦</Text>
        <Text style={styles.guestTitle}>Access My Orders</Text>
        <Text style={styles.guestMsg}>
          Please log in to view your order history and live status updates.
        </Text>
        <Pressable style={styles.guestBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.guestBtnText}>🔑 Sign In Now</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o._id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <Text style={styles.pageTitle}>My Orders ({orders.length})</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptyMsg}>Place your first order from the Home screen.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const open = expanded[item._id];
          const itemsTotal = item.items?.reduce((sum, i) => {
            const qty = i.isQtyNotSpecified ? 1 : i.quantityOrdered || 0;
            return sum + qty * (i.price || 0);
          }, 0) || 0;
          let adjTotal = 0;
          item.adjustments?.forEach((a) => {
            if (a.type === 'charge') adjTotal += a.amount;
            else adjTotal -= a.amount;
          });
          const balance = itemsTotal + adjTotal;
          const statusColor = statusColors[item.status] || '#6b7280';

          return (
            <View style={styles.card}>
              <Pressable
                onPress={() => setExpanded((e) => ({ ...e, [item._id]: !open }))}
                style={styles.cardHeader}
              >
                <View style={styles.headerLeft}>
                  <View style={styles.orderIdRow}>
                    <Text style={styles.orderId}>#{item.customOrderId || item._id.slice(-8)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderDate}>
                    {new Date(item.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.itemCount}>{item.items?.length || 0} material{item.items?.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.headerRight}>
                  <Text style={styles.balanceLabel}>Balance Due</Text>
                  <Text style={[styles.balanceValue, { color: balance > 0 ? colors.danger : colors.success }]}>
                    ₹{formatPrice(balance)}
                  </Text>
                  <Text style={styles.expandChevron}>{open ? '▲' : '▼'}</Text>
                </View>
              </Pressable>

              {open && (
                <View style={styles.cardBody}>
                  <View style={styles.divider} />

                  <Text style={styles.sectionLabel}>Order Items</Text>
                  {item.items?.map((line, idx) => {
                    const isQtyHidden = line.isQtyNotSpecified;
                    const qty = isQtyHidden ? 1 : line.quantityOrdered || 0;
                    const amt = qty * (line.price || 0);
                    return (
                      <View key={idx} style={styles.itemRow}>
                        <View style={styles.itemLeft}>
                          <Text style={styles.itemName}>{line.product?.name || line.name}</Text>
                          {!isQtyHidden && (
                            <Text style={styles.itemMeta}>
                              {line.quantityOrdered} {line.product?.unit || line.unit || 'Nos'}
                              {line.quantityDelivered > 0 && (
                                <Text style={{ color: colors.success }}>
                                  {' '}· Delivered: {line.quantityDelivered}
                                </Text>
                              )}
                            </Text>
                          )}
                        </View>
                        <View style={styles.itemRight}>
                          <Text style={styles.itemRate}>₹{formatPrice(line.price)}</Text>
                          <Text style={styles.itemAmt}>₹{formatPrice(amt)}</Text>
                        </View>
                      </View>
                    );
                  })}

                  {item.adjustments && item.adjustments.length > 0 && (
                    <>
                      <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Adjustments</Text>
                      {item.adjustments.map((a, i) => (
                        <View key={i} style={styles.adjRow}>
                          <Text style={styles.adjDesc}>{a.description || a.type.toUpperCase()}</Text>
                          <Text style={[styles.adjAmount, { color: a.type === 'charge' ? colors.danger : colors.success }]}>
                            {a.type === 'charge' ? '+' : '-'} ₹{formatPrice(a.amount)}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Net Balance Due</Text>
                    <Text style={[styles.totalValue, { color: balance > 0 ? colors.danger : colors.success }]}>
                      ₹{formatPrice(balance)}
                    </Text>
                  </View>

                  <View style={styles.actionsRow}>
                    {(item.status === 'Ordered' || item.status === 'Paused') && (
                      <>
                        <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleEdit(item)}>
                          <Text style={styles.actionBtnText}>✏️ Edit</Text>
                        </Pressable>
                        <Pressable style={[styles.actionBtn, { backgroundColor: colors.danger }]} onPress={() => handleCancel(item)}>
                          <Text style={styles.actionBtnText}>❌ Cancel</Text>
                        </Pressable>
                      </>
                    )}
                    <Pressable style={[styles.actionBtn, { backgroundColor: '#475569' }]} onPress={() => showHistory(item._id)}>
                      <Text style={styles.actionBtnText}>📋 Deliveries</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.sectionLabel}>Download Estimate PDF</Text>
                  <View style={styles.printRow}>
                     <Pressable
                       style={[styles.printBtn, isPrinting[`${item._id}_false`] && styles.printBtnDisabled]}
                       onPress={() => generateOrderPDF(item, false)}
                       disabled={isPrinting[`${item._id}_false`]}
                     >
                       {isPrinting[`${item._id}_false`] ? (
                         <BrickSpinner size="small" color="#fff" />
                       ) : (
                         <Text style={styles.printBtnText}>📄 Plain PDF</Text>
                       )}
                     </Pressable>
                     <Pressable
                       style={[styles.printBtn, styles.printBtnHeader, isPrinting[`${item._id}_true`] && styles.printBtnDisabled]}
                       onPress={() => generateOrderPDF(item, true)}
                       disabled={isPrinting[`${item._id}_true`]}
                     >
                       {isPrinting[`${item._id}_true`] ? (
                         <BrickSpinner size="small" color="#fff" />
                       ) : (
                         <Text style={styles.printBtnText}>🏢 With Header</Text>
                       )}
                     </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      <Modal visible={!!historyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery History</Text>
              <Pressable onPress={() => setHistoryModal(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {historyModal?.items?.length ? (
                historyModal.items.map((d, i) => (
                  <View key={i} style={styles.histItem}>
                    <Text style={styles.histItemName}>{d.product?.name || 'Item'}</Text>
                    <Text style={styles.histItemMeta}>
                      Delivered: <Text style={{ fontWeight: '700', color: colors.success }}>{d.quantityDelivered}</Text>
                      {d.unit ? ` ${d.unit}` : ''}
                    </Text>
                    <Text style={styles.histItemDate}>
                      {new Date(d.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {d.deliveryAgent?.name && (
                      <Text style={styles.histItemMeta}>Driver: {d.deliveryAgent.name}</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noHistoryText}>No deliveries recorded yet.</Text>
              )}
            </ScrollView>
            <Pressable style={styles.modalCloseBtn} onPress={() => setHistoryModal(null)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },

  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: 0.3,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 },
  emptyMsg: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.md,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },

  headerLeft: { flex: 1, gap: 4 },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderId: { fontSize: 16, fontWeight: '800', color: colors.text },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  orderDate: { fontSize: 12, color: colors.textMuted },
  itemCount: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },

  headerRight: { alignItems: 'flex-end', gap: 2 },
  balanceLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  balanceValue: { fontSize: 18, fontWeight: '900' },
  expandChevron: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  cardBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.md },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemRate: { fontSize: 11, color: colors.textMuted },
  itemAmt: { fontSize: 13, fontWeight: '800', color: colors.text },

  adjRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  adjDesc: { fontSize: 12, color: colors.text },
  adjAmount: { fontSize: 12, fontWeight: '700' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: 12,
    backgroundColor: '#fffcf5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '900' },

  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    ...shadows.sm,
  },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  printRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  printBtn: {
    flex: 1,
    backgroundColor: '#166534',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    ...shadows.sm,
  },
  printBtnHeader: { backgroundColor: '#1e3a8a' },
  printBtnDisabled: { opacity: 0.6 },
  printBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 24,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  closeBtn: { fontSize: 20, color: colors.textMuted, padding: 4 },
  modalBody: { padding: spacing.lg },

  histItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    gap: 3,
  },
  histItemName: { fontSize: 13, fontWeight: '700', color: colors.text },
  histItemMeta: { fontSize: 12, color: colors.textMuted },
  histItemDate: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  noHistoryText: { textAlign: 'center', marginTop: 30, color: colors.textMuted, fontSize: 14 },

  modalCloseBtn: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.border,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  guestContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  guestIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  guestMsg: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  guestBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    ...shadows.md,
  },
  guestBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
