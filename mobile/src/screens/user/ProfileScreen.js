import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import * as userApi from '../../api/userApi';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

export default function ProfileScreen() {
  const { profile, checkAuth, logout } = useAuth();
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

  if (!profile) return <Loading />;

  const taluks = form.district ? locations[form.district] || [] : [];

  const save = async () => {
    try {
      setSaving(true);
      await userApi.updateUserProfile(form);
      await checkAuth();
      setEditing(false);
      Alert.alert('Success', 'Profile updated.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, name, ...props }) =>
    editing ? (
      <TextInput
        style={styles.input}
        value={form[name]}
        onChangeText={(v) => setForm((f) => ({ ...f, [name]: v }))}
        {...props}
      />
    ) : (
      <Text style={styles.value}>{form[name] || '—'}</Text>
    );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.mobile}>Mobile: {profile.mobile}</Text>

      <Text style={styles.label}>Name</Text>
      <Field label="Name" name="name" />
      <Text style={styles.label}>Email</Text>
      <Field label="Email" name="email" keyboardType="email-address" />
      <Text style={styles.label}>Alt. Mobile</Text>
      <Field label="Alt" name="altMobile" keyboardType="phone-pad" maxLength={10} />

      {editing ? (
        <>
          <Text style={styles.label}>District</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.district}
              onValueChange={(v) => setForm((f) => ({ ...f, district: v, taluk: '' }))}
            >
              <Picker.Item label="Select district" value="" />
              {Object.keys(locations).map((d) => (
                <Picker.Item key={d} label={d} value={d} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Taluk</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.taluk}
              onValueChange={(v) => setForm((f) => ({ ...f, taluk: v }))}
              enabled={!!form.district}
            >
              <Picker.Item label="Select taluk" value="" />
              {taluks.map((t) => (
                <Picker.Item key={t} label={t} value={t} />
              ))}
            </Picker>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.label}>District / Taluk</Text>
          <Text style={styles.value}>
            {[form.district, form.taluk].filter(Boolean).join(' / ') || '—'}
          </Text>
        </>
      )}

      <Text style={styles.label}>Address</Text>
      <Field label="Address" name="address" multiline />
      <Text style={styles.label}>Pincode</Text>
      <Field label="Pincode" name="pincode" keyboardType="number-pad" maxLength={6} />

      {editing ? (
        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={save} disabled={saving}>
            <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
          <Pressable style={styles.btnOutline} onPress={() => setEditing(false)}>
            <Text style={styles.btnOutlineText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.btn} onPress={() => setEditing(true)}>
          <Text style={styles.btnText}>Edit Profile</Text>
        </Pressable>
      )}

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700' },
  mobile: { color: colors.textMuted, marginBottom: spacing.lg },
  label: { fontWeight: '600', marginTop: spacing.md, marginBottom: 4 },
  value: { fontSize: 16, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.card,
    fontSize: 16,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  btn: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  btnOutlineText: { color: colors.primary, fontWeight: '600' },
  logout: { marginTop: spacing.xl, alignItems: 'center' },
  logoutText: { color: colors.danger, fontWeight: '600' },
});
