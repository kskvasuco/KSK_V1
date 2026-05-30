import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as userApi from '../../api/userApi';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';

// Fixed focus loss/GBoard disconnect issue by declaring Field component outside render function
function Field({ label, icon, editing, value, onChangeText, ...props }) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <View style={[styles.inputWrapper, styles.inputActive]}>
          <Ionicons name={icon} size={18} color={colors.primary} style={styles.fieldIcon} />
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholderTextColor={colors.textMuted}
            {...props}
          />
        </View>
      ) : (
        <View style={styles.valueWrapper}>
          <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.fieldIcon} />
          <Text style={styles.value} numberOfLines={props.multiline ? 4 : 1}>
            {value || '—'}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { isUser, profile, checkAuth, logout } = useAuth();
  const [locations, setLocations] = useState({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    altMobile: '',
    district: '',
    taluk: '',
    address: '',
    pincode: '',
  });

  useEffect(() => {
    userApi.getLocations().then(setLocations).catch(() => {});
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        email: profile.email || '',
        altMobile: profile.altMobile || '',
        district: profile.district || '',
        taluk: profile.taluk || '',
        address: profile.address || '',
        pincode: profile.pincode || '',
      });
    }
  }, [profile]);

  if (!isUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.guestContainer}>
          <View style={styles.guestIconCircle}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={styles.guestTitle}>LOGIN TO ACCESS</Text>
          <Text style={styles.guestMsg}>
            Please sign in to view and manage your profile details, contact information, and shipping address.
          </Text>
          <Pressable style={styles.guestBtn} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="key-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.guestBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) return <Loading />;

  const taluks = form.district ? locations[form.district] || [] : [];

  const save = async () => {
    try {
      setSaving(true);
      await userApi.updateUserProfile(form);
      await checkAuth();
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (n) => {
    if (!n) return 'KSK';
    return n
      .split(' ')
      .filter(Boolean)
      .map((x) => x[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Top Header Row with Edit Profile and Logout */}
        <View style={styles.topHeaderBar}>
          {editing ? (
            <View style={{ width: 40 }} />
          ) : (
            <Pressable style={styles.topEditBtn} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.topEditBtnText}>Edit Profile</Text>
            </Pressable>
          )}
          
          <Pressable style={styles.topLogoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={14} color={colors.danger} style={{ marginRight: 4 }} />
            <Text style={styles.topLogoutBtnText}>Logout</Text>
          </Pressable>
        </View>
        
        {/* Dynamic Futuristic Header */}
        <View style={styles.heroSection}>
          <View style={styles.avatarGlowOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
            </View>
            <View style={styles.avatarStatusBadge} />
          </View>

          <Text style={styles.heroName}>{profile.name || 'Anonymous User'}</Text>
          
          <View style={styles.nodeStatusContainer}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            <Text style={styles.nodeStatusText}>SECURE USER NODE</Text>
          </View>
        </View>

        {/* Combined Single Profile Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
            <Text style={styles.cardHeaderText}>PROFILE</Text>
          </View>
          
          {/* Read-Only Mobile Primary Key */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Mobile Number (Primary)</Text>
            <View style={[styles.valueWrapper, styles.disabledValueWrapper]}>
              <Ionicons name="lock-closed" size={18} color={colors.textMuted} style={styles.fieldIcon} />
              <Text style={[styles.value, styles.disabledValue]}>{profile.mobile}</Text>
            </View>
          </View>

          {/* Core Fields with Pristine Icons */}
          <Field
            label="Full Name"
            icon="person-outline"
            placeholder="Enter full name"
            editing={editing}
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
          />
          
          <Field
            label="Email Address"
            icon="mail-outline"
            keyboardType="email-address"
            placeholder="Enter email"
            editing={editing}
            value={form.email}
            onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
          />
          
          <Field
            label="Alternative Contact"
            icon="call-outline"
            keyboardType="phone-pad"
            maxLength={10}
            placeholder="Alt mobile number"
            editing={editing}
            value={form.altMobile}
            onChangeText={(v) => setForm((f) => ({ ...f, altMobile: v }))}
          />

          {/* District / Taluk Section */}
          {editing ? (
            <>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>District</Text>
                <View style={styles.pickerWrap}>
                  <Ionicons name="map-outline" size={18} color={colors.primary} style={styles.pickerIcon} />
                  <Picker
                    selectedValue={form.district}
                    onValueChange={(v) => setForm((f) => ({ ...f, district: v, taluk: '' }))}
                    style={styles.picker}
                    dropdownIconColor={colors.primary}
                  >
                    <Picker.Item label="Select District" value="" style={styles.pickerItem} />
                    {Object.keys(locations).map((d) => (
                      <Picker.Item key={d} label={d} value={d} style={styles.pickerItem} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Taluk</Text>
                <View style={[styles.pickerWrap, !form.district && styles.pickerDisabled]}>
                  <Ionicons name="location-outline" size={18} color={colors.primary} style={styles.pickerIcon} />
                  <Picker
                    selectedValue={form.taluk}
                    onValueChange={(v) => setForm((f) => ({ ...f, taluk: v }))}
                    enabled={!!form.district}
                    style={styles.picker}
                    dropdownIconColor={colors.primary}
                  >
                    <Picker.Item label="Select Taluk" value="" style={styles.pickerItem} />
                    {taluks.map((t) => (
                      <Picker.Item key={t} label={t} value={t} style={styles.pickerItem} />
                    ))}
                  </Picker>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Region</Text>
              <View style={styles.valueWrapper}>
                <Ionicons name="map-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
                <Text style={styles.value}>
                  {[form.district, form.taluk].filter(Boolean).join(' / ') || '—'}
                </Text>
              </View>
            </View>
          )}

          {/* Delivery & Pincode with pristine Icons */}
          <Field
            label="Delivery Address"
            icon="business-outline"
            multiline
            placeholder="Enter complete address"
            editing={editing}
            value={form.address}
            onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
          />
          
          <Field
            label="Postal Pin Code"
            icon="pin-outline"
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit pincode"
            editing={editing}
            value={form.pincode}
            onChangeText={(v) => setForm((f) => ({ ...f, pincode: v }))}
          />
        </View>

        {/* Action Controls Row - with Normal Names */}
        {editing && (
          <View style={styles.actionRow}>
            <Pressable style={[styles.btn, styles.btnSave]} onPress={save} disabled={saving}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
            <Pressable style={styles.btnCancel} onPress={() => setEditing(false)}>
              <Ionicons name="close-circle-outline" size={20} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.btnCancelText}>Cancel</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  topEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 255, 0.05)',
    borderColor: 'rgba(0, 102, 255, 0.12)',
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  topEditBtnText: {
    color: colors.primary,
    fontWeight: '750',
    fontSize: 12,
  },
  topLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 75, 75, 0.05)',
    borderColor: 'rgba(255, 75, 75, 0.12)',
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  topLogoutBtnText: {
    color: colors.danger,
    fontWeight: '750',
    fontSize: 12,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  avatarGlowOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
    backgroundColor: colors.background,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  avatarStatusBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: colors.background,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.md,
    letterSpacing: 0.5,
  },
  nodeStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGreen || 'rgba(0, 222, 148, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 222, 148, 0.2)',
  },
  nodeStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    marginLeft: 6,
    letterSpacing: 1,
  },
  glassCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  cardHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 8,
    letterSpacing: 1.5,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  valueWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabledValueWrapper: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderColor: 'transparent',
  },
  fieldIcon: {
    marginRight: 10,
  },
  value: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  disabledValue: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  inputActive: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
    fontWeight: '500',
  },
  pickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  pickerIcon: {
    marginRight: 4,
  },
  pickerDisabled: {
    opacity: 0.5,
  },
  picker: {
    flex: 1,
    color: colors.text,
    ...Platform.select({
      android: {
        height: 48,
      },
    }),
  },
  pickerItem: {
    fontSize: 14,
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    ...shadows.md,
  },
  btnEdit: {
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  btnSave: {
    flex: 1.5,
    backgroundColor: colors.success,
  },
  btnCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  btnCancelText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingVertical: 12,
    backgroundColor: colors.lightRed || 'rgba(255, 75, 75, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 75, 0.2)',
  },
  logoutButtonText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
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
