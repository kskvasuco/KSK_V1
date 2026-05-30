import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BrickSpinner from '../../components/BrickSpinner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as userApi from '../../api/userApi';
import { useCart } from '../../context/CartContext';
import { useOrderPolling } from '../../hooks/useOrderPolling';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';

const CELEBRATED_KEY = 'celebratedOrders';

const formatPrice = (val) => {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const statusColors = {
  Ordered: '#64748b', // Slate
  'Rate Requested': '#d97706', // Amber
  'Rate Approved': '#0ea5e9', // Sky Cyan
  Confirmed: '#8b5cf6', // Violet
  Dispatch: '#3b82f6', // Blue
  'Partially Delivered': '#06b6d4', // Cyan
  Delivered: '#10b981', // Emerald
  Completed: '#10b981', // Emerald
  Paused: '#f59e0b', // Amber
  Hold: '#ef4444', // Red
  Cancelled: '#94a3b8', // Cool Grey
};

export default function MyOrdersScreen({ navigation }) {
  const { isUser } = useAuth();
  const { startEditOrder } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [historyModal, setHistoryModal] = useState(null);

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
      Alert.alert('Cannot Edit', 'Only pending orders can be edited.');
      return;
    }
    const items = order.items.map((i) => ({
      productId: i.product?._id || i.product,
      productName: i.product?.name || i.name,
      quantity: i.quantityOrdered,
      unit: i.product?.unit || i.unit,
      description: i.description || '',
    }));
    startEditOrder(order._id, items);
    navigation.navigate('Home');
    navigation.navigate('Cart');
  };

  const handleCancel = (order) => {
    Alert.alert('Cancel Order?', 'Are you sure you want to cancel this order? This action cannot be undone.', [
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

  if (!isUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.guestContainer}>
          <View style={styles.guestIconCircle}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={styles.guestTitle}>LOGIN TO ACCESS</Text>
          <Text style={styles.guestMsg}>
            Please sign in to access your dashboard, view active orders, and monitor dispatch updates.
          </Text>
          <Pressable style={styles.guestBtn} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="key-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.guestBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <Text style={styles.pageTitle}>My Orders</Text>
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{orders.length} ACTIVE</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="cube-outline" size={56} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Orders Yet</Text>
              <Text style={styles.emptyMsg}>You haven't placed any orders. Start browsing from the store catalogue!</Text>
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
            const statusColor = statusColors[item.status] || '#64748b';

            return (
              <View style={[styles.card, open && styles.cardActive]}>
                <Pressable
                  onPress={() => setExpanded((e) => ({ ...e, [item._id]: !open }))}
                  style={styles.cardHeader}
                >
                  <View style={styles.headerLeft}>
                    <Text style={styles.orderId}>{item.customOrderId || item._id.slice(-8)}</Text>
                    <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: statusColor + '12' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.orderDate}>
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </Text>
                      <View style={styles.metaDivider} />
                      <Ionicons name="construct-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.itemCount}>{item.items?.length || 0} Item{item.items?.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <View style={styles.headerRight}>
                    <Text style={styles.balanceLabel}>Balance Due</Text>
                    <Text style={[styles.balanceValue, { color: balance > 0 ? colors.danger : colors.success }]}>
                      ₹{formatPrice(balance)}
                    </Text>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} style={{ marginTop: 4 }} />
                  </View>
                </Pressable>

                {open && (
                  <View style={styles.cardBody}>
                    <View style={styles.divider} />

                    <View style={styles.sectionHeader}>
                      <Ionicons name="basket-outline" size={16} color={colors.primary} />
                      <Text style={styles.sectionLabel}>Material Specification</Text>
                    </View>

                    {item.items?.map((line, idx) => {
                      const isQtyHidden = line.isQtyNotSpecified;
                      const qty = isQtyHidden ? 1 : line.quantityOrdered || 0;
                      const amt = qty * (line.price || 0);
                      return (
                        <View key={idx} style={styles.itemRow}>
                          <View style={styles.itemLeft}>
                            <Text style={styles.itemName}>{line.product?.name || line.name}</Text>
                            {!isQtyHidden && (
                              <View style={styles.qtyDeliverRow}>
                                <Text style={styles.itemMeta}>
                                  {line.quantityOrdered} {line.product?.unit || line.unit || 'Nos'}
                                </Text>
                                {line.quantityDelivered > 0 && (
                                  <>
                                    <View style={styles.metaDivider} />
                                    <Text style={styles.itemDeliveredText}>
                                      Delivered: {line.quantityDelivered}
                                    </Text>
                                  </>
                                )}
                              </View>
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
                        <View style={[styles.sectionHeader, { marginTop: spacing.md }]}>
                          <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                          <Text style={styles.sectionLabel}>Adjustments / Deductions</Text>
                        </View>
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
                      <View style={styles.totalLeft}>
                        <Text style={styles.totalLabel}>Grand Total Due</Text>
                        <Text style={styles.totalSubtext}>Includes all taxes & delivery fees</Text>
                      </View>
                      <Text style={[styles.totalValue, { color: balance > 0 ? colors.danger : colors.success }]}>
                        ₹{formatPrice(balance)}
                      </Text>
                    </View>

                    <View style={styles.actionsRow}>
                      {(item.status === 'Ordered' || item.status === 'Paused') && (
                        <>
                          <Pressable style={[styles.actionBtn, styles.btnEdit]} onPress={() => handleEdit(item)}>
                            <Ionicons name="create-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionBtnText}>Edit</Text>
                          </Pressable>
                          <Pressable style={[styles.actionBtn, styles.btnCancel]} onPress={() => handleCancel(item)}>
                            <Ionicons name="close-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionBtnText}>Cancel</Text>
                          </Pressable>
                        </>
                      )}
                      <Pressable style={[styles.actionBtn, styles.btnDeliveries]} onPress={() => showHistory(item._id)}>
                        <Ionicons name="cube-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnText}>Deliveries</Text>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="cube-outline" size={20} color={colors.primary} />
                  <Text style={styles.modalTitle}>Delivery Details</Text>
                </View>
                <Pressable onPress={() => setHistoryModal(null)} style={styles.closePressable}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {historyModal?.items?.length ? (
                  historyModal.items.map((d, i) => (
                    <View key={i} style={styles.histItem}>
                      <Text style={styles.histItemName}>{d.product?.name || 'Item'}</Text>
                      
                      <View style={styles.histMetaRow}>
                        <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                        <Text style={styles.histItemMeta}>
                          Delivered quantity: <Text style={{ fontWeight: '800', color: colors.success }}>{d.quantityDelivered}</Text>
                          {d.unit ? ` ${d.unit}` : ''}
                        </Text>
                      </View>

                      {d.deliveryAgent?.name && (
                        <View style={styles.histMetaRow}>
                          <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.histItemMeta}>Agent: {d.deliveryAgent.name}</Text>
                        </View>
                      )}

                      <View style={styles.histDateRow}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={styles.histItemDate}>
                          {new Date(d.deliveryDate).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.noHistoryContainer}>
                    <Ionicons name="hourglass-outline" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                    <Text style={styles.noHistoryText}>No dispatch or delivery logs recorded yet.</Text>
                  </View>
                )}
              </ScrollView>
              <Pressable style={styles.modalCloseBtn} onPress={() => setHistoryModal(null)}>
                <Text style={styles.modalCloseBtnText}>Close Portal</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '850',
    color: colors.text,
    letterSpacing: 0.5,
  },
  badgeCount: {
    backgroundColor: colors.lightInfo || 'rgba(0, 174, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 174, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  badgeCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyMsg: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardActive: {
    borderColor: colors.primary,
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  orderId: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.2,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  orderDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 4,
    fontWeight: '500',
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  itemCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginLeft: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  cardBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  itemLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '750',
    color: colors.text,
  },
  qtyDeliverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  itemMeta: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  itemDeliveredText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '700',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemRate: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  itemAmt: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  adjRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  adjDesc: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  adjAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: 14,
    backgroundColor: colors.lightWarning || 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.highlightedText || 'rgba(245, 158, 11, 0.2)',
  },
  totalLeft: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  totalSubtext: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    ...shadows.sm,
    flex: 1,
    minWidth: 100,
  },
  btnEdit: {
    backgroundColor: colors.primary,
  },
  btnCancel: {
    backgroundColor: colors.danger,
  },
  btnDeliveries: {
    backgroundColor: '#475569',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
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
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.3,
  },
  closePressable: {
    padding: 6,
  },
  modalBody: {
    padding: spacing.md,
  },
  histItem: {
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: spacing.sm,
    gap: 4,
  },
  histItemName: {
    fontSize: 13,
    fontWeight: '750',
    color: colors.text,
  },
  histMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  histItemMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  histDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  histItemDate: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  noHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noHistoryText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
  },
  modalCloseBtn: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  guestIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0, 174, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(0, 174, 255, 0.2)',
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  guestMsg: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl * 1.5,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    ...shadows.md,
  },
  guestBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
});
