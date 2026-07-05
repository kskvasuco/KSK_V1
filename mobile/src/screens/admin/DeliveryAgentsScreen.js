import { useState, useEffect } from 'react';
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
} from 'react-native';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';

export default function DeliveryAgentsScreen() {
  const cleanName = (val) => val ? val.replace(/\s*-\s*\d{2}-\d{2}-\d{4}$/, '') : '';

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Details Modal States
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentRecords, setAgentRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('deliveries'); // 'deliveries' or 'overview'

  // Edit Agent Modal States
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    mobile: '',
    description: '',
    address: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Add Agent Modal States
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({
    name: '',
    mobile: '',
    description: '',
    address: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  // Confirm Cash Modal States
  const [confirmBatchData, setConfirmBatchData] = useState(null);
  const [confirmCashAmount, setConfirmCashAmount] = useState('');
  const [confirmCashVisible, setConfirmCashVisible] = useState(false);
  const [confirmCashMode, setConfirmCashMode] = useState('Cash');
  const [confirmCashDate, setConfirmCashDate] = useState('');
  const [viewItemsBatch, setViewItemsBatch] = useState(null);
  const [viewItemsVisible, setViewItemsVisible] = useState(false);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getDeliveryAgents();
      setAgents(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load delivery agents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  const filteredAgents = agents.filter((a) => {
    const q = searchQuery.toLowerCase();
    const name = (a.name || '').toLowerCase();
    const mobile = (a.mobile || '');
    return name.includes(q) || mobile.includes(q);
  });

  const openDetailModal = async (agent) => {
    setSelectedAgent(agent);
    setDetailVisible(true);
    setRecordsLoading(true);
    setActiveTab('deliveries');
    try {
      const records = await adminApi.getAgentRecords(agent._id);
      setAgentRecords(Array.isArray(records) ? records : []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load driver logs.');
    } finally {
      setRecordsLoading(false);
    }
  };

  const openEditModal = () => {
    // Determine current details from either records or agent summary
    const firstRec = agentRecords[0] || {};
    const agentDetails = firstRec.deliveryAgent || {};

    setEditForm({
      name: agentDetails.name || selectedAgent.name || '',
      mobile: agentDetails.mobile || selectedAgent.mobile || '',
      description: agentDetails.description || '',
      address: agentDetails.address || '',
    });
    setEditVisible(true);
  };

  const saveAgentDetails = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Validation Error', 'Please enter driver name.');
      return;
    }

    try {
      setEditLoading(true);
      // Collect all delivery IDs associated with this driver to update them in batch
      const deliveryIds = agentRecords.map((r) => r._id);
      if (deliveryIds.length === 0) {
        Alert.alert('Configuration Error', 'Cannot edit agent credentials: No historical records found.');
        return;
      }

      await adminApi.updateDeliveryAgent(
        deliveryIds,
        editForm.name.trim(),
        editForm.mobile.trim(),
        editForm.description.trim(),
        editForm.address.trim()
      );

      Alert.alert('Success', 'Driver details updated across all historical records.');
      setEditVisible(false);
      
      // Reload details and list
      const records = await adminApi.getAgentRecords(selectedAgent._id);
      setAgentRecords(Array.isArray(records) ? records : []);
      loadAgents();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update agent details.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgentForm.name.trim()) {
      Alert.alert('Validation Error', 'Driver name is required');
      return;
    }
    try {
      setAddLoading(true);
      await adminApi.createDeliveryAgent({
        name: newAgentForm.name.trim(),
        mobile: newAgentForm.mobile.trim(),
        description: newAgentForm.description.trim(),
        address: newAgentForm.address.trim()
      });
      Alert.alert('Success', 'Driver registered successfully');
      setAddModalVisible(false);
      loadAgents();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create driver');
    } finally {
      setAddLoading(false);
    }
  };

  // Helper calculation for financial stats
  const getAgentStats = () => {
    let totalCashCollected = 0;
    let totalRentCharge = 0;
    agentRecords.forEach((r) => {
      totalCashCollected += r.receivedAmount || 0;
      totalRentCharge += r.agentCharge || 0;
    });
    return { totalCashCollected, totalRentCharge };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getGroupedRecords = () => {
    const groups = {};
    agentRecords.forEach((r) => {
      const key = r.dispatchId ? r.dispatchId : `single_${r._id}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          dispatchId: r.dispatchId || null,
          deliveryDate: r.deliveryDate || r.createdAt,
          confirmedAt: r.confirmedAt || null,
          isConfirmed: r.isConfirmed || false,
          items: [],
          totalExpected: 0,
          totalReceived: 0,
          totalAgentCharge: 0,
        };
      }
      groups[key].items.push(r);
      groups[key].totalExpected += r.expectedAmount || 0;
      groups[key].totalReceived += r.receivedAmount || 0;
      groups[key].totalAgentCharge += r.agentCharge || 0;
      if (r.confirmedAt) {
        groups[key].confirmedAt = r.confirmedAt;
      }
      if (r.isConfirmed) {
        groups[key].isConfirmed = true;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));
  };

  const stats = getGroupedRecords().reduce(
    (acc, g) => {
      acc.totalCashCollected += g.totalReceived;
      acc.totalRentCharge += g.totalAgentCharge;
      return acc;
    },
    { totalCashCollected: 0, totalRentCharge: 0 }
  );

  if (loading && agents.length === 0) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={styles.headerTitle}>Driver Registry ({filteredAgents.length})</Text>
          <Pressable 
            style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
            onPress={() => {
              setNewAgentForm({ name: '', mobile: '', description: '', address: '' });
              setAddModalVisible(true);
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>+ Add Driver</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.searchBar}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="🔍 Search drivers by name or phone..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <FlatList
        data={filteredAgents}
        keyExtractor={(item) => item._id || String(Math.random())}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🚛</Text>
            <Text style={styles.empty}>No dispatch drivers registered yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => openDetailModal(item)}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarIcon}>👨‍✈️</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name || 'Unknown Driver'}</Text>
                <Text style={styles.cardPhone}>📞 {item.mobile || 'No contact'}</Text>
                <Text style={styles.cardLastActive}>Active: {formatDate(item.lastDate)}</Text>
              </View>
              <View style={styles.deliveriesBadge}>
                <Text style={styles.deliveriesBadgeText}>{item.totalDeliveries}</Text>
                <Text style={styles.deliveriesBadgeLabel}>trips</Text>
              </View>
            </View>
          </Pressable>
        )}
      />

      {/* Driver Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { height: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedAgent?.name || 'Driver Details'}</Text>
                {selectedAgent?.mobile ? <Text style={styles.modalSubtitle}>📞 {selectedAgent.mobile}</Text> : null}
              </View>
              <Pressable onPress={() => setDetailVisible(false)} style={styles.closeBox}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.detailTabRow}>
              <Pressable
                style={[styles.detailTab, activeTab === 'deliveries' && styles.detailTabActive]}
                onPress={() => setActiveTab('deliveries')}
              >
                <Text style={[styles.detailTabText, activeTab === 'deliveries' && styles.detailTabTextActive]}>
                  📦 Dispatch Logs
                </Text>
              </Pressable>
              <Pressable
                style={[styles.detailTab, activeTab === 'overview' && styles.detailTabActive]}
                onPress={() => setActiveTab('overview')}
              >
                <Text style={[styles.detailTabText, activeTab === 'overview' && styles.detailTabTextActive]}>
                  👤 Driver Profile
                </Text>
              </Pressable>
            </View>

            {recordsLoading ? (
              <Loading />
            ) : activeTab === 'deliveries' ? (
              <View style={{ flex: 1 }}>
                <FlatList
                  data={getGroupedRecords()}
                  keyExtractor={(item) => item.key}
                  contentContainerStyle={styles.recordsList}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyEmoji}>📦</Text>
                      <Text style={styles.empty}>No delivery history available.</Text>
                    </View>
                  }
                  renderItem={({ item: group }) => (
                    <View style={styles.recordCard}>
                      <View style={styles.recordHeader}>
                        <Text style={styles.recordOrderId}>
                          {group.dispatchId ? `🚛 Batch: ${group.dispatchId}` : '📦 Single Delivery'}
                        </Text>
                        <Text style={styles.recordDate}>{formatDate(group.deliveryDate)}</Text>
                      </View>

                      {group.items.map((subItem, idx) => (
                        <Pressable 
                          key={subItem._id || String(idx)} 
                          onPress={() => {
                            setViewItemsBatch(group);
                            setViewItemsVisible(true);
                          }}
                          style={({ pressed }) => [
                            styles.subItemContainer, 
                            idx > 0 && styles.subItemBorder,
                            pressed && { backgroundColor: '#f8fafc' }
                          ]}
                        >
                          <View style={styles.subItemRow}>
                            <Text style={styles.subItemOrderTitle}>
                              Order: <Text style={styles.boldText}>{subItem.order?.customOrderId || 'Walk-in'}</Text>
                            </Text>
                          </View>
                          <Text style={styles.recordCustomer}>
                            Customer: <Text style={styles.boldText}>{subItem.order?.user?.name || 'Walk-in'}</Text> ({subItem.order?.user?.mobile || 'No mobile'})
                          </Text>

                          <View style={styles.recordGrid}>
                            <View style={styles.recordGridCol}>
                              <Text style={styles.gridLabel}>Delivered Item</Text>
                              <Text style={[styles.gridValue, { color: colors.primary, textDecorationLine: 'underline' }]}>{cleanName(subItem.name)}</Text>
                              <Text style={styles.gridSubValue}>{subItem.quantityDelivered} {subItem.unit || 'Pcs'}</Text>
                            </View>
                            <View style={styles.recordGridCol}>
                              <Text style={styles.gridLabel}>Expected Cash</Text>
                              <Text style={[styles.gridValue, { color: colors.primary }]}>₹{subItem.expectedAmount || 0}</Text>
                            </View>
                            <View style={styles.recordGridCol}>
                              <Text style={styles.gridLabel}>Collected Cash</Text>
                              <Text style={[styles.gridValue, { color: colors.success }]}>₹{subItem.receivedAmount || 0}</Text>
                              {subItem.paymentMode ? <Text style={styles.paymentBadge}>{subItem.paymentMode}</Text> : null}
                            </View>
                            <View style={styles.recordGridCol}>
                              <Text style={styles.gridLabel}>Driver Rent</Text>
                              <Text style={[styles.gridValue, { color: colors.purple }]}>₹{subItem.agentCharge || 0}</Text>
                            </View>
                          </View>
                        </Pressable>
                      ))}

                      <View style={styles.batchCardFooter}>
                        <Text style={styles.batchFooterLabel}>Batch Summary:</Text>
                        <View style={styles.batchFooterStats}>
                          <Text style={styles.batchStatText}>Exp: <Text style={[styles.boldText, { color: colors.primary }]}>₹{group.totalExpected}</Text></Text>
                          <Text style={styles.batchStatText}>
                            Coll: <Text style={[styles.boldText, { color: colors.success }]}>₹{group.totalReceived}</Text>
                            {Array.from(new Set(group.items.map(r => r.paymentMode).filter(Boolean))).length > 0 ? ` (${Array.from(new Set(group.items.map(r => r.paymentMode).filter(Boolean))).join(', ')})` : ''}
                          </Text>
                          <Text style={styles.batchStatText}>Rent: <Text style={[styles.boldText, { color: colors.purple }]}>₹{group.totalAgentCharge}</Text></Text>
                        </View>
                      </View>

                      {group.isConfirmed && group.confirmedAt && (
                        <View style={{ paddingHorizontal: 12, paddingBottom: 10, alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 11, color: colors.textMuted || '#64748b' }}>
                            Collected On: {formatDate(group.confirmedAt)} {new Date(group.confirmedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </Text>
                        </View>
                      )}

                      {!group.isConfirmed && (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 12, paddingBottom: 12 }}>
                          <Pressable
                            style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                            onPress={() => {
                              const firstItem = group.items[0];
                              const orderId = firstItem.order?._id || firstItem.order;
                              setConfirmBatchData({
                                orderId,
                                date: group.deliveryDate,
                                expected: group.totalExpected
                              });
                              setConfirmCashAmount(String(group.totalAgentCharge));
                              const dt = new Date();
                              const tzOffset = dt.getTimezoneOffset() * 60000;
                              const localISOTime = (new Date(dt.getTime() - tzOffset)).toISOString().slice(0, 16);
                              setConfirmCashDate(localISOTime);
                              setConfirmCashVisible(true);
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>💰 Confirm Cash</Text>
                          </Pressable>

                          <Pressable
                            style={{ backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                            onPress={() => {
                              const firstItem = group.items[0];
                              const orderId = firstItem.order?._id || firstItem.order;
                              
                              Alert.alert(
                                'Close Balance (No Entry)',
                                'Close balance for this batch with no cash entry?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Close',
                                    style: 'destructive',
                                    onPress: async () => {
                                      try {
                                        await adminApi.confirmDeliveryBatch(orderId, group.deliveryDate, 0, true, null);
                                        Alert.alert('Success', 'Batch balance closed (no cash).');
                                        const records = await adminApi.getAgentRecords(selectedAgent._id);
                                        setAgentRecords(Array.isArray(records) ? records : []);
                                        loadAgents();
                                      } catch (e) {
                                        Alert.alert('Error', e.message || 'Failed to close batch');
                                      }
                                    }
                                  }
                                ]
                              );
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓ Close (No Entry)</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                />

                {/* Sticky Financial stats bar */}
                <View style={styles.financialStatsBar}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Cash Collections</Text>
                    <Text style={styles.statValCash}>₹{stats.totalCashCollected}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Rent Charges Due</Text>
                    <Text style={styles.statValRent}>₹{stats.totalRentCharge}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.overviewContainer}>
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewTitle}>Logistics Details</Text>
                  
                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewLabel}>Driver Name:</Text>
                    <Text style={styles.overviewValue}>{agentRecords[0]?.deliveryAgent?.name || selectedAgent?.name || 'N/A'}</Text>
                  </View>

                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewLabel}>Mobile Contact:</Text>
                    <Text style={styles.overviewValue}>{agentRecords[0]?.deliveryAgent?.mobile || selectedAgent?.mobile || 'N/A'}</Text>
                  </View>

                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewLabel}>Description / Notes:</Text>
                    <Text style={styles.overviewValue}>{agentRecords[0]?.deliveryAgent?.description || 'No description notes available.'}</Text>
                  </View>

                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewLabel}>Home Address:</Text>
                    <Text style={styles.overviewValue}>{agentRecords[0]?.deliveryAgent?.address || 'No physical address configured.'}</Text>
                  </View>
                </View>

                <Pressable style={styles.editAgentBtn} onPress={openEditModal}>
                  <Text style={styles.editAgentBtnText}>✏️ Edit Driver Profile</Text>
                </Pressable>

                <Pressable 
                  style={[styles.editAgentBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, marginTop: 12 }]} 
                  onPress={async () => {
                    Alert.alert(
                      'Clear Driver Registry',
                      `Are you sure you want to completely clear agent "${selectedAgent?.name}" from the system?\n\nThis will remove them from all active orders and mark historical logs as "Unassigned".`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear Driver',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await adminApi.clearDeliveryAgent(selectedAgent._id || selectedAgent.name);
                              Alert.alert('Success', 'Driver cleared successfully.');
                              setDetailVisible(false);
                              loadAgents();
                            } catch (e) {
                              Alert.alert('Error', e.message || 'Failed to clear driver.');
                            }
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={[styles.editAgentBtnText, { color: '#ef4444' }]}>🗑️ Clear Driver from System</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Agent Modal */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modify Driver Profile</Text>
              <Pressable onPress={() => setEditVisible(false)} style={styles.closeBox}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={styles.label}>Driver Name *</Text>
              <TextInput
                style={styles.input}
                value={editForm.name}
                onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
                placeholder="Driver Name"
              />

              <Text style={styles.label}>Mobile Contact Number</Text>
              <TextInput
                style={styles.input}
                value={editForm.mobile}
                onChangeText={(v) => setEditForm((f) => ({ ...f, mobile: v.replace(/\D/g, '') }))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="10-digit Mobile Number"
              />

              <Text style={styles.label}>Driver Description / Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editForm.description}
                onChangeText={(v) => setEditForm((f) => ({ ...f, description: v }))}
                placeholder="Vehicle number, license class, rating, etc."
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Physical Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editForm.address}
                onChangeText={(v) => setEditForm((f) => ({ ...f, address: v }))}
                placeholder="Driver's home address"
                multiline
                numberOfLines={3}
              />

              <Pressable
                style={[styles.saveBtn, editLoading && styles.disabled]}
                onPress={saveAgentDetails}
                disabled={editLoading}
              >
                <Text style={styles.saveBtnText}>
                  {editLoading ? 'Saving changes...' : 'Save Configurations'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Agent Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register New Driver</Text>
              <Pressable onPress={() => setAddModalVisible(false)} style={styles.closeBox}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={styles.label}>Driver Name *</Text>
              <TextInput
                style={styles.input}
                value={newAgentForm.name}
                onChangeText={(v) => setNewAgentForm((f) => ({ ...f, name: v }))}
                placeholder="Driver's Full Name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Mobile Contact Number</Text>
              <TextInput
                style={styles.input}
                value={newAgentForm.mobile}
                onChangeText={(v) => setNewAgentForm((f) => ({ ...f, mobile: v.replace(/\D/g, '') }))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="10-digit Mobile Number"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Driver Description / Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newAgentForm.description}
                onChangeText={(v) => setNewAgentForm((f) => ({ ...f, description: v }))}
                placeholder="Vehicle details, License plate, etc."
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Physical Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newAgentForm.address}
                onChangeText={(v) => setNewAgentForm((f) => ({ ...f, address: v }))}
                placeholder="Home physical address"
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.textMuted}
              />

              <Pressable
                style={[styles.saveBtn, addLoading && styles.disabled]}
                onPress={handleCreateAgent}
                disabled={addLoading}
              >
                <Text style={styles.saveBtnText}>
                  {addLoading ? 'Registering...' : 'Register Driver'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Cash Modal */}
      <Modal visible={confirmCashVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, width: '100%' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 }}>Confirm Cash Collection</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>
              Expected: ₹{confirmBatchData?.expected}
            </Text>

            {/* Payment Method (Top) */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Payment Method *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {['Cash', 'GPay', 'PhonePe', 'Bank Transfer', 'Other'].map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setConfirmCashMode(mode)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: confirmCashMode === mode ? colors.primary : colors.border,
                    backgroundColor: confirmCashMode === mode ? colors.primary + '12' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '650', color: confirmCashMode === mode ? colors.primary : colors.textMuted }}>{mode}</Text>
                </Pressable>
              ))}
            </View>

            {/* Date (Middle) */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Date (YYYY-MM-DD HH:MM) *</Text>
            <TextInput
              style={[styles.input, { marginBottom: 14 }]}
              value={confirmCashDate}
              onChangeText={setConfirmCashDate}
              placeholder="e.g. 2026-07-05 22:35"
              placeholderTextColor={colors.textMuted}
            />

            {/* Collected Amount (Last) */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Collected Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={confirmCashAmount}
              onChangeText={setConfirmCashAmount}
              keyboardType="numeric"
              placeholder="Enter collected cash amount"
              placeholderTextColor={colors.textMuted}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Pressable 
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setConfirmCashVisible(false)}
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary }}
                onPress={async () => {
                  if (!confirmBatchData) return;
                  const amount = parseFloat(confirmCashAmount) || 0;
                  const confirmedDateStr = confirmCashDate ? new Date(confirmCashDate.replace(' ', 'T')).toISOString() : new Date().toISOString();
                  try {
                    await adminApi.confirmDeliveryBatch(confirmBatchData.orderId, confirmBatchData.date, amount, amount === 0, confirmCashMode, confirmedDateStr);
                    Alert.alert('Success', 'Batch balance confirmed successfully.');
                    setConfirmCashVisible(false);
                    setConfirmCashAmount('');
                    const records = await adminApi.getAgentRecords(selectedAgent._id);
                    setAgentRecords(Array.isArray(records) ? records : []);
                    loadAgents();
                  } catch (e) {
                    Alert.alert('Error', e.message || 'Failed to confirm batch');
                  }
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>💰 Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Items Popup Modal */}
      <Modal visible={viewItemsVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, width: '100%', maxHeight: '60%' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 }}>Delivered Products</Text>
            {viewItemsBatch && (
              <>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
                  Order: {viewItemsBatch.customOrderId} ({viewItemsBatch.customer || 'Unknown'})
                </Text>
                <ScrollView contentContainerStyle={{ gap: 8 }} style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 12, marginVertical: 8 }}>
                  {viewItemsBatch.items.map((record, index) => (
                    <View key={record._id || String(index)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                      <Text style={{ fontWeight: '600', color: colors.text, fontSize: 13 }}>{cleanName(record.name || record.product?.name || 'Custom Product')}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '500' }}>{record.quantityDelivered} {record.product?.unit || record.unit || 'Pcs'}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <Pressable 
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary }}
                onPress={() => setViewItemsVisible(false)}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    gap: spacing.sm,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  searchBar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: colors.background,
    color: colors.text,
  },
  listContainer: { padding: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: { fontSize: 24 },
  cardInfo: { flex: 1, marginLeft: spacing.md, gap: 2 },
  cardName: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardPhone: { fontSize: 13, color: colors.textMuted },
  cardLastActive: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  deliveriesBadge: {
    backgroundColor: colors.lightInfo,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveriesBadgeText: { fontSize: 16, fontWeight: '800', color: colors.info },
  deliveriesBadgeLabel: { fontSize: 9, fontWeight: '600', color: colors.info, textTransform: 'uppercase', marginTop: 1 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 16 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  editModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1.5,
    borderColor: colors.border,
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
  modalSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBox: { padding: 4 },
  closeText: { fontSize: 18, color: colors.textMuted, fontWeight: '700' },
  
  detailTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  detailTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  detailTabActive: {
    borderColor: colors.primary,
  },
  detailTabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  detailTabTextActive: { color: colors.primary, fontWeight: '700' },

  recordsList: { padding: spacing.md },
  recordCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  recordOrderId: { fontSize: 14, fontWeight: '800', color: colors.primary },
  recordDate: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  recordCustomer: { fontSize: 12, color: colors.text, marginBottom: spacing.sm },
  boldText: { fontWeight: '700' },

  subItemContainer: {
    marginTop: 6,
    paddingTop: 6,
  },
  subItemBorder: {
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12,
    paddingTop: 12,
  },
  subItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subItemOrderTitle: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  batchCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderColor: '#cbd5e1',
    marginTop: 12,
    paddingTop: 8,
  },
  batchFooterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  batchFooterStats: {
    flexDirection: 'row',
    gap: 8,
  },
  batchStatText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  
  recordGrid: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  recordGridCol: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  gridValue: { fontSize: 11, fontWeight: '800', color: colors.text, textAlign: 'center' },
  gridSubValue: { fontSize: 9, color: colors.textMuted, marginTop: 1 },
  paymentBadge: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: colors.success,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 4,
  },
  dispatchRow: { flexDirection: 'row', gap: 4, marginTop: 8, alignItems: 'center' },
  dispatchLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  dispatchVal: { fontSize: 10, color: colors.text, fontWeight: '700' },

  financialStatsBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.lg,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  statValCash: { fontSize: 18, fontWeight: '800', color: colors.success },
  statValRent: { fontSize: 18, fontWeight: '800', color: colors.purple },

  overviewContainer: { padding: spacing.lg, gap: spacing.md },
  overviewCard: {
    backgroundColor: '#fafafa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: spacing.md,
    gap: spacing.sm,
  },
  overviewTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  overviewRow: { borderBottomWidth: 1, borderColor: '#eef2f3', paddingBottom: spacing.sm },
  overviewLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  overviewValue: { fontSize: 13, color: colors.text, fontWeight: '700', lineHeight: 18 },
  editAgentBtn: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  editAgentBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Edit Modal form
  formContainer: { padding: spacing.lg },
  label: { fontWeight: '700', fontSize: 13, color: colors.text, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  textArea: { height: 75, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
});
