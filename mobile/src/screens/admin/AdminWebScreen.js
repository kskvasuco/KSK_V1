import { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_BASE } from '../../config';
import { getToken } from '../../api/http';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';

/**
 * Full web admin/staff panel — 100% same UI as browser (PDF, batches, reports).
 */
export default function AdminWebScreen() {
  const { role } = useAuth();
  const [uri, setUri] = useState(null);
  const redirect = role === 'staff' ? '/staff' : '/admin';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (!token) {
        setUri(`${API_BASE}${redirect}/login`);
        return;
      }
      const bridge = `${API_BASE}/api/auth/bridge-page?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`;
      setUri(bridge);
    })();
    return () => {
      cancelled = true;
    };
  }, [redirect]);

  if (!uri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <WebView
        style={styles.flex}
        source={{ uri }}
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
        )}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loader: { flex: 1 },
});
