import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import adminApi from '../../api/adminApi';
import { colors, spacing, shadows } from '../../theme';
import { API_BASE } from '../../config';

export default function OrderCountScreen() {
  const [orders, setOrders] = useState([]);
  const [groupedCustomers, setGroupedCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getOrders();
      const allOrders = Array.isArray(data) ? data : (data?.orders || []);
      setOrders(allOrders);

      // Group orders by mobile number
      const groups = {};
      allOrders.forEach(order => {
        const mobile = (order.user?.mobile || order.mobile || 'N/A').trim();
        const name = order.user?.name || order.userName || 'Walk-in Customer';
        const address = order.user?.address || order.address || '';
        
        if (!groups[mobile]) {
          groups[mobile] = {
            name,
            mobile,
            address,
            orders: [],
            orderCount: 0
          };
        }
        
        groups[mobile].orders.push(order);
        groups[mobile].orderCount += 1;
        
        // Keep the most complete address and name
        if (address.length > groups[mobile].address.length) {
          groups[mobile].address = address;
        }
        if (name !== 'Walk-in Customer' && groups[mobile].name === 'Walk-in Customer') {
          groups[mobile].name = name;
        }
      });

      const groupedList = Object.values(groups).sort((a, b) => b.orderCount - a.orderCount);
      setGroupedCustomers(groupedList);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredCustomers = groupedCustomers.filter(customer => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.mobile.includes(query)
    );
  });

  const getOrderTotal = (order) => {
    let total = (order.items || []).reduce((sum, item) => {
      const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && item.quantityOrdered === 0);
      const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
      return sum + (qty * (item.price || 0));
    }, 0);
    
    if (order.adjustments?.length > 0) {
      order.adjustments.forEach(adj => {
        if (adj.type === 'charge') total += adj.amount;
        else total -= adj.amount;
      });
    }
    return total;
  };

  const generateReportHtml = (customer, filteredOrders) => {
    let grandTotal = 0;
    let serialCount = 1;

    const sectionsHtml = filteredOrders.map((order) => {
      const orderTotal = getOrderTotal(order);
      grandTotal += orderTotal;
      const _d = new Date(order.createdAt);
      const orderTime = _d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()} ${orderTime}`;
      const displayId = order.customOrderId || (order._id ? order._id.slice(-8).toUpperCase() : 'N/A');

      // Order Items Rows
      const itemRows = (order.items || []).map((item) => {
        const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && item.quantityOrdered === 0);
        const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
        const rate = item.price || 0;
        const amt = qty * rate;
        const rowStr = `
          <tr>
            <td style="text-align: center; padding: 6px; border: 1px solid #ddd;">${serialCount}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">${item.name} ${item.description ? `<span style="font-size: 10px; color: #666; font-weight: normal;">(${item.description})</span>` : ''}</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #ddd;">${isQtyHidden ? 'N/A' : qty}</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #ddd; font-size: 10px;">${item.unit || 'Nos'}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #ddd;">₹${rate.toFixed(2)}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #ddd; font-weight: bold;">₹${amt.toFixed(2)}</td>
          </tr>
        `;
        serialCount++;
        return rowStr;
      }).join('');

      // Order Adjustments Rows
      const adjustmentRows = (order.adjustments || []).map((adj) => {
        const amt = adj.amount || 0;
        const sign = adj.type === 'charge' ? '+' : '-';
        return `
          <tr style="color: #475569;">
            <td></td>
            <td style="padding: 6px; border: 1px solid #ddd; font-style: italic;">🔧 Adjustment: ${adj.description || 'Adjustment'}</td>
            <td></td>
            <td></td>
            <td></td>
            <td style="text-align: right; padding: 6px; border: 1px solid #ddd; font-weight: bold; color: ${adj.type === 'charge' ? '#ef4444' : '#22c55e'};">${sign}₹${amt.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      return `
        <!-- Order Master Row -->
        <tr style="background-color: #f0f6ff; font-weight: bold; color: #0f52ba;">
          <td colspan="6" style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">
            Order ID: ${displayId}  |  Date: ${dateStr}  |  Status: ${order.status || 'Ordered'}
          </td>
        </tr>
        <!-- Order Detail Items -->
        ${itemRows}
        <!-- Adjustments -->
        ${adjustmentRows}
        <!-- Order Subtotal Row -->
        <tr style="background-color: #fafafa; font-weight: bold;">
          <td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #ddd; font-size: 11px;">Order Subtotal</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #ddd; color: #0f52ba; font-size: 11px;">₹${orderTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const curTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 12mm 12mm 20mm 12mm; }
          body { font-family: 'Mukta Malar', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 0; margin: 0; box-sizing: border-box; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .header-left { display: flex; align-items: center; gap: 10px; }
          .logo { width: 48px; height: 48px; object-fit: contain; }
          .title-group h1 { margin: 0; color: #0f52ba; font-size: 20px; font-weight: bold; }
          .title-group p { margin: 2px 0 0 0; font-size: 10px; color: #475569; font-weight: bold; }
          .header-right { text-align: right; font-size: 11px; font-weight: bold; line-height: 1.4; }
          .header-right a { color: #000; text-decoration: none; }
          .report-subheader { display: flex; justify-content: space-between; margin-bottom: 12px; }
          .report-title { color: #0f52ba; font-size: 13px; font-weight: bold; }
          .report-meta { font-size: 10px; color: #475569; font-weight: bold; text-align: right; }
          .customer-details-box { display: flex; border: 1px solid #cbd5e1; margin-bottom: 15px; }
          .customer-col { width: 50%; padding: 10px; box-sizing: border-box; }
          .customer-col-right { width: 50%; padding: 10px; box-sizing: border-box; border-left: 1px solid #cbd5e1; }
          .col-label { font-size: 10px; font-weight: bold; color: #475569; margin-bottom: 4px; }
          .col-name { font-size: 12px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
          .col-text { font-size: 10px; color: #475569; line-height: 1.4; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #0f52ba; color: #ffffff; padding: 8px; border: 1px solid #ddd; font-weight: bold; font-size: 11px; text-align: center; }
          td { font-size: 11px; }
          .footer-row td { background-color: #f0f6ff; font-size: 12px; }
          
          /* Fixed footer on bottom page edge */
          .pdf-footer { position: fixed; bottom: -10mm; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #000; padding-top: 8px; box-sizing: border-box; }
          .footer-link { font-size: 11px; font-weight: bold; color: #0f52ba; text-decoration: none; }
          .footer-greet { font-size: 11px; font-weight: bold; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="${API_BASE}/images/head.png" class="logo" />
            <div class="title-group">
              <h1>KSK VASU & Co</h1>
              <p>Building Materials Service Center</p>
            </div>
          </div>
          <div class="header-right">
            <div>📞 <a href="tel:9443350464">9443350464</a></div>
            <div>📞 <a href="tel:9566530464">9566530464</a></div>
          </div>
        </div>

        <div class="report-subheader">
          <div class="report-title">DETAILED ORDER REPORT</div>
          <div class="report-meta">
            <div>Date Range: ${startDate || 'All Time'} to ${endDate || 'Present'}</div>
            <div>Total Orders: ${filteredOrders.length}</div>
          </div>
        </div>
        
        <div class="customer-details-box">
          <div class="customer-col">
            <div class="col-label">To:</div>
            <div class="col-name">${customer.name}</div>
            ${customer.address ? `<div class="col-text">${customer.address}</div>` : ''}
          </div>
          <div class="customer-col-right">
            <div class="col-label">Customer Contact:</div>
            <div class="col-name">Mobile: ${customer.mobile}</div>
            <div class="col-text" style="margin-top: 6px;">Exported on: ${new Date().toLocaleDateString()} ${curTimeStr}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 7%;">S.No</th>
              <th style="width: 48%; text-align: left;">Description / Items</th>
              <th style="width: 10%;">Qty</th>
              <th style="width: 10%;">Unit</th>
              <th style="width: 12%; text-align: right;">Rate</th>
              <th style="width: 13%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${sectionsHtml}
            <tr class="footer-row">
              <td colspan="5" style="text-align: right; padding: 10px; border: 1px solid #ddd; font-weight: bold;">Grand Total</td>
              <td style="text-align: right; padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #0f52ba;">₹${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Page Footer -->
        <div class="pdf-footer">
          <a href="https://www.kskvasu.co.in" class="footer-link">www.kskvasu.co.in</a>
          <span class="footer-greet">Thank You..! Visit Again</span>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintPdf = async (customer) => {
    try {
      const filteredOrders = customer.orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        if (startDate && orderDate < new Date(startDate)) return false;
        if (endDate) {
          const limitDate = new Date(endDate);
          limitDate.setDate(limitDate.getDate() + 1);
          if (orderDate >= limitDate) return false;
        }
        return true;
      });

      if (filteredOrders.length === 0) {
        Alert.alert('No Orders', 'No orders found within this date range.');
        return;
      }

      const html = generateReportHtml(customer, filteredOrders);
      
      Alert.alert(
        'PDF Actions',
        'Would you like to print/save or share this Customer Detailed Orders PDF?',
        [
          {
            text: 'Print / Save',
            onPress: async () => {
              await Print.printAsync({ html });
            }
          },
          {
            text: 'Share PDF',
            onPress: async () => {
              const { uri } = await Print.printToFileAsync({ html });
              const cleanCustomer = customer.name.replace(/[^a-zA-Z0-9_ -]/g, '_');
              const customFilename = `Detailed_Orders_Report_${cleanCustomer}.pdf`;
              const newUri = `${FileSystem.cacheDirectory}${customFilename}`;
              await FileSystem.copyAsync({ from: uri, to: newUri });
              await Sharing.shareAsync(newUri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to generate PDF Report.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading orders count...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer name or mobile..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Customer List */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.mobile}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable 
            style={styles.card}
            onPress={() => {
              setSelectedCustomer(item);
              setStartDate('');
              setEndDate('');
            }}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.orderCount} Orders</Text>
              </View>
            </View>
            <Text style={styles.cardMobile}>📞 {item.mobile}</Text>
            {item.address ? (
              <Text style={styles.cardAddress} numberOfLines={1}>📍 {item.address}</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No customers found.</Text>
          </View>
        }
      />

      {/* Customer Detail & Date Range PDF Modal */}
      {selectedCustomer && (
        <Modal
          visible={!!selectedCustomer}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedCustomer(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedCustomer.name}</Text>
                  <Text style={styles.modalSubtitle}>Mobile: {selectedCustomer.mobile}</Text>
                </View>
                <Pressable onPress={() => setSelectedCustomer(null)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.modalScroll}>
                {/* Date Filters block */}
                <Text style={styles.sectionLabel}>Date Filter (Optional)</Text>
                <View style={styles.dateFilterContainer}>
                  <View style={styles.dateInputWrapper}>
                    <Text style={styles.dateLabel}>Start Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="e.g. 2026-01-01"
                      placeholderTextColor="#94a3b8"
                      value={startDate}
                      onChangeText={setStartDate}
                    />
                  </View>
                  <View style={styles.dateInputWrapper}>
                    <Text style={styles.dateLabel}>End Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="e.g. 2026-12-31"
                      placeholderTextColor="#94a3b8"
                      value={endDate}
                      onChangeText={setEndDate}
                    />
                  </View>
                </View>

                {/* PDF Button */}
                <Pressable 
                  style={styles.pdfBtn}
                  onPress={() => handlePrintPdf(selectedCustomer)}
                >
                  <Text style={styles.pdfBtnText}>📄 Export Detailed Orders PDF</Text>
                </Pressable>

                {/* Order Detailed List */}
                <Text style={styles.sectionLabel}>Detailed Order History</Text>
                {selectedCustomer.orders.map((order, idx) => {
                  const _d = new Date(order.createdAt);
                  const onlyDateStr = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()}`;
                  const orderTime = _d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const displayId = order.customOrderId || (order._id ? order._id.slice(-8).toUpperCase() : 'N/A');
                  const orderTotal = getOrderTotal(order);
                  return (
                    <View key={order._id || idx} style={styles.detailedOrderCard}>
                      {/* Order info bar (2-row grid format to prevent overlap issues on small mobile screens) */}
                      <View style={styles.orderCardHeader}>
                        <Text style={styles.orderIdText}>ID: {displayId}</Text>
                        <Text style={styles.orderDateText}>{onlyDateStr}</Text>
                      </View>
                      <View style={[styles.orderCardHeader, { marginTop: 4, marginBottom: 8 }]}>
                        <Text style={styles.statusBadge}>{order.status || 'Ordered'}</Text>
                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>{orderTime}</Text>
                      </View>

                      {/* Items nested block */}
                      <View style={styles.nestedSection}>
                        <Text style={styles.nestedTitle}>Items</Text>
                        {(order.items || []).map((item, itemIdx) => {
                          const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && item.quantityOrdered === 0);
                          const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
                          const rate = item.price || 0;
                          const amt = qty * rate;
                          return (
                            <View key={item._id || itemIdx} style={styles.nestedRow}>
                              <Text style={styles.nestedItemName} numberOfLines={1}>
                                • {item.name} {item.description ? `(${item.description})` : ''}
                              </Text>
                              <Text style={styles.nestedItemVal}>
                                {isQtyHidden ? '1' : qty} {item.unit || 'Nos'} @ ₹{rate.toFixed(0)} = ₹{amt.toFixed(0)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Adjustments nested block */}
                      {order.adjustments?.length > 0 && (
                        <View style={[styles.nestedSection, { borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 6, paddingTop: 6 }]}>
                          <Text style={styles.nestedTitle}>Adjustments</Text>
                          {order.adjustments.map((adj, adjIdx) => {
                            const amt = adj.amount || 0;
                            const sign = adj.type === 'charge' ? '+' : '-';
                            return (
                              <View key={adj._id || adjIdx} style={styles.nestedRow}>
                                <Text style={styles.nestedAdjDesc} numberOfLines={1}>🔧 {adj.description}</Text>
                                <Text style={[styles.nestedAdjVal, { color: adj.type === 'charge' ? '#ef4444' : '#22c55e' }]}>
                                  {sign}₹{amt.toFixed(2)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Net Total footer */}
                      <View style={styles.orderCardFooter}>
                        <Text style={styles.netTotalLabel}>Net Total:</Text>
                        <Text style={styles.netTotalVal}>₹{orderTotal.toFixed(2)}</Text>
                      </View>
                    </View>
                  );
                })}
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  listContent: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  countBadge: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardMobile: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  cardAddress: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#f1f5f9',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
  },
  modalScroll: {
    padding: spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 10,
    marginTop: 10,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  pdfBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  pdfBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailedOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...shadows.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderDateText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statusBadge: {
    fontSize: 11,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontWeight: '700',
  },
  nestedSection: {
    marginBottom: 8,
  },
  nestedTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 4,
  },
  nestedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  nestedItemName: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    flex: 1.2,
    marginRight: 6,
  },
  nestedItemVal: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'right',
  },
  nestedAdjDesc: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  nestedAdjVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 8,
    gap: 8,
  },
  netTotalLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '800',
  },
  netTotalVal: {
    fontSize: 15,
    color: '#0f52ba',
    fontWeight: '800',
  },
});
