import { View, Text, StyleSheet } from 'react-native';
import BrickSpinner from './BrickSpinner';
import { colors, spacing } from '../theme';

/**
 * Uniform loading overlay used across all admin / staff screens.
 *
 * Usage:
 *   <Loading message="Loading orders…" />
 *
 * Forms a dark semi-transparent layer with a branded shimmer bar so
 * the user always sees a positive "working on it" signal, even
 * before any data arrives.
 */
export default function Loading({ style, message = 'Loading…' }) {
  return (
    <View style={[styles.overlay, style]}>
       <BrickSpinner size="large" color={colors.primary} />
      <Text style={styles.label}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  label: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
