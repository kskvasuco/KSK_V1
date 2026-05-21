import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet, Alert } from 'react-native';
import adminApi from '../../api/adminApi';
import Loading from '../../components/Loading';
import { colors, spacing } from '../../theme';

export default function SettingsScreen() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getAppController()
      .then(setSettings)
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, []);

  const update = async (key, value) => {
    try {
      const updated = await adminApi.updateAppController({ [key]: value });
      setSettings(updated);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) return <Loading />;

  const toggles = [
    { key: 'showChargesForAdmin', label: 'Show charges (Admin)' },
    { key: 'showChargesForStaff', label: 'Show charges (Staff)' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>App Settings</Text>
      {toggles.map((t) => (
        <View key={t.key} style={styles.row}>
          <Text>{t.label}</Text>
          <Switch
            value={!!settings?.[t.key]}
            onValueChange={(v) => update(t.key, v)}
          />
        </View>
      ))}
      <Text style={styles.note}>
        Password reset via OTP is available on the web admin panel. Use the same admin email configured on the server.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  note: { marginTop: spacing.lg, color: colors.textMuted, fontSize: 13 },
});
