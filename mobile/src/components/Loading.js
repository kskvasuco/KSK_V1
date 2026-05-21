import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function Loading({ message = 'Loading...' }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { marginTop: 12, color: colors.textMuted },
});
