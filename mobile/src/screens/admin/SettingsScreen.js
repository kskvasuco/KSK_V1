import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useOrderPolling } from '../../hooks/useOrderPolling';
import { useTheme } from '../../context/ThemeContext';

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { themeMode, selectTheme } = useTheme();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [loginFlow, setLoginFlow] = useState({
    open: false,
    step: 1,
    email: '',
    otp: '',
    newValue: '',
    timer: 0,
    error: '',
    message: '',
  });
  const [profileFlow, setProfileFlow] = useState({
    open: false,
    step: 1,
    email: '',
    otp: '',
    newValue: '',
    timer: 0,
    error: '',
    message: '',
  });
  const [usernameFlow, setUsernameFlow] = useState({
    open: false,
    step: 1,
    email: '',
    otp: '',
    newValue: '',
    timer: 0,
    error: '',
    message: '',
  });

  useEffect(() => {
    adminApi
      .getAppController()
      .then(setSettings)
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, []);

  useOrderPolling(async () => {
    try {
      const latest = await adminApi.getAppController();
      setSettings((prev) => {
        const prevJson = JSON.stringify(prev || {});
        const nextJson = JSON.stringify(latest || {});
        return prevJson === nextJson ? prev : latest;
      });
    } catch {
      // keep silent during background polling
    }
  }, !loading, 4000);

  useEffect(() => {
    if (loginFlow.step !== 2 || loginFlow.timer <= 0) return undefined;
    const id = setInterval(() => {
      setLoginFlow((prev) => ({ ...prev, timer: Math.max(prev.timer - 1, 0) }));
    }, 1000);
    return () => clearInterval(id);
  }, [loginFlow.step, loginFlow.timer]);

  useEffect(() => {
    if (profileFlow.step !== 2 || profileFlow.timer <= 0) return undefined;
    const id = setInterval(() => {
      setProfileFlow((prev) => ({ ...prev, timer: Math.max(prev.timer - 1, 0) }));
    }, 1000);
    return () => clearInterval(id);
  }, [profileFlow.step, profileFlow.timer]);

  useEffect(() => {
    if (usernameFlow.step !== 2 || usernameFlow.timer <= 0) return undefined;
    const id = setInterval(() => {
      setUsernameFlow((prev) => ({ ...prev, timer: Math.max(prev.timer - 1, 0) }));
    }, 1000);
    return () => clearInterval(id);
  }, [usernameFlow.step, usernameFlow.timer]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(value.trim());
  const isValidOtp = (value) => /^\d{6}$/.test(value.trim());

  const update = async (key, value) => {
    try {
      const updated = await adminApi.updateAppController({ [key]: value });
      setSettings(updated);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const sendOtp = async (flow, setFlow) => {
    const email = flow.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setFlow((prev) => ({ ...prev, error: 'Enter a valid email address.', message: '' }));
      return;
    }
    try {
      setBusy(true);
      setFlow((prev) => ({ ...prev, error: '', message: '' }));
      const res = await adminApi.requestOtp(email);
      setFlow((prev) => ({
        ...prev,
        email,
        step: 2,
        timer: 300,
        otp: '',
        message: res?.message || 'OTP sent successfully.',
        error: '',
      }));
    } catch (e) {
      setFlow((prev) => ({ ...prev, error: e.message, message: '' }));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (flow, setFlow, submitFn, successText) => {
    const email = flow.email.trim().toLowerCase();
    const otp = flow.otp.trim();
    const newValue = flow.newValue.trim();

    if (!isValidEmail(email)) {
      setFlow((prev) => ({ ...prev, error: 'Enter a valid email address.', message: '' }));
      return;
    }
    if (!isValidOtp(otp)) {
      setFlow((prev) => ({ ...prev, error: 'OTP must be exactly 6 digits.', message: '' }));
      return;
    }
    if (!newValue) {
      setFlow((prev) => ({ ...prev, error: 'New value cannot be empty.', message: '' }));
      return;
    }
    if (flow.timer <= 0) {
      setFlow((prev) => ({ ...prev, error: 'OTP expired. Request a new OTP.', message: '' }));
      return;
    }

    try {
      setBusy(true);
      setFlow((prev) => ({ ...prev, error: '', message: '' }));
      const response = await submitFn(email, otp, newValue);
      if (response?.forceLogout) {
        await logout();
        Alert.alert('Session Expired', 'Credentials changed. Please login again.');
        return;
      }
      Alert.alert('Success', successText);
      setFlow({
        open: false,
        step: 1,
        email: '',
        otp: '',
        newValue: '',
        timer: 0,
        error: '',
        message: '',
      });
      const updated = await adminApi.getAppController();
      setSettings(updated);
    } catch (e) {
      setFlow((prev) => ({ ...prev, error: e.message, message: '' }));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  const toggles = [
    { key: 'isChargesEnabledAdmin', label: 'Show charges (Admin)' },
    { key: 'isChargesEnabledStaff', label: 'Show charges (Staff)' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>App Settings</Text>
      {toggles.map((t) => (
        <View key={t.key} style={styles.row}>
          <Text style={{ color: colors.text }}>{t.label}</Text>
          <Switch
            value={!!settings?.[t.key]}
            onValueChange={(v) => update(t.key, v)}
          />
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>App Theme</Text>
        <Text style={styles.cardText}>Select how KSK VASU & Co appears on this device.</Text>
        <View style={styles.themeSelectorRow}>
          {[
            { id: 'light', label: '☀️ Light' },
            { id: 'dark', label: '🌙 Dark' },
            { id: 'system', label: '⚙️ System' }
          ].map((mode) => {
            const isSelected = themeMode === mode.id;
            return (
              <Pressable
                key={mode.id}
                style={[
                  styles.themeBtn,
                  isSelected && styles.themeBtnSelected
                ]}
                onPress={() => selectTheme(mode.id)}
              >
                <Text
                  style={[
                    styles.themeBtnText,
                    isSelected && styles.themeBtnTextSelected
                  ]}
                >
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile Password</Text>
        <Text style={styles.cardText}>
          Change sensitive action password using OTP verification.
        </Text>
        {!profileFlow.open ? (
          <Pressable
            style={styles.btn}
            onPress={() => setProfileFlow((prev) => ({ ...prev, open: true, step: 1, error: '', message: '' }))}
          >
            <Text style={styles.btnText}>Reset via OTP</Text>
          </Pressable>
        ) : (
          <OtpForm
            flow={profileFlow}
            setFlow={setProfileFlow}
            busy={busy}
            formatTimer={formatTimer}
            onSend={() => sendOtp(profileFlow, setProfileFlow)}
            onSubmit={() =>
              submitReset(
                profileFlow,
                setProfileFlow,
                adminApi.resetProfilePassword,
                'Profile password updated.'
              )
            }
            newValueLabel="New Profile Password"
            secureNewValue
            onCancel={() =>
              setProfileFlow({
                open: false,
                step: 1,
                email: '',
                otp: '',
                newValue: '',
                timer: 0,
                error: '',
                message: '',
              })
            }
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin Username</Text>
        <Text style={styles.cardText}>Reset admin login username using OTP verification.</Text>
        {!usernameFlow.open ? (
          <Pressable
            style={styles.btn}
            onPress={() => setUsernameFlow((prev) => ({ ...prev, open: true, step: 1, error: '', message: '' }))}
          >
            <Text style={styles.btnText}>Reset via OTP</Text>
          </Pressable>
        ) : (
          <OtpForm
            flow={usernameFlow}
            setFlow={setUsernameFlow}
            busy={busy}
            formatTimer={formatTimer}
            onSend={() => sendOtp(usernameFlow, setUsernameFlow)}
            onSubmit={() =>
              submitReset(
                usernameFlow,
                setUsernameFlow,
                adminApi.resetUsername,
                'Admin username updated.'
              )
            }
            newValueLabel="New Admin Username"
            onCancel={() =>
              setUsernameFlow({
                open: false,
                step: 1,
                email: '',
                otp: '',
                newValue: '',
                timer: 0,
                error: '',
                message: '',
              })
            }
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin Login Password</Text>
        <Text style={styles.cardText}>Reset admin login password using OTP verification.</Text>
        {!loginFlow.open ? (
          <Pressable
            style={styles.btn}
            onPress={() => setLoginFlow((prev) => ({ ...prev, open: true, step: 1, error: '', message: '' }))}
          >
            <Text style={styles.btnText}>Reset via OTP</Text>
          </Pressable>
        ) : (
          <OtpForm
            flow={loginFlow}
            setFlow={setLoginFlow}
            busy={busy}
            formatTimer={formatTimer}
            onSend={() => sendOtp(loginFlow, setLoginFlow)}
            onSubmit={() =>
              submitReset(
                loginFlow,
                setLoginFlow,
                adminApi.resetPassword,
                'Admin login password updated.'
              )
            }
            newValueLabel="New Login Password"
            secureNewValue
            onCancel={() =>
              setLoginFlow({
                open: false,
                step: 1,
                email: '',
                otp: '',
                newValue: '',
                timer: 0,
                error: '',
                message: '',
              })
            }
          />
        )}
      </View>
      <View style={{ height: spacing.xl * 2 }} />
    </ScrollView>
  );
}

function OtpForm({
  flow,
  setFlow,
  busy,
  formatTimer,
  onSend,
  onSubmit,
  onCancel,
  newValueLabel,
  secureNewValue = false,
}) {
  const [showNewValue, setShowNewValue] = useState(false);

  if (flow.step === 1) {
    return (
      <View style={styles.otpWrap}>
        <Text style={styles.stepLabel}>Step 1: Enter Registered Email</Text>
        <TextInput
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="admin@example.com"
          value={flow.email}
          onChangeText={(v) => setFlow((prev) => ({ ...prev, email: v }))}
        />
        <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={onSend} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Sending...' : 'Send OTP'}</Text>
        </Pressable>
        {!!flow.error && <Text style={styles.error}>{flow.error}</Text>}
        {!!flow.message && <Text style={styles.success}>{flow.message}</Text>}
        <Pressable onPress={onCancel}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.otpWrap}>
      <Text style={styles.stepLabel}>Step 2: Verify OTP and Update</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="6-digit OTP"
        value={flow.otp}
        onChangeText={(v) => setFlow((prev) => ({ ...prev, otp: v.replace(/[^\d]/g, '') }))}
      />
      {flow.timer > 0 ? (
        <Text style={styles.timer}>OTP expires in: {formatTimer(flow.timer)}</Text>
      ) : (
        <Text style={styles.error}>OTP expired. Go back and request a new OTP.</Text>
      )}
      {secureNewValue ? (
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, styles.inputWithIcon]}
            secureTextEntry={!showNewValue}
            placeholder={newValueLabel}
            value={flow.newValue}
            onChangeText={(v) => setFlow((prev) => ({ ...prev, newValue: v }))}
          />
          <Pressable
            onPress={() => setShowNewValue(!showNewValue)}
            style={styles.eyeIcon}
            hitSlop={8}
          >
            <Ionicons
              name={showNewValue ? 'eye-off' : 'eye'}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
      ) : (
        <TextInput
          style={styles.input}
          placeholder={newValueLabel}
          value={flow.newValue}
          onChangeText={(v) => setFlow((prev) => ({ ...prev, newValue: v }))}
        />
      )}
      <View style={styles.rowBtns}>
        <Pressable
          style={[styles.btn, styles.flex, (busy || flow.timer <= 0) && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={busy || flow.timer <= 0}
        >
          <Text style={styles.btnText}>{busy ? 'Updating...' : 'Update'}</Text>
        </Pressable>
        <Pressable
          style={[styles.btnSecondary, styles.flex]}
          onPress={() => setFlow((prev) => ({ ...prev, step: 1, otp: '', timer: 0, error: '', message: '' }))}
          disabled={busy}
        >
          <Text style={styles.btnSecondaryText}>Back</Text>
        </Pressable>
      </View>
      {!!flow.error && <Text style={styles.error}>{flow.error}</Text>}
      {!!flow.message && <Text style={styles.success}>{flow.message}</Text>}
      <Pressable onPress={onCancel}>
        <Text style={styles.link}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', marginBottom: spacing.lg, color: colors.text },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardText: { marginTop: 6, color: colors.textMuted, fontSize: 13 },
  otpWrap: { marginTop: spacing.sm, gap: spacing.sm },
  stepLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  inputWrapper: { position: 'relative', justifyContent: 'center' },
  inputWithIcon: { paddingRight: 40 },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.text, fontWeight: '700' },
  rowBtns: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  timer: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12 },
  success: { color: colors.success, fontSize: 12 },
  link: { marginTop: 2, color: colors.primaryDark, fontSize: 12, textDecorationLine: 'underline' },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  themeBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 174, 255, 0.1)',
  },
  themeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  themeBtnTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
