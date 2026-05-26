import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';
import { formatIndianCurrency } from '../../utils/priceFormatter';

const ALLOWED_LOCATIONS = {
  "Erode": ["Erode", "Modakkurichi", "Kodumudi", "Perundurai", "Bhavani", "Anthiyur", "Gobichettipalayam", "Sathyamangalam", "Nambiyur", "Thalavadi"],
  "Coimbatore": ["Coimbatore (North)", "Coimbatore (South)", "Mettupalayam", "Pollachi", "Valparai", "Sulur", "Annur", "Kinathukadavu", "Madukkarai", "Perur", "Anaimalai"],
  "Thirupur": ["Tiruppur (North)", "Tiruppur (South)", "Avinashi", "Palladam", "Dharapuram", "Kangayam", "Madathukulam", "Udumalaipettai", "Uthukuli"],
  "Namakal": ["Namakkal", "Rasipuram", "Tiruchengode", "Paramathi-Velur", "Kolli Hills", "Sendamangalam", "Kumarapalayam", "Mohanur"],
  "Salam": ["Salem", "Salem (West)", "Salem (South)", "Attur", "Edappadi", "Gangavalli", "Mettur", "Omalur", "Sankagiri", "Valapady", "Yercaud"]
};

export default function LedgerScreen({ navigation }) {
  const [summary, setSummary] = useState({ netBalance: 0, totalYouGave: 0, totalYouGot: 0 });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('Customer'); // 'Customer' or 'Supplier'

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');

  // Create User Form State
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formAltMobile, setFormAltMobile] = useState('');
  const [formPincode, setFormPincode] = useState('');
  const [formDistrict, setFormDistrict] = useState('Erode');
  const [formTaluk, setFormTaluk] = useState('Erode');
  const [formOpeningBalance, setFormOpeningBalance] = useState('');
  const [formOpeningBalanceType, setFormOpeningBalanceType] = useState('debit');

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch stats summary with filter
      const sumRes = await adminApi.getLedgerSummary({ ledgerType: activeTab });
      if (sumRes) {
        const totalYouGave = sumRes.totalYouGave !== undefined ? sumRes.totalYouGave : (sumRes.totalWillGet || 0);
        const totalYouGot = sumRes.totalYouGot !== undefined ? sumRes.totalYouGot : (sumRes.totalWillGive || 0);
        const netBalance = sumRes.netBalance !== undefined ? sumRes.netBalance : (totalYouGot - totalYouGave);
        setSummary({ netBalance, totalYouGave, totalYouGot });
      } else {
        setSummary({ netBalance: 0, totalYouGave: 0, totalYouGot: 0 });
      }

      // Fetch customers list with filter
      const custRes = await adminApi.getLedgerCustomers({ ledgerType: activeTab });
      setCustomers(Array.isArray(custRes) ? custRes : []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to load digital ledger data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, activeTab]);

  const handleSyncAll = () => {
    Alert.alert(
      'Synchronize All Ledgers',
      'This will recalculate and synchronize the digital ledger for all customers in the database. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: async () => {
            try {
              setSyncing(true);
              await adminApi.syncAllLedgers();
              Alert.alert('Success', 'Ledger synchronization completed successfully!');
              loadData();
            } catch (e) {
              Alert.alert('Sync Failed', e.message || 'Synchronization failed.');
            } finally {
              setSyncing(false);
            }
          }
        }
      ]
    );
  };

  const handleRemoveFromLedger = (item) => {
    const userName = item.user?.name || 'this user';
    Alert.alert(
      'Remove from Ledger',
      `Are you sure you want to permanently remove ${userName} from the ledger?\n\nThis will reset their ledger balance to zero and permanently delete all their ledger transactions. This action CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRefreshing(true);
              await adminApi.removeFromLedger(item.user._id);
              Alert.alert('Success', `Successfully removed ${userName} from the ledger.`);
              loadData(true);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to remove user from ledger.');
            } finally {
              setRefreshing(false);
            }
          }
        }
      ]
    );
  };

  const handleCreateUser = async () => {
    if (!formName.trim() || !formMobile.trim()) {
      Alert.alert('Validation Error', 'Name and Mobile number are required.');
      return;
    }
    if (formMobile.trim().length !== 10) {
      Alert.alert('Validation Error', 'Mobile number must be exactly 10 digits.');
      return;
    }
    if (formAltMobile.trim() && formAltMobile.trim().length !== 10) {
      Alert.alert('Validation Error', 'Alternative mobile must be 10 digits.');
      return;
    }
    if (formPincode.trim() && formPincode.trim().length !== 6) {
      Alert.alert('Validation Error', 'Pincode must be exactly 6 digits.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: formName.trim(),
        mobile: formMobile.trim(),
        altMobile: formAltMobile.trim(),
        district: formDistrict,
        taluk: formTaluk,
        pincode: formPincode.trim(),
        openingBalance: Number(formOpeningBalance) || 0,
        openingBalanceType: formOpeningBalanceType,
        isAddedToLedger: true,
        ledgerType: activeTab,
      };

      await adminApi.createUser(payload);
      Alert.alert('Success', `${activeTab} created and registered to ledger successfully.`);
      setIsCreateModalVisible(false);
      
      // Clear form
      setFormName('');
      setFormMobile('');
      setFormAltMobile('');
      setFormPincode('');
      setFormDistrict('Erode');
      setFormTaluk('Erode');
      setFormOpeningBalance('');
      setFormOpeningBalanceType('debit');

      loadData();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  // Filter customers reactively
  const filteredCustomers = (customers || []).filter((c) => {
    if (!c || !c.user) return false;
    const q = searchQuery.toLowerCase();
    const name = (c.user?.name || '').toLowerCase();
    const mobile = c.user?.mobile || '';

    return name.includes(q) || mobile.includes(q);
  });

  if (loading && !refreshing) {
    return <Loading />;
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* KPI Cards Grid */}
      <View style={styles.statsGrid}>
        {/* Net Balance Card */}
        <View style={[
          styles.statCard, 
          styles.fullStatCard,
          shadows.sm,
          { borderLeftWidth: 5, borderLeftColor: (summary.netBalance || 0) >= 0 ? colors.success : colors.danger }
        ]}>
          <Text style={styles.statLabel}>Net Outstanding Balance</Text>
          <Text style={[
            styles.statValue, 
            { color: (summary.netBalance || 0) >= 0 ? colors.success : colors.danger }
          ]}>
            ₹{formatIndianCurrency(Math.abs(summary.netBalance || 0))}
          </Text>
          <Text style={styles.statSub}>
            {(summary.netBalance || 0) >= 0 ? 'To Receive / Advance (Got)' : 'To Pay / Debt (Gave)'}
          </Text>
        </View>

        {/* You Gave Card */}
        <View style={[styles.statCard, shadows.sm, { borderLeftWidth: 4, borderLeftColor: colors.danger }]}>
          <Text style={styles.statLabel}>Total You Gave</Text>
          <Text style={[styles.statValueCompact, { color: colors.danger }]}>
            ₹{formatIndianCurrency(summary.totalYouGave || 0)}
          </Text>
          <Text style={styles.statSub}>Outstanding Debt</Text>
        </View>

        {/* You Got Card */}
        <View style={[styles.statCard, shadows.sm, { borderLeftWidth: 4, borderLeftColor: colors.success }]}>
          <Text style={styles.statLabel}>Total You Got</Text>
          <Text style={[styles.statValueCompact, { color: colors.success }]}>
            ₹{formatIndianCurrency(summary.totalYouGot || 0)}
          </Text>
          <Text style={styles.statSub}>Advance Credit</Text>
        </View>
      </View>

      {/* Filters Card */}
      <View style={[styles.filterCard, shadows.sm]}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or mobile..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Banner with tab switcher */}
      <View style={[styles.topHeader, { backgroundColor: activeTab === 'Customer' ? '#0f52ba' : '#0f766e' }]}>
        <View style={styles.topHeaderRow}>
          <Pressable onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
            <Ionicons name="menu" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.topHeaderTitle}>KSK Ledger</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab switch row */}
        <View style={styles.tabRow}>
          <Pressable 
            style={styles.tabItem} 
            onPress={() => setActiveTab('Customer')}
          >
            <Text style={[styles.tabText, activeTab === 'Customer' && styles.activeTabText]}>
              CUSTOMERS
            </Text>
            {activeTab === 'Customer' && <View style={styles.activeTabUnderline} />}
          </Pressable>

          <Pressable 
            style={styles.tabItem} 
            onPress={() => setActiveTab('Supplier')}
          >
            <Text style={[styles.tabText, activeTab === 'Supplier' && styles.activeTabText]}>
              SUPPLIERS
            </Text>
            {activeTab === 'Supplier' && <View style={styles.activeTabUnderline} />}
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.user?._id}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={styles.emptyText}>No customers matching filters.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const net = item.netBalance || 0;
          const isYouGave = net < 0;
          const formattedNet = formatIndianCurrency(Math.abs(net));
          const formattedGave = formatIndianCurrency(item.totalYouGave);
          const formattedGot = formatIndianCurrency(item.totalYouGot);

          return (
            <Pressable
              style={({ pressed }) => [
                styles.customerCard,
                pressed && styles.cardPressed,
                shadows.sm,
                { borderLeftWidth: 4, borderLeftColor: net === 0 ? colors.border : isYouGave ? colors.danger : colors.success }
              ]}
              onPress={() => {
                navigation.navigate('CustomerLedger', {
                  userId: item.user?._id,
                  userName: item.user?.name || 'Customer'
                });
              }}
              onLongPress={() => {
                if (item.user?._id) {
                  handleRemoveFromLedger(item);
                }
              }}
            >
              <View style={styles.cardHeader}>
                <View style={styles.custInfoCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={styles.customerName}>{item.user?.name || 'Unknown'}</Text>
                    {(item.openingBalance || 0) > 0 && (
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: 6, fontWeight: '700' }}>
                        (OB: ₹{item.openingBalance} {item.openingBalanceType === 'credit' ? 'Cr' : 'Dr'})
                      </Text>
                    )}
                  </View>
                  <View style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={13} color={colors.textMuted} style={styles.phoneIcon} />
                    <Text style={styles.customerMobile}>{item.user?.mobile || 'N/A'}</Text>
                  </View>
                </View>

                {/* Net Badge */}
                <View style={[
                  styles.netBadge,
                  { backgroundColor: net === 0 ? '#f0f0f0' : isYouGave ? '#fdf2f2' : '#ecfdf5' }
                ]}>
                  <Text style={[
                    styles.netBadgeText,
                    { color: net === 0 ? colors.textMuted : isYouGave ? colors.danger : colors.success }
                  ]}>
                    ₹{formattedNet}
                    <Text style={styles.netBadgeSub}>
                      {net === 0 ? '' : isYouGave ? ' (Gave)' : ' (Got)'}
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Card Footer Details */}
              <View style={styles.cardFooter}>
                <View style={styles.locationContainer}>
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} style={styles.locationIcon} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.user?.district ? `${item.user.district}, ${item.user.taluk || ''}` : 'Location N/A'}
                  </Text>
                </View>

                <View style={styles.balanceGrid}>
                  <Text style={styles.balanceLabel}>
                    Gave: <Text style={styles.balanceGave}>₹{formattedGave}</Text>
                  </Text>
                  <Text style={styles.balanceLabel}>
                    Got: <Text style={styles.balanceGot}>₹{formattedGot}</Text>
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Floating Add Pill Button */}
      <Pressable
        style={[
          styles.floatingAddBtn,
          { backgroundColor: activeTab === 'Customer' ? '#9d1c59' : '#0f766e' }
        ]}
        onPress={() => {
          setFormDistrict('Erode');
          setFormTaluk('Erode');
          setIsCreateModalVisible(true);
        }}
      >
        <Ionicons name="person-add" size={16} color="#fff" />
        <Text style={styles.floatingAddBtnText}>
          ADD {activeTab === 'Customer' ? 'CUSTOMER' : 'SUPPLIER'}
        </Text>
      </Pressable>

      {/* Creation Modal for New Customer / Supplier in Ledger Screen */}
      <Modal visible={isCreateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                ➕ Create New {activeTab}
              </Text>
              <Pressable onPress={() => setIsCreateModalVisible(false)} style={styles.closeBox}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={styles.label}>{activeTab} Name *</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. John Doe"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>10-Digit Mobile *</Text>
              <TextInput
                style={styles.input}
                value={formMobile}
                onChangeText={(v) => setFormMobile(v.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="e.g. 9876543210"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Alternative Mobile (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formAltMobile}
                onChangeText={(v) => setFormAltMobile(v.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="e.g. 9876543211"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>District *</Text>
              <View style={styles.modalPickerWrapper}>
                <Picker
                  selectedValue={formDistrict}
                  onValueChange={(val) => {
                    setFormDistrict(val);
                    setFormTaluk(ALLOWED_LOCATIONS[val][0]);
                  }}
                  style={styles.modalPicker}
                  dropdownIconColor={colors.primary}
                >
                  {Object.keys(ALLOWED_LOCATIONS).map((dist) => (
                    <Picker.Item key={dist} label={dist} value={dist} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Taluk *</Text>
              <View style={styles.modalPickerWrapper}>
                <Picker
                  selectedValue={formTaluk}
                  onValueChange={setFormTaluk}
                  style={styles.modalPicker}
                  dropdownIconColor={colors.primary}
                >
                  {ALLOWED_LOCATIONS[formDistrict].map((taluk) => (
                    <Picker.Item key={taluk} label={taluk} value={taluk} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Pincode (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formPincode}
                onChangeText={(v) => setFormPincode(v.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                maxLength={6}
                placeholder="e.g. 638001"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Opening Balance (₹)</Text>
              <TextInput
                style={styles.input}
                value={formOpeningBalance}
                onChangeText={(v) => setFormOpeningBalance(v.replace(/[^\d.]/g, ''))}
                keyboardType="numeric"
                placeholder="e.g. 500"
                placeholderTextColor={colors.textMuted}
              />



              <Pressable
                style={[styles.submitBtn, { backgroundColor: activeTab === 'Customer' ? '#9d1c59' : '#0f766e' }]}
                onPress={handleCreateUser}
              >
                <Text style={styles.submitBtnText}>Create & Register</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
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
  topHeader: {
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: spacing.md,
    paddingBottom: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    ...shadows.sm,
  },
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 16,
  },
  topHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  menuBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 10,
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '800',
  },
  activeTabUnderline: {
    position: 'absolute',
    bottom: 0,
    width: 64,
    height: 3,
    backgroundColor: '#fbbf24',
    borderRadius: 2,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerContainer: {
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    ...shadows.sm,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.6,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullStatCard: {
    minWidth: '100%',
    padding: spacing.md,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 4,
  },
  statValueCompact: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 4,
  },
  statSub: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // Filters Card
  filterCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    height: 48,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerCol: {
    flex: 1,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text,
    height: 48,
  },
  pickerPlaceholderItem: {
    fontSize: 13,
  },
  disabledPicker: {
    opacity: 0.5,
  },

  // List Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Customer Card
  customerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.85,
    backgroundColor: '#fafafa',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  custInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  phoneIcon: {
    marginRight: 4,
  },
  customerMobile: {
    fontSize: 12,
    color: colors.textMuted,
  },
  netBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  netBadgeSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  balanceGrid: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  balanceGave: {
    color: colors.danger,
    fontWeight: '700',
  },
  balanceGot: {
    color: colors.success,
    fontWeight: '700',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },

  // Floating Add Button
  floatingAddBtn: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
    ...shadows.md,
    elevation: 5,
  },
  floatingAddBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  closeBox: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '700',
  },
  formContainer: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  modalPickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  modalPicker: {
    color: colors.text,
    height: 48,
  },
  submitBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.sm,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
