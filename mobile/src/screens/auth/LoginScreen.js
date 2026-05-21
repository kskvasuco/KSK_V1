import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmMobile, setConfirmMobile] = useState('');
  const [roleMode, setRoleMode] = useState('auto'); // auto | user | admin | staff
  const [loading, setLoading] = useState(false);

  const isUserFlow = roleMode === 'user' || (/^\d{10}$/.test(identifier.trim()) && roleMode === 'auto');

  const handleSubmit = async () => {
    const id = identifier.trim();
    if (!id) {
      Alert.alert('Error', 'Please enter mobile number or username.');
      return;
    }

    let pass = password;
    let roleHint = roleMode === 'auto' ? undefined : roleMode;

    if (isUserFlow) {
      if (!confirmMobile) {
        Alert.alert('Error', 'Please confirm your mobile number.');
        return;
      }
      if (!/^\d{10}$/.test(id)) {
        Alert.alert('Error', 'Mobile number must be exactly 10 digits.');
        return;
      }
      if (!/^[6-9]/.test(id)) {
        Alert.alert('Error', 'Enter a valid mobile number.');
        return;
      }
      if (id !== confirmMobile) {
        Alert.alert('Error', 'Mobile numbers do not match.');
        return;
      }
      pass = confirmMobile;
      roleHint = 'user';
    } else if (!pass) {
      Alert.alert('Error', 'Password is required.');
      return;
    }

    try {
      setLoading(true);
      await login(id, pass, roleHint);
    } catch (e) {
      Alert.alert('Login failed', e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>KSK VASU & Co</Text>
        <Text style={styles.subtitle}>Construction Material Service Center</Text>
        <Text style={styles.tamil}>வாடிக்கையாளர்களை அன்புடன் வரவேற்கின்றோம்</Text>

        <View style={styles.roleRow}>
          {['auto', 'user', 'staff', 'admin'].map((r) => (
            <Pressable
              key={r}
              style={[styles.roleChip, roleMode === r && styles.roleChipActive]}
              onPress={() => setRoleMode(r)}
            >
              <Text style={[styles.roleChipText, roleMode === r && styles.roleChipTextActive]}>
                {r === 'auto' ? 'Auto' : r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>
          {isUserFlow ? 'Mobile Number' : 'Username / Mobile'}
        </Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType={isUserFlow ? 'phone-pad' : 'default'}
          maxLength={isUserFlow ? 10 : 50}
          placeholder={isUserFlow ? '10-digit mobile' : 'Username'}
          autoCapitalize="none"
        />

        {isUserFlow ? (
          <>
            <Text style={styles.label}>Confirm Mobile Number</Text>
            <TextInput
              style={styles.input}
              value={confirmMobile}
              onChangeText={setConfirmMobile}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="Re-enter mobile"
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
            />
          </>
        )}

        <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Please wait...' : 'Login'}</Text>
        </Pressable>

        <Text style={styles.hint}>
          Customer: enter the same 10-digit number in both fields. Staff/Admin: use username and password.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: 48 },
  brand: { fontSize: 26, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  subtitle: { textAlign: 'center', color: colors.textMuted, marginTop: 4 },
  tamil: { textAlign: 'center', marginTop: 8, color: colors.text },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.lg, justifyContent: 'center' },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { fontSize: 12, color: colors.text },
  roleChipTextActive: { color: '#fff' },
  label: { marginTop: spacing.md, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    backgroundColor: colors.card,
    fontSize: 16,
  },
  btn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { marginTop: spacing.md, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
