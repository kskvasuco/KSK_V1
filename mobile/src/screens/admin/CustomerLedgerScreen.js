import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  Share,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';
import { formatIndianCurrency } from '../../utils/priceFormatter';

function formatDateTime(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strTime = String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
  return `${day} ${month} ${year}, ${strTime}`;
}

function formatDateOnly(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).substring(2);
  return `${day} ${month} ${year}`;
}

export default function CustomerLedgerScreen({ route, navigation }) {
  const { userId, userName } = route.params || {};

  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual Transaction Modal Form States
  const [isDrModalVisible, setIsDrModalVisible] = useState(false); // You Gave (Dr)
  const [isCrModalVisible, setIsCrModalVisible] = useState(false); // You Got (Cr)
  const [isQrModalVisible, setIsQrModalVisible] = useState(false); // UPI QR Code Modal

  // Form Inputs
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  // QR Selection & Custom Amount States
  const [selectedPaymentSetting, setSelectedPaymentSetting] = useState(null);
  const [customQrAmount, setCustomQrAmount] = useState('');

  // Form input sanitization handlers
  const handleAmountChange = (val) => {
    const sanitized = val.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) return;
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) return;
    // Limit integer part length to 9 digits (max 999,999,999) to prevent overflow
    if (parts[0] && parts[0].length > 9) return;
    setAmount(sanitized);
  };

  const handleQrAmountChange = (val) => {
    const sanitized = val.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    if (parts[0] && parts[0].length > 9) return;
    setCustomQrAmount(sanitized);
  };

  // Open modal handlers with safe form clearing
  const openDrModal = () => {
    setAmount('');
    setDescription('');
    setIsDrModalVisible(true);
  };

  const openCrModal = () => {
    setAmount('');
    setDescription('');
    setIsCrModalVisible(true);
  };

  const openQrModal = () => {
    setCustomQrAmount('');
    setIsQrModalVisible(true);
  };

  const fetchLedger = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (!userId) {
        throw new Error('Customer ID is missing.');
      }
      const data = await adminApi.getCustomerLedger(userId);
      setCustomer(data.customer || null);

      // Server returns transactions newest first (reverse sorted).
      // We reverse them to get chronological ascending order for local running balance validation.
      const sortedTx = [...(data.transactions || [])].reverse();

      let currentRunning = 0;
      const calculatedTx = sortedTx.map((t) => {
        if (t.type === 'cr') {
          currentRunning += t.amount;
        } else if (t.type === 'dr') {
          currentRunning -= t.amount;
        }
        return {
          ...t,
          runningBalance: currentRunning,
        };
      });

      // Show newest first in flat list statement
      setTransactions(calculatedTx.reverse());
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to load customer statement.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const data = await adminApi.getPaymentSettings();
      setPaymentSettings(data || []);
      if (data && data.length > 0) {
        setSelectedPaymentSetting(data[0]);
      }
    } catch (e) {
      console.error('Error fetching payment settings:', e);
    }
  };

  useEffect(() => {
    fetchLedger();
    fetchPaymentSettings();
  }, [userId]);

  const handleAddTransaction = async (type) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (numAmount > 999999999.99) {
      Alert.alert('Validation Error', 'Amount cannot exceed ₹99,99,99,999.99.');
      return;
    }

    try {
      setSubmitting(true);
      await adminApi.addLedgerTransaction({
        userId,
        type,
        amount: numAmount,
        description: description.trim() || (type === 'dr' ? 'You Gave' : 'You Got'),
        date: new Date(),
      });

      // Reset Form and close modals
      setAmount('');
      setDescription('');
      setIsDrModalVisible(false);
      setIsCrModalVisible(false);

      // Reload
      await fetchLedger();
      Alert.alert('Success', 'Ledger transaction logged successfully.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to record entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = (txId) => {
    Alert.alert(
      'Delete Ledger Entry?',
      'Are you sure you want to delete this ledger entry? Balances will be recalculated immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await adminApi.deleteLedgerTransaction(txId);
              await fetchLedger();
              Alert.alert('Success', 'Ledger entry deleted successfully.');
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete transaction.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSendWhatsApp = () => {
    if (!customer) return;
    const net = customer.netBalance || 0;
    const phone = customer.mobile || '';

    if (!phone) {
      Alert.alert('Error', 'Customer mobile number is missing.');
      return;
    }

    let messageText = '';
    if (net < 0) {
      // Customer owes us
      const absBal = Math.abs(net).toFixed(2);
      messageText = `Dear ${customer.name},\n\nThis is a friendly reminder from KSK VASU & Co. Your current outstanding balance is *₹${absBal}*.\n\nPlease clear the pending amount at your earliest convenience.\n\nThank you for your business!`;
    } else if (net > 0) {
      // We owe customer
      messageText = `Dear ${customer.name},\n\nGreeting from KSK VASU & Co. You have an advance credit balance of *₹${net.toFixed(2)}* with us.\n\nThank you for your continued support!`;
    } else {
      messageText = `Dear ${customer.name},\n\nGreeting from KSK VASU & Co. Your ledger account is fully settled with ₹0.00 outstanding.\n\nThank you!`;
    }

    const encodedText = encodeURIComponent(messageText);
    const cleanPhone = phone.length === 10 ? '91' + phone : phone;
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodedText}`).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on this device.');
    });
  };

  const handleShareStatement = async () => {
    if (!customer || !transactions.length) {
      Alert.alert('No Entries', 'No ledger statement data is available to share.');
      return;
    }

    const netVal = customer.netBalance || 0;
    let text = `📖 KSK VASU & Co - KSK Ledger Statement\n`;
    text += `Customer Name: ${customer.name}\n`;
    text += `Mobile Number: +91 ${customer.mobile || 'N/A'}\n`;
    text += `Generated At:  ${formatDateTime(new Date())}\n`;
    text += `====================================\n`;
    text += `LEDGER ACCOUNT SUMMARY:\n`;
    text += `Total You Gave: ₹${formatIndianCurrency(customer.totalYouGave || 0)}\n`;
    text += `Total You Got:  ₹${formatIndianCurrency(customer.totalYouGot || 0)}\n`;
    text += `Current Balance: ₹${formatIndianCurrency(Math.abs(netVal))} (${netVal < 0 ? 'Due/Debt' : netVal > 0 ? 'Advance' : 'Settled'})\n`;
    text += `====================================\n`;
    text += `TRANSACTIONS LOG:\n\n`;

    const chronological = [...transactions].reverse();
    chronological.forEach((t, index) => {
      const formattedDate = formatDateOnly(t.date);
      const typeStr = t.type === 'dr' ? 'GAVE(Dr)' : 'GOT(Cr)';
      text += `[${index + 1}] ${formattedDate}\n    ${t.description}\n    ${typeStr}: ₹${t.amount.toFixed(2)} | Run Bal: ₹${Math.abs(t.runningBalance).toFixed(2)}\n\n`;
    });

    text += `This is a certified digital account statement.\nThank you for your business!`;

    try {
      await Share.share({ message: text });
    } catch (e) {
      Alert.alert('Error', 'Failed to share statement.');
    }
  };

  if (loading && !refreshing) {
    return <Loading />;
  }

  if (!customer) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>Customer profile not found.</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const netBal = customer.netBalance || 0;
  const isDue = netBal < 0;

  // Formulate UPI payment URI details
  const finalPaymentAmount = customQrAmount || Math.abs(netBal).toFixed(2);
  const upiUrl = `upi://pay?pa=kskvasuco@oksbi&pn=KSK%20VASU%20%26%20Co&am=${finalPaymentAmount}&cu=INR`;
  const upiQrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {/* Customer Profile Card */}
      <View style={[styles.profileCard, shadows.sm]}>
        <View style={styles.profileHeader}>
          <View style={styles.profileIconContainer}>
            <Ionicons name="person" size={24} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{customer.name}</Text>
            <Text style={styles.profileMobile}>📱 +91 {customer.mobile}</Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <View style={styles.locationCol}>
            <Text style={styles.locationLabel}>District</Text>
            <Text style={styles.locationVal}>{customer.district || 'N/A'}</Text>
          </View>
          <View style={styles.locationCol}>
            <Text style={styles.locationLabel}>Taluk</Text>
            <Text style={styles.locationVal}>{customer.taluk || 'N/A'}</Text>
          </View>
        </View>

        {customer.address ? (
          <View style={styles.addressRow}>
            <Ionicons name="home-outline" size={13} color={colors.textMuted} style={styles.addressIcon} />
            <Text style={styles.addressText} numberOfLines={2}>{customer.address}</Text>
          </View>
        ) : null}
      </View>

      {/* Net Balance & Booking Buttons */}
      <View style={[
        styles.balanceCard,
        shadows.sm,
        { borderLeftWidth: 6, borderLeftColor: netBal === 0 ? colors.border : isDue ? colors.danger : colors.success }
      ]}>
        <Text style={styles.balanceLabelTitle}>Current Ledger Balance</Text>
        <Text style={[
          styles.balanceValue,
          { color: netBal === 0 ? colors.textMuted : isDue ? colors.danger : colors.success }
        ]}>
          ₹{formatIndianCurrency(Math.abs(netBal))}
        </Text>
        <Text style={styles.balanceSub}>
          {netBal === 0 ? 'Account Settle Balanced' : isDue ? 'Customer Owes Us (Outstanding Due)' : 'We Owe Customer (Advance Got)'}
        </Text>

        {/* Action Form Bookings */}
        <View style={styles.bookingRow}>
          <Pressable style={styles.giveBtn} onPress={openDrModal}>
            <Ionicons name="remove-circle-outline" size={16} color="#fff" />
            <Text style={styles.bookingBtnText}>You Gave (Dr)</Text>
          </Pressable>
          <Pressable style={styles.getBtn} onPress={openCrModal}>
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={styles.bookingBtnText}>You Got (Cr)</Text>
          </Pressable>
        </View>
      </View>

      {/* Utility Communication row */}
      <View style={styles.utilityGrid}>
        <Pressable style={styles.utilityBtnWhatsApp} onPress={handleSendWhatsApp}>
          <Ionicons name="logo-whatsapp" size={16} color="#fff" />
          <Text style={styles.utilityBtnText}>WhatsApp</Text>
        </Pressable>
        <Pressable style={styles.utilityBtnShare} onPress={handleShareStatement}>
          <Ionicons name="share-social-outline" size={16} color="#fff" />
          <Text style={styles.utilityBtnText}>Share statement</Text>
        </Pressable>
        <Pressable style={styles.utilityBtnQR} onPress={openQrModal}>
          <Ionicons name="qr-code-outline" size={16} color="#fff" />
          <Text style={styles.utilityBtnText}>UPI QR overlay</Text>
        </Pressable>
      </View>

      <Text style={styles.ledgerHistoryTitle}>Chronological History Statement</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLedger(true)}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyHistoryContainer}>
            <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyHistoryText}>No transactions recorded. All order entries sync automatically.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isDr = item.type === 'dr';
          const running = item.runningBalance || 0;
          const isRunDue = running < 0;

          return (
            <View style={[styles.transactionItemCard, shadows.sm]}>
              <View style={styles.txHeader}>
                <Text style={styles.txDate}>
                  {formatDateTime(item.date)}
                </Text>
                {item.orderId ? (
                  <View style={styles.orderIdBadge}>
                    <Text style={styles.orderIdBadgeText} numberOfLines={1}>📦 Order Sync</Text>
                  </View>
                ) : (
                  <View style={styles.manualBadge}>
                    <Text style={styles.manualBadgeText}>Manual Entry</Text>
                  </View>
                )}
              </View>

              <View style={styles.txMiddle}>
                <View style={styles.descCol}>
                  <Text style={styles.txDesc}>{item.description}</Text>
                  {item.orderId && (
                    <Text style={styles.txOrderIdLabel}>ID: {item.orderId.substring(0, 10)}...</Text>
                  )}
                </View>

                {/* Amount booking column */}
                <View style={styles.amountCol}>
                  <Text style={[styles.txAmount, { color: isDr ? colors.danger : colors.success }]}>
                    {isDr ? 'Gave: ' : 'Got: '}₹{item.amount.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.txFooter}>
                <Text style={styles.runningBalLabel}>
                  Running Balance: <Text style={[
                    styles.runningBalVal,
                    { color: running === 0 ? colors.textMuted : isRunDue ? colors.danger : colors.success }
                  ]}>
                    ₹{Math.abs(running).toFixed(2)} {running === 0 ? '' : isRunDue ? '(Due)' : '(Adv)'}
                  </Text>
                </Text>

                {item.isManual ? (
                  <Pressable
                    style={styles.deleteTxBtn}
                    onPress={() => handleDeleteTransaction(item._id)}
                  >
                    <Ionicons name="trash-outline" size={13} color={colors.danger} />
                    <Text style={styles.deleteTxText}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {/* ═══════════════════════════════════════════
         MODAL: YOU GAVE (Dr Form Entry)
      ═══════════════════════════════════════════ */}
      <Modal visible={isDrModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: colors.danger }]} />
                <Text style={[styles.modalTitle, { color: colors.danger }]}>You Gave (Credit Extended)</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsDrModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.formLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                placeholder="Enter amount given e.g. 500"
                value={amount}
                onChangeText={handleAmountChange}
                autoFocus
              />

              <Text style={styles.formLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Manual sales dispatch, custom charge extension, etc."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.danger }, submitting && styles.disabledBtn]}
                onPress={() => handleAddTransaction('dr')}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm You Gave</Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
         MODAL: YOU GOT (Cr Form Entry)
      ═══════════════════════════════════════════ */}
      <Modal visible={isCrModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.modalTitle, { color: colors.success }]}>You Got (Payment Received)</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsCrModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.formLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                placeholder="Enter amount received e.g. 1000"
                value={amount}
                onChangeText={handleAmountChange}
                autoFocus
              />

              <Text style={styles.formLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Received GPay payment, cash advance, bank transfer..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.success }, submitting && styles.disabledBtn]}
                onPress={() => handleAddTransaction('cr')}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm You Got</Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
         MODAL: PREMIUM UPI QR OVERLAY MODAL
      ═══════════════════════════════════════════ */}
      <Modal visible={isQrModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.darkQrModal]}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>💳 UPI QR Statement Overlay</Text>
              <Pressable style={styles.qrCloseBtn} onPress={() => setIsQrModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.qrModalBody}>
              {/* Payment bank selection */}
              {paymentSettings.length > 0 ? (
                <View style={styles.qrFormGroup}>
                  <Text style={styles.qrFormLabel}>Select Payee Bank Account / UPI</Text>
                  <View style={styles.qrPickerWrapper}>
                    <Picker
                      selectedValue={selectedPaymentSetting ? selectedPaymentSetting._id : ''}
                      onValueChange={(val) => {
                        const set = paymentSettings.find(p => p._id === val);
                        setSelectedPaymentSetting(set);
                      }}
                      style={styles.qrPicker}
                      dropdownIconColor="#fff"
                    >
                      {paymentSettings.map(setting => (
                        <Picker.Item key={setting._id} label={`${setting.name} (${setting.type === 'bank' ? 'Bank AC' : 'UPI QR'})`} value={setting._id} color={Platform.OS === 'android' ? '#000' : '#fff'} />
                      ))}
                    </Picker>
                  </View>
                </View>
              ) : null}

              {/* Dynamic QR Input amount */}
              <View style={styles.qrFormGroup}>
                <Text style={styles.qrFormLabel}>Payment Amount (₹)</Text>
                <TextInput
                  style={styles.qrInput}
                  keyboardType="numeric"
                  placeholder={Math.abs(netBal).toFixed(2)}
                  placeholderTextColor="#64748b"
                  value={customQrAmount}
                  onChangeText={handleQrAmountChange}
                />
                <Text style={styles.qrSubtext}>Defaults to current outstanding ledger balance.</Text>
              </View>

              {/* Image QR Block */}
              <View style={styles.qrBox}>
                {selectedPaymentSetting && selectedPaymentSetting.qrCode ? (
                  // Custom saved system image QR
                  <View style={styles.qrInnerBlock}>
                    <Image
                      source={{ uri: selectedPaymentSetting.qrCode }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrInnerTitle}>{selectedPaymentSetting.name}</Text>
                    <Text style={styles.qrInnerLabel}>Scan saved QR image code to pay.</Text>
                  </View>
                ) : (
                  // Dynamic API generated canvas QR
                  <View style={styles.qrInnerBlock}>
                    <Image
                      source={{ uri: upiQrApiUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrInnerTitle}>₹{finalPaymentAmount}</Text>
                    <Text style={styles.qrInnerLabelUpi}>Payee: KSK VASU & Co (kskvasuco@oksbi)</Text>
                    <Text style={styles.qrPayMethods}>Scan QR with PhonePe / GPay / Paytm</Text>
                  </View>
                )}
              </View>

              {/* Bank AC text details for Bank type settings */}
              {selectedPaymentSetting && selectedPaymentSetting.type === 'bank' ? (
                <View style={styles.bankDetailBox}>
                  <Text style={styles.bankLabelHeader}>BANK ACCOUNT TRANSFER DETAILS</Text>
                  <Text style={styles.bankNameText}>{selectedPaymentSetting.bankName || selectedPaymentSetting.name}</Text>
                  <View style={styles.bankItems}>
                    <Text style={styles.bankItemText}>AC Name: {selectedPaymentSetting.accountName || 'N/A'}</Text>
                    <Text style={styles.bankItemText}>AC No:   {selectedPaymentSetting.accountNumber}</Text>
                    <Text style={styles.bankItemText}>IFSC:    {selectedPaymentSetting.ifsc}</Text>
                  </View>
                </View>
              ) : null}

              <Pressable
                style={styles.qrCloseActionBtn}
                onPress={() => setIsQrModalVisible(false)}
              >
                <Text style={styles.qrCloseActionText}>Done / Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerBlock: {
    marginBottom: spacing.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.background,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    ...shadows.sm,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  profileMobile: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  locationCol: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  locationVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fafafa',
    padding: 8,
    borderRadius: 8,
    marginTop: spacing.xs,
  },
  addressIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  addressText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceLabelTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: spacing.xs,
  },
  balanceSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  bookingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  giveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingVertical: 12,
    borderRadius: 8,
    ...shadows.sm,
  },
  getBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.success,
    paddingVertical: 12,
    borderRadius: 8,
    ...shadows.sm,
  },
  bookingBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Utility actions row
  utilityGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  utilityBtnWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#25d366',
    paddingVertical: 10,
    borderRadius: 8,
    ...shadows.sm,
  },
  utilityBtnShare: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#475569',
    paddingVertical: 10,
    borderRadius: 8,
    ...shadows.sm,
  },
  utilityBtnQR: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    ...shadows.sm,
  },
  utilityBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  ledgerHistoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // List Empty History
  emptyHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  emptyHistoryText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },

  // Transaction Cards
  transactionItemCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  txDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  orderIdBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderIdBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  manualBadge: {
    backgroundColor: '#faf5ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  manualBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  txMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  descCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  txOrderIdLabel: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  runningBalLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  runningBalVal: {
    fontWeight: '700',
  },
  deleteTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  deleteTxText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '700',
  },

  // Native Modals General
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: spacing.md,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
    color: colors.text,
  },
  formTextarea: {
    height: 70,
    textAlignVertical: 'top',
  },
  confirmBtn: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.6,
  },

  // QR Modal Premium Black Theme
  darkQrModal: {
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qrModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38ef7d',
  },
  qrCloseBtn: {
    padding: 4,
  },
  qrModalBody: {
    padding: spacing.md,
  },
  qrFormGroup: {
    marginBottom: spacing.md,
  },
  qrFormLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
  },
  qrPickerWrapper: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    height: 40,
    justifyContent: 'center',
  },
  qrPicker: {
    color: '#fff',
    height: 40,
  },
  qrInput: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#1e293b',
    color: '#fff',
  },
  qrSubtext: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginVertical: spacing.sm,
  },
  qrInnerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 180,
    height: 180,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
  },
  qrInnerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: spacing.sm,
  },
  qrInnerLabel: {
    fontSize: 12,
    color: '#a7f3d0',
    marginTop: 2,
  },
  qrInnerLabelUpi: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
  qrPayMethods: {
    fontSize: 12,
    color: '#38ef7d',
    fontWeight: '700',
    marginTop: 6,
  },
  bankDetailBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  bankLabelHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  bankNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  bankItems: {
    marginTop: 6,
    gap: 2,
  },
  bankItemText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  qrCloseActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  qrCloseActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
