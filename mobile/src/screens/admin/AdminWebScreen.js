import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import BrickSpinner from '../../components/BrickSpinner';
import { API_BASE } from '../../config';
import { getToken } from '../../api/http';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

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

  const handleMessage = async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'PRINT_PDF') {
        const { base64, filename } = message;
        if (!base64) return;
        
        // Remove data URI prefix if present
        const base64Data = base64.replace(/^data:application\/pdf;base64,/, '');
        const fileUri = `${FileSystem.cacheDirectory}${filename || 'document.pdf'}`;
        
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await Sharing.shareAsync(fileUri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
        });
      }
    } catch (err) {
      console.error('WebView message handling error:', err);
      Alert.alert('Print Error', 'Failed to compile or print PDF.');
    }
  };

  if (!uri) {
    return (
       <View style={styles.center}>
         <BrickSpinner size="large" color={colors.primary} />
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
           <BrickSpinner style={styles.loader} size="large" color={colors.primary} />
         )}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loader: { flex: 1 },
});
