import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BrickSpinner from '../../components/BrickSpinner';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatPrice } from '../../utils/priceFormatter';
import { colors, spacing, shadows } from '../../theme';
import { API_BASE } from '../../config';

// Helper: Convert Numbers to English words for PDF invoice parity
const numberToWords = (num) => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const g = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  
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
  if (num === 0) return 'Zero';
  
  let str = '', i = 0;
  let n = Math.floor(num).toString();
  while (n.length > 0) {
    let g1 = grp(n);
    let f = fmt(g1);
    if (f !== '') str = f + g[i] + ' ' + str;
    n = rem(n);
    i++;
  }
  return str.trim() + ' Only';
};

export default function OrderCard({
  order,
  isExpanded,
  onToggleExpand,
  onStatusChange,
  onRefresh,
  api,
  isAdmin = false,
}) {
  // Existing adjustment & history states
  const [adjModal, setAdjModal] = useState(false);
  const [adjType, setAdjType] = useState('charge');
  const [adjDesc, setAdjDesc] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  
  const [historyModal, setHistoryModal] = useState(false);
  const [deliveryHistory, setDeliveryHistory] = useState([]);

  // 1. Assign Dispatch Agent States
  const [agentModal, setAgentModal] = useState(false);
  const [agentsList, setAgentsList] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('custom');
  const [agent, setAgent] = useState({ name: '', mobile: '', description: '', address: '' });
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));

  // 2. Record Deliveries States
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [deliveryQtys, setDeliveryQtys] = useState({});
  const [deliveryRent, setDeliveryRent] = useState('');
  const [deliveryDateInput, setDeliveryDateInput] = useState(new Date().toISOString().slice(0, 10));

  // 3. Add Custom Items States
  const [customItemModal, setCustomItemModal] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', price: '', unit: 'Brass', quantityOrdered: '1' });
  const [customItemLoading, setCustomItemLoading] = useState(false);

  // 4. Request/Approve Rate Change States
  const [rateChangeModal, setRateChangeModal] = useState(false);
  const [rateChanges, setRateChanges] = useState({});
  const [qtyChanges, setQtyChanges] = useState({});
  const [removedItemIds, setRemovedItemIds] = useState([]);
  const [rateChangeLoading, setRateChangeLoading] = useState(false);
  const [reasonModal, setReasonModal] = useState({ visible: false, targetStatus: null });
  const [reasonText, setReasonText] = useState('');

  // 5. Confirm Delivery Batch States
  const [confirmBatchModal, setConfirmBatchModal] = useState(false);
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [receivedAmount, setReceivedAmount] = useState('');
  const [isNullAction, setIsNullAction] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [confirmBatchLoading, setConfirmBatchLoading] = useState(false);

  // 6. PDF Printing / Payment Details Selector States
  const [printPaymentModal, setPrintPaymentModal] = useState(false);
  const [printPaymentSettings, setPrintPaymentSettings] = useState([]);
  const [selectedPrintPayments, setSelectedPrintPayments] = useState({ primary: null, bank: null });
  const [printWithHeader, setPrintWithHeader] = useState(false);
  const [isPrintLoading, setIsPrintLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [productsList, setProductsList] = useState([]);

  // Calculations
  const itemsTotal =
    order.items?.reduce((sum, item) => {
      const isQtyHidden = item.isQtyNotSpecified || (item.isCustom && (item.quantityOrdered === 0 || item.quantityOrdered == null));
      const qty = isQtyHidden ? 1 : item.quantityOrdered || 0;
      return sum + qty * (item.price || 0);
    }, 0) || 0;

  let adjTotal = 0;
  order.adjustments?.forEach((a) => {
    // charge = adds to bill, advance/payment/less/discount = reduces bill
    if (a.type === 'charge') adjTotal += a.amount;
    else adjTotal -= a.amount;
  });
  const balance = itemsTotal + adjTotal;

  const statusColor = {
    Ordered: colors.gray,
    'Rate Requested': colors.warning,
    'Rate Approved': colors.info,
    Confirmed: colors.primary,
    Delivered: colors.success,
    Completed: colors.success,
    Paused: colors.warning,
    Hold: colors.danger,
    Cancelled: colors.gray,
  };

  // Pre-fill delivery quantities when delivery modal opens
  useEffect(() => {
    if (deliveryModal && order.items) {
      const init = {};
      order.items.forEach((item) => {
        const pid = item.product?._id || item.product || item._id;
        const delivered = item.quantityDelivered || 0;
        const remaining = (item.quantityOrdered || 0) - delivered;
        init[pid] = remaining > 0 ? String(remaining) : '0';
      });
      setDeliveryQtys(init);
    }
  }, [deliveryModal, order.items]);

  // Load delivery agents when Agent Modal opens
  const loadAgentsForDispatch = async () => {
    try {
      setAgentsLoading(true);
      const data = await api.getDeliveryAgents();
      setAgentsList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load agents', e.message);
    } finally {
      setAgentsLoading(false);
    }
  };

  useEffect(() => {
    if (agentModal) {
      loadAgentsForDispatch();
    }
  }, [agentModal]);

  useEffect(() => {
    if (isExpanded) {
      const fetchProducts = async () => {
        try {
          const res = await api.getProducts();
          setProductsList(res.products || []);
        } catch (e) {
          console.warn('Failed to load products for price check', e);
        }
      };
      fetchProducts();
    }
  }, [isExpanded, api]);

  const selectDriver = (driver) => {
    if (driver === 'custom') {
      setSelectedAgentId('custom');
      setAgent({ name: '', mobile: '', description: '', address: '' });
    } else {
      setSelectedAgentId(driver._id);
      setAgent({
        name: driver.name || '',
        mobile: driver.mobile || '',
        description: driver.description || '',
        address: driver.address || '',
      });
    }
  };

  // Actions
  const changeStatus = (status, extra = {}) => {
    Alert.alert('Confirm Status Change', `Are you sure you want to change order status to "${status}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await onStatusChange(order._id, status, extra);
            onRefresh?.();
          } catch (e) {
            Alert.alert('Status Update Error', e.message);
          }
        },
      },
    ]);
  };

  const openReasonModal = (targetStatus) => {
    setReasonText('');
    setReasonModal({ visible: true, targetStatus });
  };

  const submitReasonedStatus = () => {
    const reason = reasonText.trim();
    if (!reason) {
      Alert.alert('Validation Error', 'Please enter a reason.');
      return;
    }
    const target = reasonModal.targetStatus;
    setReasonModal({ visible: false, targetStatus: null });
    setReasonText('');
    changeStatus(target, { pauseReason: reason });
  };

  const addAdjustment = async () => {
    if (!adjDesc || !adjAmount) {
      Alert.alert('Validation Error', 'Description and amount are required.');
      return;
    }
    try {
      await api.addAdjustment(order._id, adjDesc, parseFloat(adjAmount), adjType, new Date().toISOString(), '');
      setAdjModal(false);
      setAdjDesc('');
      setAdjAmount('');
      onRefresh?.();
    } catch (e) {
      Alert.alert('Adjustment Error', e.message);
    }
  };

  const removeAdjustment = (adjustmentId) => {
    Alert.alert('Remove Adjustment', 'Are you sure you want to delete this adjustment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.removeAdjustment(order._id, adjustmentId);
            onRefresh?.();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  // 1. Assign Dispatch Agent
  const assignAgent = async () => {
    if (!agent.name?.trim()) {
      Alert.alert('Validation Error', 'Agent name is required');
      return;
    }
    try {
      await api.assignAgent(
        order._id,
        agent.name.trim(),
        agent.mobile.trim(),
        agent.description.trim(),
        agent.address.trim(),
        dispatchDate
      );
      setAgentModal(false);
      onRefresh?.();
    } catch (e) {
      Alert.alert('Dispatch Error', e.message);
    }
  };

  // 2. Record Deliveries
  const openHistory = async () => {
    try {
      const h = await api.getDeliveryHistory(order._id);
      setDeliveryHistory(h || []);
      setHistoryModal(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const recordDelivery = async () => {
    const deliveries = order.items
      .map((item) => {
        const pid = item.product?._id || item.product || item._id;
        const qty = parseFloat(deliveryQtys[pid]) || 0;
        if (qty <= 0) return null;
        return {
          product: pid,
          quantityDelivered: qty,
          orderItemId: item._id,
        };
      })
      .filter(Boolean);

    if (deliveries.length === 0) {
      Alert.alert('Validation Error', 'Please enter a quantity greater than 0 for at least one item.');
      return;
    }

    try {
      await api.recordDelivery(
        order._id,
        deliveries,
        parseFloat(deliveryRent) || 0,
        deliveryDateInput
      );
      setDeliveryModal(false);
      setDeliveryRent('');
      onRefresh?.();
    } catch (e) {
      Alert.alert('Delivery Error', e.message);
    }
  };

  // 3. Add Custom Item
  const handleAddCustomItem = async () => {
    if (!customItem.name.trim() || !customItem.price || !customItem.quantityOrdered) {
      Alert.alert('Validation Error', 'Please fill all item fields.');
      return;
    }
    try {
      setCustomItemLoading(true);
      await api.addCustomItem(order._id, {
        name: customItem.name.trim(),
        price: parseFloat(customItem.price),
        unit: customItem.unit,
        quantityOrdered: parseFloat(customItem.quantityOrdered),
      });
      Alert.alert('Success', 'Custom material added to this order.');
      setCustomItemModal(false);
      setCustomItem({ name: '', price: '', unit: 'Brass', quantityOrdered: '1' });
      onRefresh?.();
    } catch (e) {
      Alert.alert('Add Item Error', e.message || 'Failed to add custom item.');
    } finally {
      setCustomItemLoading(false);
    }
  };

  // 4. Request Rate Change
  const openRateChangeModal = () => {
    const initialChanges = {};
    const initialQtys = {};
    order.items?.forEach((item) => {
      initialChanges[item._id] = String(item.price || 0);
      initialQtys[item._id] = String(item.quantityOrdered || 0);
    });
    setRateChanges(initialChanges);
    setQtyChanges(initialQtys);
    setRemovedItemIds([]);
    setRateChangeModal(true);
  };

  const handleRateChangeUpdate = (itemId, val) => {
    setRateChanges((prev) => ({ ...prev, [itemId]: val }));
  };

  const handleQtyChangeUpdate = (itemId, val) => {
    setQtyChanges((prev) => ({ ...prev, [itemId]: val }));
  };

  const getNewProposedTotal = () => {
    const visibleItems = order.items?.filter(item => !removedItemIds.includes(item._id)) || [];
    return visibleItems.reduce((sum, item) => {
      const qty = parseFloat(qtyChanges[item._id]) || 0;
      const rate = parseFloat(rateChanges[item._id]) || 0;
      return sum + qty * rate;
    }, 0) || 0;
  };

  const submitRateChange = async () => {
    // 1. Gather all updated items excluding the removed ones
    const visibleItems = order.items?.filter(item => !removedItemIds.includes(item._id)) || [];
    const updatedItems = visibleItems.map((item) => {
      const pid = item.product?._id || item.product || item._id;
      const price = rateChanges[item._id] !== undefined ? parseFloat(rateChanges[item._id]) : item.price;
      const quantity = qtyChanges[item._id] !== undefined ? parseFloat(qtyChanges[item._id]) : item.quantityOrdered;
      return {
        productId: pid.toString(),
        quantity: quantity,
        price: price,
        isCustom: item.isCustom || false,
        name: item.name,
        unit: item.unit,
        description: item.description,
      };
    });

    if (updatedItems.length === 0) {
      Alert.alert('Validation Error', 'Cannot save an empty order. Please keep at least one item.');
      return;
    }

    // 2. Check if there are any price changes compared to the current order item price
    let isPriceChanged = false;
    visibleItems.forEach((item) => {
      const newPrice = rateChanges[item._id] !== undefined ? parseFloat(rateChanges[item._id]) : item.price;
      if (Math.abs(newPrice - item.price) > 0.01) {
        isPriceChanged = true;
      }
    });

    try {
      setRateChangeLoading(true);
      
      // 3. Admin vs Staff flow control
      if (isAdmin) {
        // Admins save and apply edits immediately without pending status
        await api.editOrder(order._id, updatedItems);
        Alert.alert('Success', 'Order changes applied directly by Admin.');
      } else {
        // Staff requests a rate change if prices differ, else saves quantity updates directly
        if (isPriceChanged) {
          await api.requestRateChange(order._id, updatedItems);
          Alert.alert('Success', 'Rate revision request submitted to Admin.');
        } else {
          await api.editOrder(order._id, updatedItems);
          Alert.alert('Success', 'Order changes successfully applied.');
        }
      }
      
      setRateChangeModal(false);
      onRefresh?.();
    } catch (e) {
      Alert.alert('Order Edit Error', e.message || 'Failed to apply order changes.');
    } finally {
      setRateChangeLoading(false);
    }
  };

  const approveRate = () => {
    Alert.alert('Approve Rate Request', 'Are you sure you want to approve this rate change request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            await api.approveRate(order._id);
            Alert.alert('Success', 'Rates have been approved successfully.');
            onRefresh?.();
          } catch (e) {
            Alert.alert('Approval Error', e.message || 'Failed to approve rate change.');
          }
        },
      },
    ]);
  };

  // 5. Confirm Delivery Batch
  const handleConfirmBatch = async () => {
    try {
      setConfirmBatchLoading(true);
      await api.confirmDeliveryBatch(
        order._id,
        batchDate,
        parseFloat(receivedAmount) || 0,
        isNullAction,
        paymentMode
      );
      Alert.alert('Success', 'Batch delivery and payments successfully confirmed.');
      setConfirmBatchModal(false);
      setReceivedAmount('');
      setIsNullAction(false);
      onRefresh?.();
    } catch (e) {
      Alert.alert('Confirmation Error', e.message || 'Failed to confirm delivery batch.');
    } finally {
      setConfirmBatchLoading(false);
    }
  };

  // 6. Native Order PDF Builder (With / Without Header Toggles)
  const handleOpenPrintModal = async (withHeaderVal) => {
    try {
      setIsPrintLoading(true);
      const settings = await api.getPaymentSettings();
      setPrintPaymentSettings(Array.isArray(settings) ? settings : []);
      setPrintWithHeader(withHeaderVal);
      setSelectedPrintPayments({ primary: null, bank: null });
      setPrintPaymentModal(true);
    } catch (e) {
      Alert.alert(
        'Warning',
        'Could not fetch active payment gateways. Generating plain PDF estimate directly.',
        [
          {
            text: 'Proceed',
            onPress: () => generateBillPDFDirect(withHeaderVal, { primary: null, bank: null }),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setIsPrintLoading(false);
    }
  };



  const generateBillPDFDirect = async (headerFlag, chosenGateways) => {
    try {
      setIsGeneratingPDF(true);
      
      const orderId = order.customOrderId || order._id.slice(-8);
      const _d = new Date(order.createdAt || new Date());
      const orderDate = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()}`;
      
      const itemRowsHtml = order.items?.map((item, idx) => {
        const isQtyNotSpecified = item.quantityOrdered === 0 || item.quantityOrdered == null;
        const qty = item.isCustom && isQtyNotSpecified ? 1 : item.quantityOrdered || 0;
        const amount = qty * (item.price || 0);
        return `
          <tr>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 11px;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">${item.product?.name || item.name} ${item.description ? `(${item.description})` : ''}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">${qty}</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 10px;">${item.product?.unit || item.unit || 'Nos'}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">${formatPrice(item.price)}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">${formatPrice(amount)}</td>
          </tr>
        `;
      }).join('') || '';

      const adjRowsHtml = order.adjustments?.map((a) => {
        const isDeduct = ['discount', 'payment', 'less'].includes(a.type);
        const prefix = isDeduct ? '-' : '+';
        return `
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3.5px; color: #000; font-weight: bold;">
            <span>${a.description || a.type.toUpperCase()}:</span>
            <span>${prefix} ${formatPrice(a.amount)}</span>
          </div>
        `;
      }).join('') || '';

      let bankHtml = '';
      if (chosenGateways.bank) {
        const b = chosenGateways.bank;
        bankHtml = `
          <div style="font-size: 9px; line-height: 1.4; color: #000; font-weight: bold; flex: 1.2;">
            <div>A/C Name: ${b.accountName || '—'}</div>
            <div>Bank: ${b.name || '—'}</div>
            <div>A/C No: ${b.accountNumber || '—'}</div>
            <div>IFSC: ${b.ifsc || '—'}</div>
          </div>
        `;
      }

      let qrHtml = '';
      if (chosenGateways.primary && chosenGateways.primary.qrCode) {
        qrHtml = `
          <div style="text-align: center; display: flex; align-items: center; justify-content: center; width: 62px; height: 62px; border-left: 1px solid #000; padding-left: 8px; flex: 0.8;">
            <img src="${chosenGateways.primary.qrCode}" style="width: 58px; height: 58px; object-fit: contain;"/>
          </div>
        `;
      }

      const html = `
        <html>
        <head>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700&display=swap" rel="stylesheet">
           <style>
             @page { size: A5 portrait; margin: 0; }
             body { font-family: 'Mukta Malar', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; width: 148mm; height: 210mm; padding: 8mm; margin: 0; box-sizing: border-box; position: relative; }
             .invoice-box { border: 2.5px solid #000; padding: 10px; height: 184mm; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; position: relative; z-index: 1; }
             .header-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
             .title { text-align: center; font-size: 14.5px; font-weight: bold; margin: 2px 0; letter-spacing: 0.5px; color: #000; }
             .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
            .meta-td { padding: 6px; vertical-align: middle; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: auto; }
            th { background-color: #d1d5db; padding: 6px; border: 1px solid #000; font-size: 10px; font-weight: bold; color: #000; text-align: center; }
            .totals-section { display: flex; border-top: 2px solid #000; margin-top: 6px; min-height: 38mm; }
            .words-col { width: 58%; padding: 6px 8px 4px 6px; display: flex; flex-direction: column; justify-content: space-between; }
            .adj-col { width: 42%; border-left: 2px solid #000; padding: 6px 8px 4px 8px; display: flex; flex-direction: column; justify-content: space-between; }
            .watermark-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; z-index: -1; pointer-events: none; opacity: 0.08; }
            .watermark { width: 85%; max-width: 340px; height: auto; }
          </style>
        </head>
        <body>
          ${headerFlag ? `
            <div class="watermark-container">
              <img src="${API_BASE}/images/head.png" class="watermark" />
            </div>
          ` : ''}
          <div class="invoice-box">
            ${headerFlag ? `
              <table class="header-table">
                <tr>
                  <td style="width: 12%; vertical-align: middle;">
                    <img src="${API_BASE}/images/head.png" style="width: 52px; height: 52px; object-fit: contain;" />
                  </td>
                  <td style="width: 53%; padding-left: 8px; vertical-align: middle;">
                    <div style="font-size: 19px; font-weight: 800; color: #000; letter-spacing: 0.3px; line-height: 1.2;">KSK VASU & Co</div>
                    <div style="font-size: 10px; color: #000; font-weight: bold; margin-top: 2px;">Building Materials Service Center</div>
                  </td>
                  <td style="width: 35%; text-align: right; font-size: 12.5px; font-weight: bold; vertical-align: middle; color: #000; line-height: 1.4;">
                    <div>📞 9443350464</div>
                    <div>📞 9566530464</div>
                  </td>
                </tr>
              </table>
            ` : `<div style="height: 5px;"></div>`}

            <div style="border-top: 2px solid #000; margin-top: 2px;"></div>
            <div class="title" style="margin-top: 4px; margin-bottom: 4px;">ESTIMATE</div>
            <div style="text-align: right; font-size: 11.5px; font-weight: bold; margin-top: -21px; margin-bottom: 6px; color: #000;">No : ${orderId}</div>

            <table class="meta-table">
              <tr>
                <td class="meta-td" style="width: 58%; border-right: 2px solid #000;">
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-size: 13px; font-weight: 800; color: #000;">${order.user?.name || 'Walk-in Customer'}</span>
                    ${order.user?.mobile ? `<span style="font-size: 11.5px; font-weight: bold; color: #000; display: flex; align-items: center; gap: 3px;">📱 ${order.user.mobile}</span>` : ''}
                  </div>
                  ${order.user?.address ? `<div style="margin-top: 3px; color: #000; font-size: 9.5px; font-weight: bold;">Address: ${order.user.address}</div>` : ''}
                </td>
                <td class="meta-td" style="width: 42%; padding-left: 10px; font-size: 11px; font-weight: bold; line-height: 1.5; color: #000;">
                  <div style="display: flex; justify-content: space-between;">
                    <span>Date</span>
                    <span>: ${orderDate}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>Status</span>
                    <span style="text-transform: capitalize;">: ${order.status}</span>
                  </div>
                </td>
              </tr>
            </table>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 8%;">S.No</th>
                  <th style="width: 47%;">Description</th>
                  <th style="width: 10%;">Qty</th>
                  <th style="width: 10%;">Unit</th>
                  <th style="width: 12%;">Rate (₹)</th>
                  <th style="width: 13%;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${itemRowsHtml}
                <tr style="background-color: #e5e7eb; font-weight: bold;">
                  <td colspan="5" style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; color: #000;">Gross Amount</td>
                  <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; color: #000;">${formatPrice(itemsTotal)}</td>
                </tr>
              </tbody>
            </table>

            <div class="totals-section">
              <div class="words-col">
                <div>
                  ${balance > 0.01 ? `
                    <div style="font-size: 11.5px; font-weight: bold; line-height: 1.3; color: #000; margin-bottom: 2px;">
                      Rupees ${numberToWords(balance)}
                    </div>
                  ` : ''}
                  <div style="font-size: 9.5px; color: #000; font-weight: bold; margin-top: 2px; margin-bottom: 4px;">Payment Details,</div>
                </div>
                
                <div style="display: flex; border: 1px solid #000; padding: 6px; border-radius: 4px; align-items: center; justify-content: space-between;">
                  ${bankHtml}
                  ${qrHtml}
                </div>
              </div>
              
              <div class="adj-col">
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3.5px; color: #000; font-weight: bold;">
                    <span>Gross Amount (₹) :</span>
                    <span>${formatPrice(itemsTotal)}</span>
                  </div>
                  ${adjRowsHtml}
                </div>
                <div>
                  <div style="border-top: 1.5px solid #000; margin: 3px 0;"></div>
                  <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; color: #000; padding-top: 2px;">
                    <span>Total (₹) :</span>
                    <span>${formatPrice(balance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 11.5px; font-weight: bold; margin-top: 5px; padding: 0 4px; box-sizing: border-box;">
            <a href="https://www.kskvasu.co.in" style="color: #0f52ba; text-decoration: underline; z-index: 10;">www.kskvasu.co.in</a>
            <span style="color: #334155;">Thank You..! Visit Again</span>
          </div>
        </body>
        </html>
      `;

      Alert.alert(
        'PDF Options',
        'Would you like to download or share the A5 order PDF?',
        [
          {
            text: 'Download / Print',
            onPress: async () => {
              try {
                setIsGeneratingPDF(true);
                const { uri } = await Print.printToFileAsync({
                  html,
                  width: 420,
                  height: 595
                });
                await Print.printAsync({ uri });
              } catch (e) {
                Alert.alert('Print Error', e.message);
              } finally {
                setIsGeneratingPDF(false);
                setPrintPaymentModal(false);
              }
            }
          },
          {
            text: 'Share PDF',
            onPress: async () => {
              try {
                setIsGeneratingPDF(true);
                const { uri } = await Print.printToFileAsync({
                  html,
                  width: 420,
                  height: 595
                });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
              } catch (e) {
                Alert.alert('Share Error', e.message);
              } finally {
                setIsGeneratingPDF(false);
                setPrintPaymentModal(false);
              }
            }
          },
          { text: 'Cancel', style: 'cancel', onPress: () => setIsGeneratingPDF(false) }
        ]
      );
    } catch (e) {
      Alert.alert('PDF Print Failure', e.message || 'Failed to compile and share order PDF.');
      setIsGeneratingPDF(false);
    }
  };

  // Dispatch Batch PDF: Generate PDF for a specific dispatch batch (with or without header)
  const generateDispatchBatchPDF = async (batch, headerFlag) => {
    try {
      const orderId = order.customOrderId || order._id.slice(-8);
      const batchId = batch.dispatchId !== 'ungrouped' ? batch.dispatchId.slice(-6) : `B${Date.now().toString().slice(-4)}`;
      const batchDateObj = batch.date ? new Date(batch.date) : new Date();
      const dateStr = `${String(batchDateObj.getDate()).padStart(2, '0')}/${String(batchDateObj.getMonth() + 1).padStart(2, '0')}/${batchDateObj.getFullYear()}`;

      // Calculate batch total using order item prices
      let batchTotal = 0;
      const itemRowsHtml = (batch.items || []).map((bi, idx) => {
        const orderItem = order.items?.find(
          (oi) => oi._id?.toString() === bi.orderItemId?.toString() ||
                   (oi.product?._id || oi.product)?.toString() === bi.product?.toString()
        );
        const itemName = orderItem?.product?.name || orderItem?.name || bi.name || 'Item';
        const unit = orderItem?.product?.unit || orderItem?.unit || bi.unit || 'Nos';
        const qty = bi.quantityDelivered || 0;
        const rate = orderItem?.price || 0;
        const amount = qty * rate;
        batchTotal += amount;
        return `
          <tr>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 11px;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">${itemName}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">${qty}</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #000; font-size: 10px;">${unit}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px;">${formatPrice(rate)}</td>
            <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; font-weight: bold;">${formatPrice(amount)}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <html>
        <head>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700&display=swap" rel="stylesheet">
          <style>
             @page { size: A5 portrait; margin: 0; }
             body { font-family: 'Mukta Malar', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; width: 148mm; height: 210mm; padding: 8mm; margin: 0; box-sizing: border-box; position: relative; }
             .invoice-box { border: 2.5px solid #000; padding: 10px; height: 184mm; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; position: relative; z-index: 1; }
             .header-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
             .title { text-align: center; font-size: 14.5px; font-weight: bold; margin: 2px 0; color: #000; }
             .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
            .meta-td { padding: 6px; vertical-align: middle; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: auto; }
            th { background-color: #d1d5db; padding: 6px; border: 1px solid #000; font-size: 10px; font-weight: bold; color: #000; text-align: center; }
            .totals-section { display: flex; border-top: 2px solid #000; margin-top: 6px; min-height: 38mm; }
            .words-col { width: 58%; padding: 6px 8px 4px 6px; display: flex; flex-direction: column; justify-content: space-between; }
            .adj-col { width: 42%; border-left: 2px solid #000; padding: 6px 8px 4px 8px; display: flex; flex-direction: column; justify-content: space-between; }
            .watermark-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; z-index: -1; pointer-events: none; opacity: 0.08; }
            .watermark { width: 85%; max-width: 340px; height: auto; }
          </style>
        </head>
        <body>
          ${headerFlag ? `
            <div class="watermark-container">
              <img src="${API_BASE}/images/head.png" class="watermark" />
            </div>
          ` : ''}
          <div class="invoice-box">
            ${headerFlag ? `
              <table class="header-table">
                <tr>
                  <td style="width: 12%; vertical-align: middle;">
                    <img src="${API_BASE}/images/head.png" style="width: 52px; height: 52px; object-fit: contain;" />
                  </td>
                  <td style="width: 53%; padding-left: 8px; vertical-align: middle;">
                    <div style="font-size: 19px; font-weight: 800; color: #000; letter-spacing: 0.3px; line-height: 1.2;">KSK VASU &amp; Co</div>
                    <div style="font-size: 10px; color: #000; font-weight: bold; margin-top: 2px;">Building Materials Service Center</div>
                  </td>
                  <td style="width: 35%; text-align: right; font-size: 12.5px; font-weight: bold; vertical-align: middle; color: #000; line-height: 1.4;">
                    <div>📞 9443350464</div>
                    <div>📞 9566530464</div>
                  </td>
                </tr>
              </table>
            ` : `<div style="height: 5px;"></div>`}

            <div style="border-top: 2px solid #000; margin-top: 2px;"></div>
            <div class="title" style="margin-top: 4px; margin-bottom: 4px;">DISPATCH ESTIMATE</div>
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: bold; margin-bottom: 6px; color: #000;">
              <span>Order No : ${orderId}</span>
              <span>Dispatch : #${batchId}</span>
            </div>

            <table class="meta-table">
              <tr>
                <td class="meta-td" style="width: 58%; border-right: 2px solid #000;">
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-size: 13px; font-weight: 800; color: #000;">${order.user?.name || 'Walk-in Customer'}</span>
                    ${order.user?.mobile ? `<span style="font-size: 11.5px; font-weight: bold; color: #000; display: flex; align-items: center; gap: 3px;">📱 ${order.user.mobile}</span>` : ''}
                  </div>
                  ${order.user?.address ? `<div style="margin-top: 3px; color: #000; font-size: 9.5px; font-weight: bold;">Address: ${order.user.address}</div>` : ''}
                </td>
                <td class="meta-td" style="width: 42%; padding-left: 10px; font-size: 11px; font-weight: bold; line-height: 1.5; color: #000;">
                  <div style="display: flex; justify-content: space-between;">
                    <span>Date</span>
                    <span>: ${dateStr}</span>
                  </div>
                  ${batch.agentName ? `<div style="display: flex; justify-content: space-between;"><span>Driver</span><span>: ${batch.agentName}</span></div>` : ''}
                </td>
              </tr>
            </table>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 8%;">S.No</th>
                  <th style="width: 47%;">Description</th>
                  <th style="width: 10%;">Qty</th>
                  <th style="width: 10%;">Unit</th>
                  <th style="width: 12%;">Rate (Rs.)</th>
                  <th style="width: 13%;">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                ${itemRowsHtml}
                <tr style="background-color: #e5e7eb; font-weight: bold;">
                  <td colspan="5" style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; color: #000;">Dispatch Gross Total</td>
                  <td style="text-align: right; padding: 6px; border: 1px solid #000; font-size: 11px; color: #000;">Rs. ${formatPrice(batchTotal)}</td>
                </tr>
              </tbody>
            </table>

            <div class="totals-section">
              <div class="words-col">
                <div>
                  ${batchTotal > 0.01 ? `
                    <div style="font-size: 11.5px; font-weight: bold; line-height: 1.3; color: #000; margin-bottom: 2px;">
                      Rupees ${numberToWords(Math.round(batchTotal))}
                    </div>
                  ` : ''}
                  <div style="font-size: 9.5px; color: #000; font-weight: bold; margin-top: 2px; margin-bottom: 4px;">Payment Details,</div>
                </div>
                
                <div style="display: flex; border: 1px solid #000; padding: 6px; border-radius: 4px; align-items: center; justify-content: space-between;">
                  <div style="font-size: 9px; line-height: 1.4; color: #000; font-weight: bold; flex: 1.2;">
                    <div>A/C Name: KSK VASU & Co</div>
                    <div>Bank: SBI - Anthiyur</div>
                    <div>A/C No: 41829764244</div>
                    <div>IFSC: SBIN0011939</div>
                  </div>
                </div>
              </div>
              
              <div class="adj-col" style="justify-content: flex-end;">
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; color: #000; padding-top: 2px;">
                    <span>Total (Rs.) :</span>
                    <span>${formatPrice(batchTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 11.5px; font-weight: bold; margin-top: 5px; padding: 0 4px; box-sizing: border-box;">
            <a href="https://www.kskvasu.co.in" style="color: #0f52ba; text-decoration: underline; z-index: 10;">www.kskvasu.co.in</a>
            <span style="color: #334155;">Thank You..! Visit Again</span>
          </div>
        </body>
        </html>
      `;

      Alert.alert(
        'PDF Options',
        'Would you like to download or share the A5 dispatch PDF?',
        [
          {
            text: 'Download / Print',
            onPress: async () => {
              try {
                const { uri } = await Print.printToFileAsync({
                  html,
                  width: 420,
                  height: 595
                });
                await Print.printAsync({ uri });
              } catch (e) {
                Alert.alert('Print Error', e.message);
              }
            }
          },
          {
            text: 'Share PDF',
            onPress: async () => {
              try {
                const { uri } = await Print.printToFileAsync({
                  html,
                  width: 420,
                  height: 595
                });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
              } catch (e) {
                Alert.alert('Share Error', e.message);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (e) {
      Alert.alert('Dispatch PDF Error', e.message || 'Failed to generate dispatch batch PDF.');
    }
  };

  // Actions setup
  const renderActions = () => {
    const s = order.status;
    const actions = [];
    
    // Core PDF Print Buttons
    actions.push(['📄 Print Plain PDF', () => handleOpenPrintModal(false)]);
    actions.push(['🏢 Print PDF (with Header)', () => handleOpenPrintModal(true)]);

    if (s === 'Ordered') {
      actions.push(['✏️ Edit Order', openRateChangeModal]);
      actions.push(['➕ Custom Material', () => setCustomItemModal(true)]);
      actions.push(['✅ Confirm Order', () => changeStatus('Confirmed')]);
      actions.push(['⏸️ Pause', () => openReasonModal('Paused')]);
      actions.push(['🛑 Hold', () => openReasonModal('Hold')]);
      actions.push(['❌ Cancel', () => changeStatus('Cancelled')]);
    }
    if (s === 'Rate Requested') {
      actions.push(['✏️ Edit Order', openRateChangeModal]);
      actions.push(['➕ Custom Material', () => setCustomItemModal(true)]);
      if (isAdmin) {
        actions.push(['👍 Approve Rate', () => changeStatus('Rate Approved')]);
        actions.push(['❌ Decline Rate Request', () => changeStatus('Ordered')]);
      } else {
        actions.push(['❌ Cancel Rate Request', () => changeStatus('Ordered')]);
      }
    }
    if (s === 'Rate Approved') {
      actions.push(['✏️ Edit Order', openRateChangeModal]);
      actions.push(['➕ Custom Material', () => setCustomItemModal(true)]);
      actions.push(['✅ Confirm Order', () => changeStatus('Confirmed')]);
      if (isAdmin) {
        actions.push(['❌ Decline Rate Request', () => changeStatus('Ordered')]);
      } else {
        actions.push(['❌ Cancel Rate Request', () => changeStatus('Ordered')]);
      }
    }
    if (s === 'Confirmed') {
      actions.push(['✏️ Edit Order', openRateChangeModal]);
      actions.push(['🛑 Hold', () => openReasonModal('Hold')]);
    }
    if (s.startsWith('Dispatch') || s === 'Partially Delivered') {
      actions.push(['📦 Record Partial Delivery', () => setDeliveryModal(true)]);
      actions.push(['💵 Confirm Batch Payment', () => setConfirmBatchModal(true)]);
      actions.push(['🏁 Complete Delivery', () => changeStatus('Delivered')]);
      actions.push(['✏️ Edit Order', openRateChangeModal]);
    }
    if (s === 'Paused' || s === 'Hold') {
      actions.push(['✏️ Edit Order', openRateChangeModal]);
      actions.push(['🔄 Resume Order', () => changeStatus('Ordered')]);
      actions.push(['📝 Update Reason', () => {
        setReasonText(order.pauseReason || '');
        setReasonModal({ visible: true, targetStatus: s });
      }]);
    }
    if (s !== 'Cancelled') {
      actions.push(['📋 Delivery Logs', openHistory]);
    }
    if (s !== 'Cancelled' && s !== 'Completed' && s !== 'Delivered') {
      actions.push(['💵 Adjustment / Advance', () => setAdjModal(true)]);
    }
    
    // Administrative Deletion
    if (isAdmin && s !== 'Cancelled') {
      actions.push(['🗑️ Delete Order', () => {
        Alert.alert('Delete Order', 'Are you sure you want to delete this order? It will be moved to the recycle bin.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteOrder(order._id);
                onRefresh?.();
              } catch (e) {
                Alert.alert('Error', e.message);
              }
            },
          },
        ]);
      }]);
    }
    return actions;
  };

  return (
    <View style={[styles.card, isExpanded && styles.expandedCard]}>
      {/* Header Summary */}
      <Pressable onPress={onToggleExpand} style={styles.cardHeader}>
        <View style={styles.headerInfo}>
          <View style={styles.idRow}>
            <Text style={styles.id}>#{order.customOrderId || order._id.slice(-8)}</Text>
            <View style={[styles.badge, { backgroundColor: statusColor[order.status] || '#666' }]}>
              <Text style={styles.badgeText}>{order.status}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{order.user?.name || 'Walk-in Customer'}</Text>
          <Text style={styles.userPhone}>📞 {order.user?.mobile || 'No Phone'}</Text>
        </View>
        <View style={styles.headerPricing}>
           {isPrintLoading ? (
             <BrickSpinner size="small" color={colors.primary} />
           ) : (
            <>
              <Text style={styles.priceLabel}>Balance Due</Text>
              <Text style={[styles.priceVal, balance > 0 ? { color: colors.danger } : { color: colors.success }]}>
                ₹{formatPrice(balance)}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      {/* Expanded Actions & Breakdown */}
      {isExpanded && (
        <View style={styles.cardBody}>
          <View style={styles.sectionDivider} />
          
          <Text style={styles.sectionTitle}>Material Breakdowns ({order.items?.length || 0})</Text>
          {order.items?.map((item, i) => {
            const delivered = item.quantityDelivered || 0;
            const ordered = item.quantityOrdered || 0;
            const pid = item.product?._id || item.product || item._id;

            const isRateStatus = order.status === 'Rate Requested' || order.status === 'Rate Approved';
            const originalProduct = productsList.find(p => p._id === (item.product?._id || item.product)?.toString());
            const originalPrice = originalProduct ? originalProduct.price : item.price;
            const isPriceChanged = isRateStatus && Math.abs(item.price - originalPrice) > 0.01;

            return (
              <View key={pid + '-' + i} style={[styles.itemRow, isPriceChanged && styles.highlightedItemRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {item.product?.name || item.name} {item.isCustom ? ' (Custom)' : ''}
                  </Text>
                  <Text style={styles.itemDeliveries}>
                    Dispatched: <Text style={styles.boldText}>{delivered}</Text> / {ordered} {item.product?.unit || item.unit}
                  </Text>
                </View>
                <Text style={[styles.itemPrice, isPriceChanged && styles.highlightedPriceText]}>
                  ₹{formatPrice(item.price)} per {item.product?.unit || item.unit}
                </Text>
              </View>
            );
          })}

          {/* Adjustments Summary */}
          {order.adjustments && order.adjustments.length > 0 && (
            <View style={styles.adjContainer}>
              <Text style={styles.sectionTitle}>Finances & Adjustments</Text>
              {order.adjustments.map((a) => (
                <Pressable
                  key={a._id}
                  onLongPress={() => removeAdjustment(a._id)}
                  style={styles.adjRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adjTypeLabel}>
                      {a.type.toUpperCase()} — {a.description || 'Adjustment'}
                    </Text>
                    <Text style={styles.adjHelp}>Hold to delete adjustment</Text>
                  </View>
                  <Text style={[styles.adjVal, a.type === 'charge' || a.type === 'advance' ? { color: colors.danger } : { color: colors.success }]}>
                    {a.type === 'charge' || a.type === 'advance' ? '+' : '-'} ₹{formatPrice(a.amount)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {(order.status === 'Paused' || order.status === 'Hold') && !!order.pauseReason && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>
                Reason: <Text style={styles.reasonTextStrong}>{order.pauseReason}</Text>
              </Text>
            </View>
          )}

          {/* Render Action Buttons */}
          <Text style={styles.sectionTitle}>Management Actions</Text>
          <View style={styles.actionsGrid}>
            {renderActions().map(([label, fn], idx) => (
              <Pressable
                key={label + '-' + idx}
                style={[
                  styles.actionButton,
                  label.includes('Delete') && styles.deleteActionButton,
                  label.includes('Print') && styles.printActionButton,
                ]}
                onPress={fn}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    label.includes('Delete') && { color: '#fff' },
                    label.includes('Print') && { color: '#fff' },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* MODAL 1: Adjustments / Advance Form */}
      <Modal visible={adjModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>Add Finanical Adjustment</Text>
              <Pressable onPress={() => setAdjModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Adjustment Type</Text>
              <View style={styles.segmentRow}>
                {['charge', 'discount', 'advance', 'payment', 'less'].map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.segmentBtn, adjType === t && styles.segmentBtnActive]}
                    onPress={() => setAdjType(t)}
                  >
                    <Text style={[styles.segmentText, adjType === t && styles.segmentTextActive]}>
                      {t.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Brief Description</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Extra Transport Rent, Promo Offer"
                value={adjDesc}
                onChangeText={setAdjDesc}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="0.00"
                value={adjAmount}
                onChangeText={setAdjAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />

              <Pressable style={styles.saveSubmitBtn} onPress={addAdjustment}>
                <Text style={styles.saveSubmitBtnText}>Save Financial Adjustment</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Assign Dispatch Agent Form */}
      <Modal visible={agentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>Assign Dispatch Driver</Text>
              <Pressable onPress={() => setAgentModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Select Driver from Registry</Text>
              
               {agentsLoading ? (
                 <BrickSpinner size="small" color={colors.primary} style={{ marginVertical: 12 }} />
               ) : (
                <View style={styles.driversGrid}>
                  <Pressable
                    style={[styles.driverCard, selectedAgentId === 'custom' && styles.driverCardActive]}
                    onPress={() => selectDriver('custom')}
                  >
                    <Text style={styles.driverEmoji}>🧑‍✈️</Text>
                    <Text style={styles.driverNameLabel}>Custom Driver</Text>
                    <Text style={styles.driverPhoneLabel}>Manual entry</Text>
                  </Pressable>
                  
                  {agentsList.map((drv) => (
                    <Pressable
                      key={drv._id}
                      style={[styles.driverCard, selectedAgentId === drv._id && styles.driverCardActive]}
                      onPress={() => selectDriver(drv)}
                    >
                      <Text style={styles.driverEmoji}>🚛</Text>
                      <Text style={styles.driverNameLabel} numberOfLines={1}>
                        {drv.name}
                      </Text>
                      <Text style={styles.driverPhoneLabel}>{drv.mobile || 'No contact'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Driver Credentials</Text>
              <TextInput
                style={[styles.formInput, selectedAgentId !== 'custom' && styles.disabledInput]}
                placeholder="Driver Name"
                value={agent.name}
                onChangeText={(v) => setAgent((a) => ({ ...a, name: v }))}
                editable={selectedAgentId === 'custom'}
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.formInput, selectedAgentId !== 'custom' && styles.disabledInput]}
                placeholder="Mobile Contact"
                value={agent.mobile}
                onChangeText={(v) => setAgent((a) => ({ ...a, mobile: v }))}
                keyboardType="phone-pad"
                maxLength={10}
                editable={selectedAgentId === 'custom'}
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.formInput, selectedAgentId !== 'custom' && styles.disabledInput]}
                placeholder="Vehicle Number / Info"
                value={agent.description}
                onChangeText={(v) => setAgent((a) => ({ ...a, description: v }))}
                editable={selectedAgentId === 'custom'}
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.formInput, selectedAgentId !== 'custom' && styles.disabledInput]}
                placeholder="Agent Physical Address"
                value={agent.address}
                onChangeText={(v) => setAgent((a) => ({ ...a, address: v }))}
                editable={selectedAgentId === 'custom'}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Dispatch Log Date</Text>
              <TextInput
                style={styles.formInput}
                placeholder="YYYY-MM-DD"
                value={dispatchDate}
                onChangeText={setDispatchDate}
                placeholderTextColor={colors.textMuted}
              />

              <Pressable style={styles.saveSubmitBtn} onPress={assignAgent}>
                <Text style={styles.saveSubmitBtnText}>Assign Driver & Dispatch</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Record Deliveries Form */}
      <Modal visible={deliveryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>Record Batch Delivery</Text>
              <Pressable onPress={() => setDeliveryModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.helperLabel}>
                Specify material counts delivered in this batch shipment:
              </Text>

              {order.items?.map((item) => {
                const pid = item.product?._id || item.product || item._id;
                const remaining = (item.quantityOrdered || 0) - (item.quantityDelivered || 0);
                return (
                  <View key={item._id} style={styles.recordItemInputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordItemName}>{item.product?.name || item.name}</Text>
                      <Text style={styles.recordItemHelp}>
                        Remaining: {remaining} {item.product?.unit || item.unit}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.qtyInputField}
                      value={deliveryQtys[pid] ?? ''}
                      onChangeText={(v) => setDeliveryQtys((q) => ({ ...q, [pid]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="Qty"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                );
              })}

              <Text style={styles.fieldLabel}>Delivery Agent Rent (₹)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="0.00"
                value={deliveryRent}
                onChangeText={setDeliveryRent}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Delivery Log Date</Text>
              <TextInput
                style={styles.formInput}
                placeholder="YYYY-MM-DD"
                value={deliveryDateInput}
                onChangeText={setDeliveryDateInput}
                placeholderTextColor={colors.textMuted}
              />

              <Pressable style={styles.saveSubmitBtn} onPress={recordDelivery}>
                <Text style={styles.saveSubmitBtnText}>Record Delivery Batch</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: Delivery History Logs with Per-Batch PDF Printing */}
      <Modal visible={historyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>Delivery History Logs</Text>
              <Pressable onPress={() => setHistoryModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              {deliveryHistory.length === 0 ? (
                <View style={styles.emptyLogs}>
                  <Text style={styles.emptyText}>No historical batch logs found for this order.</Text>
                </View>
              ) : (() => {
                  // Group deliveries by dispatchId for batch display
                  const batches = {};
                  deliveryHistory.forEach((d) => {
                    const key = d.dispatchId || d.deliveryAgent?.dispatchId || 'ungrouped';
                    if (!batches[key]) {
                      batches[key] = {
                        dispatchId: key,
                        date: d.deliveryDate,
                        agentName: d.deliveryAgent?.name,
                        agentMobile: d.deliveryAgent?.mobile,
                        agentCharge: d.agentCharge || 0,
                        items: [],
                      };
                    }
                    batches[key].items.push({
                      product: d.product?._id || d.product,
                      orderItemId: d.orderItemId,
                      quantityDelivered: d.quantityDelivered,
                      name: d.product?.name || d.name,
                      unit: d.unit,
                    });
                    // Keep earliest date for the batch
                    if (new Date(d.deliveryDate) < new Date(batches[key].date)) {
                      batches[key].date = d.deliveryDate;
                    }
                  });
                  return Object.values(batches).map((batch, i) => (
                    <View key={i} style={styles.histCard}>
                      {/* Batch header */}
                      <View style={styles.histHeader}>
                        <Text style={styles.histItemName}>
                          {batch.dispatchId !== 'ungrouped' ? `Dispatch #${batch.dispatchId.slice(-6)}` : `Batch ${i + 1}`}
                        </Text>
                        <Text style={styles.histMeta}>
                          {new Date(batch.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </Text>
                      </View>
                      {/* Items in batch */}
                      {batch.items.map((item, j) => (
                        <Text key={j} style={[styles.histMeta, { marginTop: 2 }]}>
                          • {item.name || 'Item'}: <Text style={{ fontWeight: '700', color: '#333' }}>{item.quantityDelivered} {item.unit || 'units'}</Text>
                        </Text>
                      ))}
                      {/* Driver info */}
                      {batch.agentName && (
                        <Text style={[styles.histMeta, { marginTop: 3 }]}>
                          Driver: {batch.agentName} {batch.agentMobile ? `(📞 ${batch.agentMobile})` : ''}
                        </Text>
                      )}
                      {batch.agentCharge > 0 && (
                        <Text style={[styles.histMeta, { fontWeight: '700', color: '#7c3aed' }]}>
                          Driver Rent: ₹{formatPrice(batch.agentCharge)}
                        </Text>
                      )}
                      {/* Per-Batch PDF Print Buttons */}
                      <View style={styles.batchPrintRow}>
                        <Pressable
                          style={styles.batchPrintBtn}
                          onPress={() => generateDispatchBatchPDF(batch, false)}
                        >
                          <Text style={styles.batchPrintBtnText}>📄 Print Dispatch</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.batchPrintBtn, styles.batchPrintBtnHeader]}
                          onPress={() => generateDispatchBatchPDF(batch, true)}
                        >
                          <Text style={styles.batchPrintBtnText}>🏢 With Header</Text>
                        </Pressable>
                      </View>
                    </View>
                  ));
                })()
              }
              <Pressable style={styles.secondaryCloseBtn} onPress={() => setHistoryModal(false)}>
                <Text style={styles.secondaryCloseBtnText}>Close Logs</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 5: Add Custom Items */}
      <Modal visible={customItemModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>Add Custom Material Item</Text>
              <Pressable onPress={() => setCustomItemModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Material Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Red Soil, Concrete Mix"
                value={customItem.name}
                onChangeText={(v) => setCustomItem((prev) => ({ ...prev, name: v }))}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Unit of Measure</Text>
              <View style={styles.segmentRow}>
                {['Brass', 'Pcs', 'Unit', 'Bags', 'Trip'].map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.segmentBtn, customItem.unit === u && styles.segmentBtnActive]}
                    onPress={() => setCustomItem((prev) => ({ ...prev, unit: u }))}
                  >
                    <Text style={[styles.segmentText, customItem.unit === u && styles.segmentTextActive]}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Price Per Unit (₹)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="0.00"
                value={customItem.price}
                onChangeText={(v) => setCustomItem((prev) => ({ ...prev, price: v }))}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Initial Quantity Ordered</Text>
              <TextInput
                style={styles.formInput}
                placeholder="1"
                value={customItem.quantityOrdered}
                onChangeText={(v) => setCustomItem((prev) => ({ ...prev, quantityOrdered: v }))}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />

              <Pressable
                style={[styles.saveSubmitBtn, customItemLoading && styles.btnDisabled]}
                onPress={handleAddCustomItem}
                disabled={customItemLoading}
              >
                 {customItemLoading ? (
                   <BrickSpinner size="small" color="#fff" />
                 ) : (
                   <Text style={styles.saveSubmitBtnText}>Add Custom Material</Text>
                 )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 6: Request/Approve Rate Revision */}
      <Modal visible={rateChangeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>Edit Order Items & Rates</Text>
              <Pressable onPress={() => setRateChangeModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>
 
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.helperLabel}>
                Modify material quantities and prices. Live estimations recalculate below:
              </Text>
 
              {order.items?.filter((item) => !removedItemIds.includes(item._id)).map((item) => (
                <View key={item._id} style={styles.recordItemInputRow}>
                  <View style={{ flex: 1.1 }}>
                    <Text style={styles.recordItemName}>{item.product?.name || item.name}</Text>
                    <Text style={styles.recordItemHelp}>
                      Unit: {item.product?.unit || item.unit}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, flex: 1.9, justifyContent: 'flex-end', alignItems: 'center' }}>
                    {/* Quantity Input */}
                    <View style={{ width: 65, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: '#f9fafb', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
                      <TextInput
                        style={{ flex: 1, fontSize: 13, color: colors.text, fontWeight: '600', padding: 0, textAlign: 'center' }}
                        value={qtyChanges[item._id] ?? ''}
                        onChangeText={(v) => handleQtyChangeUpdate(item._id, v)}
                        keyboardType="decimal-pad"
                        placeholder="Qty"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    
                    {/* Price Input */}
                    <View style={[styles.rateFieldGroup, { width: 80 }]}>
                      <Text style={styles.currencySymbol}>₹</Text>
                      <TextInput
                        style={styles.rateInputField}
                        value={rateChanges[item._id] ?? ''}
                        onChangeText={(v) => handleRateChangeUpdate(item._id, v)}
                        keyboardType="decimal-pad"
                        placeholder="Rate"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>

                    {/* Trash Button to Remove Product */}
                    <Pressable
                      style={{ padding: 6, marginLeft: 2 }}
                      onPress={() => {
                        Alert.alert(
                          'Remove Item',
                          `Are you sure you want to remove ${item.product?.name || item.name} from this order?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: () => {
                                setRemovedItemIds((prev) => [...prev, item._id]);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger || '#ef4444'} />
                    </Pressable>
                  </View>
                </View>
              ))}
 
              <View style={styles.totalsBox}>
                <View style={styles.totalBreakdownRow}>
                  <Text style={styles.totalLabel}>Original Price Total:</Text>
                  <Text style={styles.totalValText}>₹{formatPrice(itemsTotal)}</Text>
                </View>
                <View style={styles.totalBreakdownRow}>
                  <Text style={[styles.totalLabel, { fontWeight: '800' }]}>New Estimated Total:</Text>
                  <Text style={[styles.totalValText, { fontWeight: '800', color: colors.primary }]}>
                    ₹{formatPrice(getNewProposedTotal())}
                  </Text>
                </View>
              </View>
 
              <Pressable
                style={[styles.saveSubmitBtn, rateChangeLoading && styles.btnDisabled]}
                onPress={submitRateChange}
                disabled={rateChangeLoading}
              >
                 {rateChangeLoading ? (
                   <BrickSpinner size="small" color="#fff" />
                 ) : (
                   <Text style={styles.saveSubmitBtnText}>Save Order Changes</Text>
                 )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 7: Confirm Delivery Batch */}
      <Modal visible={confirmBatchModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>Confirm Batch & Payment</Text>
              <Pressable onPress={() => setConfirmBatchModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Payment Mode Selection</Text>
              <View style={styles.segmentRow}>
                {['Cash', 'GPay', 'Bank Transfer', 'UPI'].map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.segmentBtn, paymentMode === m && styles.segmentBtnActive]}
                    onPress={() => setPaymentMode(m)}
                  >
                    <Text style={[styles.segmentText, paymentMode === m && styles.segmentTextActive]}>
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Cash Amount Received (₹)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="0.00"
                value={receivedAmount}
                onChangeText={setReceivedAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.switchLabel}>Write-off Remaining Balance</Text>
                  <Text style={styles.switchHelp}>
                    Mark this batch as fully clear and write off any partial due.
                  </Text>
                </View>
                <Switch
                  value={isNullAction}
                  onValueChange={setIsNullAction}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={styles.fieldLabel}>Batch Date</Text>
              <TextInput
                style={styles.formInput}
                placeholder="YYYY-MM-DD"
                value={batchDate}
                onChangeText={setBatchDate}
                placeholderTextColor={colors.textMuted}
              />

              <Pressable
                style={[styles.saveSubmitBtn, confirmBatchLoading && styles.btnDisabled]}
                onPress={handleConfirmBatch}
                disabled={confirmBatchLoading}
              >
                 {confirmBatchLoading ? (
                   <BrickSpinner size="small" color="#fff" />
                 ) : (
                   <Text style={styles.saveSubmitBtnText}>Confirm Shipment Batch</Text>
                 )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* NEW MODAL 8: Select Payment Details for PDF (Web UI Parity) */}
      <Modal visible={printPaymentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>Embed Gateways on PDF</Text>
              <Pressable onPress={() => setPrintPaymentModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.helperLabel}>
                Select one Bank profile and one UPI QR profile to embed on the generated Estimate:
              </Text>

              {/* Grid Selector */}
              <View style={styles.gatewayGrid}>
                {/* Option 1: None */}
                <Pressable
                  style={[
                    styles.gatewayCard,
                    !selectedPrintPayments.primary && !selectedPrintPayments.bank && styles.gatewayCardActive,
                  ]}
                  onPress={() => setSelectedPrintPayments({ primary: null, bank: null })}
                >
                  <Text style={styles.gatewayIcon}>🚫</Text>
                  <Text style={styles.gatewayTitle}>No Gateways</Text>
                  <Text style={styles.gatewayMeta}>Plain estimate invoice</Text>
                </Pressable>

                {/* Registered payment gateways */}
                {printPaymentSettings.map((setting) => {
                  const isSelected =
                    (setting.type === 'primary' && selectedPrintPayments.primary?._id === setting._id) ||
                    (setting.type === 'bank' && selectedPrintPayments.bank?._id === setting._id);
                  return (
                    <Pressable
                      key={setting._id}
                      style={[styles.gatewayCard, isSelected && styles.gatewayCardActive]}
                      onPress={() => {
                        if (setting.type === 'primary') {
                          setSelectedPrintPayments((prev) => ({
                            ...prev,
                            primary: prev.primary?._id === setting._id ? null : setting,
                          }));
                        } else {
                          setSelectedPrintPayments((prev) => ({
                            ...prev,
                            bank: prev.bank?._id === setting._id ? null : setting,
                          }));
                        }
                      }}
                    >
                      {isSelected && <Text style={styles.checkmarkIcon}>✅</Text>}
                      {setting.qrCode ? (
                        <Text style={styles.gatewayIcon}>📱</Text>
                      ) : (
                        <Text style={styles.gatewayIcon}>🏦</Text>
                      )}
                      <Text style={styles.gatewayTitle} numberOfLines={1}>{setting.name}</Text>
                      <Text style={styles.gatewayMeta}>
                        {setting.type === 'primary' ? 'UPI QR Profile' : 'Bank details'}
                      </Text>
                      {setting.type === 'bank' && (
                        <View style={styles.bankMiniBlock}>
                          <Text style={styles.bankMiniText} numberOfLines={1}>A/C: {setting.accountNumber}</Text>
                          <Text style={styles.bankMiniText} numberOfLines={1}>IFSC: {setting.ifsc}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[styles.saveSubmitBtn, isGeneratingPDF && styles.btnDisabled]}
                onPress={() => generateBillPDFDirect(printWithHeader, selectedPrintPayments)}
                disabled={isGeneratingPDF}
              >
                 {isGeneratingPDF ? (
                   <BrickSpinner size="small" color="#fff" />
                 ) : (
                   <Text style={styles.saveSubmitBtnText}>Compile & Generate PDF</Text>
                 )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 9: Pause/Hold Reason */}
      <Modal visible={reasonModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.modalHeaderStyle}>
              <Text style={styles.modalTitleStyle}>
                {reasonModal.targetStatus === 'Hold' ? 'Hold Reason' : 'Pause Reason'}
              </Text>
              <Pressable onPress={() => setReasonModal({ visible: false, targetStatus: null })}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>
                {reasonModal.targetStatus === 'Hold'
                  ? 'Enter reason for putting this order on hold'
                  : 'Enter reason for pausing this order'}
              </Text>
              <TextInput
                style={[styles.formInput, styles.reasonInput]}
                value={reasonText}
                onChangeText={setReasonText}
                placeholder="Type reason here..."
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Pressable style={styles.saveSubmitBtn} onPress={submitReasonedStatus}>
                <Text style={styles.saveSubmitBtnText}>Save Reason & Continue</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  expandedCard: {
    ...shadows.lg,
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  id: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  userPhone: {
    fontSize: 12,
    color: colors.textMuted,
  },
  headerPricing: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 90,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priceVal: {
    fontSize: 18,
    fontWeight: '900',
  },
  cardBody: {
    marginTop: spacing.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.breakdownBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.sm,
  },
  highlightedItemRow: {
    backgroundColor: colors.highlightedBg, // dynamic orange/amber warning background
    borderColor: '#f59e0b', // warning/orange border
    borderWidth: 1.5,
  },
  highlightedPriceText: {
    color: colors.highlightedText, // dynamic amber/orange text for price
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemDeliveries: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  boldText: {
    fontWeight: '800',
    color: colors.text,
  },
  adjContainer: {
    marginVertical: spacing.md,
  },
  adjRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.breakdownBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.xs,
  },
  adjTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  adjHelp: {
    fontSize: 9,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  adjVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  reasonBox: {
    backgroundColor: '#fff8f2',
    borderWidth: 1,
    borderColor: '#f1d7bf',
    borderRadius: 10,
    padding: 10,
    marginBottom: spacing.md,
  },
  reasonText: {
    fontSize: 12,
    color: colors.text,
  },
  reasonTextStrong: {
    fontWeight: '800',
    color: colors.danger,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.xs,
  },
  actionButton: {
    backgroundColor: colors.adminSidebar,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteActionButton: {
    backgroundColor: colors.danger,
  },
  printActionButton: {
    backgroundColor: '#166534',
  },

  // Batch print row in history modal
  batchPrintRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  batchPrintBtn: {
    flex: 1,
    backgroundColor: '#166534',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    ...shadows.sm,
  },
  batchPrintBtnHeader: {
    backgroundColor: '#1e3a8a',
  },
  batchPrintBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Modal / Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: spacing.xl,
    ...shadows.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalHeaderStyle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitleStyle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  closeModalText: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '700',
    padding: 4,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  helperLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: '#fff',
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.background,
    color: colors.text,
    marginBottom: spacing.md,
  },
  reasonInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#eaeaea',
    color: '#999',
  },
  saveSubmitBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  saveSubmitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Driver Assignment Styles
  driversGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.lg,
  },
  driverCard: {
    width: '31%',
    backgroundColor: '#fbfbfb',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    gap: 4,
  },
  driverCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#fffcf6',
  },
  driverEmoji: {
    fontSize: 24,
  },
  driverNameLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  driverPhoneLabel: {
    fontSize: 9,
    color: colors.textMuted,
  },

  // Record Delivery Modal Item Input Row
  recordItemInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: spacing.sm,
  },
  recordItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  recordItemHelp: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  qtyInputField: {
    width: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    textAlign: 'center',
    backgroundColor: '#fff',
    color: colors.text,
    fontWeight: '700',
  },
  rateFieldGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingLeft: 10,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  rateInputField: {
    width: 80,
    padding: 10,
    textAlign: 'left',
    color: colors.text,
    fontWeight: '700',
  },

  // Totals Estimator for Rate Changes
  totalsBox: {
    backgroundColor: '#fffcf5',
    borderWidth: 1,
    borderColor: '#ffeed1',
    borderRadius: 10,
    padding: spacing.md,
    marginVertical: spacing.md,
    gap: 4,
  },
  totalBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  totalValText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
  },

  // Switch Row Styles
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6fbf8',
    borderColor: '#d1ecd9',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: spacing.md,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
  },
  switchHelp: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Logs styles
  emptyLogs: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  histCard: {
    backgroundColor: '#fbfbfb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: spacing.sm,
    gap: 3,
  },
  histHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  histItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  histQty: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  histMeta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  secondaryCloseBtn: {
    backgroundColor: colors.border,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  secondaryCloseBtnText: {
    color: colors.text,
    fontWeight: '700',
  },

  // Payment selection for PDF (Gateway Selection Styles)
  gatewayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: spacing.lg,
  },
  gatewayCard: {
    width: '47%',
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
    gap: 4,
    ...shadows.sm,
  },
  gatewayCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#fffaf4',
  },
  checkmarkIcon: {
    position: 'absolute',
    top: 6,
    right: 8,
    fontSize: 12,
  },
  gatewayIcon: {
    fontSize: 28,
  },
  gatewayTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: 2,
  },
  gatewayMeta: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  bankMiniBlock: {
    width: '100%',
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingTop: 6,
    marginTop: 4,
    gap: 1,
  },
  bankMiniText: {
    fontSize: 8.5,
    color: colors.textMuted,
    textAlign: 'left',
  },
});

