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

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTaluk, setSelectedTaluk] = useState('');

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch stats summary
      const sumRes = await adminApi.getLedgerSummary();
      if (sumRes) {
        const totalYouGave = sumRes.totalYouGave !== undefined ? sumRes.totalYouGave : (sumRes.totalWillGet || 0);
        const totalYouGot = sumRes.totalYouGot !== undefined ? sumRes.totalYouGot : (sumRes.totalWillGive || 0);
        const netBalance = sumRes.netBalance !== undefined ? sumRes.netBalance : (totalYouGot - totalYouGave);
        setSummary({ netBalance, totalYouGave, totalYouGot });
      } else {
        setSummary({ netBalance: 0, totalYouGave: 0, totalYouGot: 0 });
      }

      // Fetch customers list
      const custRes = await adminApi.getLedgerCustomers();
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
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

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

  // Filter customers reactively
  const filteredCustomers = (customers || []).filter((c) => {
    if (!c || !c.user) return false;
    const q = searchQuery.toLowerCase();
    const name = (c.user?.name || '').toLowerCase();
    const mobile = c.user?.mobile || '';
    const dist = (c.user?.district || '').toLowerCase();
    const tlk = (c.user?.taluk || '').toLowerCase();

    const matchesSearch = name.includes(q) || mobile.includes(q);
    const matchesDistrict = !selectedDistrict || c.user?.district === selectedDistrict;
    const matchesTaluk = !selectedTaluk || c.user?.taluk === selectedTaluk;

    return matchesSearch && matchesDistrict && matchesTaluk;
  });

  if (loading && !refreshing) {
    return <Loading />;
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Title & Sync Row */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>📖 Digital Ledger</Text>
          <Text style={styles.subtitle}>Track and manage credit balances.</Text>
        </View>
        <Pressable
          style={[styles.syncBtn, syncing && styles.disabledBtn]}
          onPress={handleSyncAll}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="refresh" size={16} color="#fff" />
          )}
          <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync All'}</Text>
        </Pressable>
      </View>

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

        <View style={styles.pickerRow}>
          <View style={styles.pickerCol}>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedDistrict}
                onValueChange={(val) => {
                  setSelectedDistrict(val);
                  setSelectedTaluk('');
                }}
                style={styles.picker}
                dropdownIconColor={colors.primary}
              >
                <Picker.Item label="All Districts" value="" style={styles.pickerPlaceholderItem} />
                {Object.keys(ALLOWED_LOCATIONS).map((dist) => (
                  <Picker.Item key={dist} label={dist} value={dist} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.pickerCol}>
            <View style={[styles.pickerWrapper, !selectedDistrict && styles.disabledPicker]}>
              <Picker
                selectedValue={selectedTaluk}
                onValueChange={setSelectedTaluk}
                style={styles.picker}
                dropdownIconColor={colors.primary}
                enabled={!!selectedDistrict}
              >
                <Picker.Item label="All Taluks" value="" style={styles.pickerPlaceholderItem} />
                {selectedDistrict && ALLOWED_LOCATIONS[selectedDistrict].map((taluk) => (
                  <Picker.Item key={taluk} label={taluk} value={taluk} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
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
            >
              <View style={styles.cardHeader}>
                <View style={styles.custInfoCol}>
                  <Text style={styles.customerName}>{item.user?.name || 'Unknown'}</Text>
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

              <View style={styles.cardActionRow}>
                <Text style={styles.actionText}>Open Statement Ledger</Text>
                <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primary} />
              </View>
            </Pressable>
          );
        }}
      />
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
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
});
