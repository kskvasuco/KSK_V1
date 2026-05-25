import { useState, useEffect } from 'react';
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
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, shadows } from '../../theme';
import BrickSpinner from '../../components/BrickSpinner';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmMobile, setConfirmMobile] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectedRole, setDetectedRole] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(45));
  const [logoFadeAnim] = useState(new Animated.Value(0));
  const [logoScaleAnim] = useState(new Animated.Value(0.5));
  const [floatAnim] = useState(new Animated.Value(0));

  // Auto-detect role based on identifier
  useEffect(() => {
    const input = identifier.trim().toLowerCase();
    if (input.startsWith('admin')) {
      setDetectedRole('admin');
    } else if (input.startsWith('staff')) {
      setDetectedRole('staff');
    } else if (/^\d{10}$/.test(input)) {
      setDetectedRole('user');
    } else {
      setDetectedRole(null);
    }
  }, [identifier]);

  // Animations on load
  useEffect(() => {
    // 1. Staggered entrance animations
    Animated.sequence([
      // Logo springs in first
      Animated.parallel([
        Animated.spring(logoScaleAnim, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(logoFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Stagger slightly and bring in the card and inputs
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 30,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 2. Continuous organic floating animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const isUserFlow = detectedRole === 'user' || (/^\d{10}$/.test(identifier.trim()) && !detectedRole);

  const handleSubmit = async () => {
    const id = identifier.trim();
    if (!id) {
      Alert.alert('Error', 'Please enter mobile number.');
      return;
    }

    let pass = password;
    let roleHint = undefined;

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
      Alert.alert('Error', 'Another Mobile number is required.');
      return;
    }

    // Button press animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    try {
      setLoading(true);
      await login(id, pass, roleHint);
      if (navigation && navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert('Login failed', e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplay = () => {
    if (!detectedRole) return null;
    const info = {
      admin: { text: 'Admin Access', color: colors.primary },
      staff: { text: 'Staff Access', color: '#2980b9' },
      user: { text: 'Customer Access', color: colors.success },
    };
    return info[detectedRole];
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.content}> 
          {/* Logo/Brand Section */}
          <View style={styles.logoSection}>
            <Animated.View 
              style={[
                styles.logoOuter, 
                { 
                  opacity: logoFadeAnim,
                  transform: [{ scale: logoScaleAnim }, { translateY: floatAnim }] 
                }
              ]}
            >
              <View style={styles.logoCircle}>
                <Image 
                  source={require('../../../assets/head.png')} 
                  style={styles.logoImage} 
                  resizeMode="contain" 
                />
              </View>
              <View style={styles.logoGlow} />
            </Animated.View>
            <Text style={styles.brand}>KSK VASU & Co</Text>
            <Text style={styles.tagline}>Construction Material Service Center</Text>
          </View>

          {/* Staggered Form Section */}
          <Animated.View 
            style={[
              styles.formContainer, 
              { 
                opacity: fadeAnim, 
                transform: [{ translateY: slideAnim }] 
              }
            ]}
          >
            {/* Auto-Detect Badge */}
            {detectedRole && (
              <View style={[styles.detectBadge, { borderColor: getRoleDisplay()?.color }]}>
                <Text style={[styles.detectText, { color: getRoleDisplay()?.color }]}>
                  {getRoleDisplay()?.text} <Text style={styles.detectEmphasis}>Auto-Detected</Text>
                </Text>
              </View>
            )}

            {/* Input Card */}
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType={isUserFlow ? 'phone-pad' : 'default'}
                maxLength={isUserFlow ? 10 : 50}
                placeholder={isUserFlow ? 'Enter 10-digit mobile' : 'Enter mobile number'}
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
                editable={!loading}
              />

              {isUserFlow ? (
                <>
                  <Text style={styles.inputLabel}>Confirm Mobile</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmMobile}
                    onChangeText={setConfirmMobile}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder="Re-enter mobile number"
                    placeholderTextColor={colors.textMuted}
                    editable={!loading}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Re-enter Mobile number</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[styles.input, styles.inputWithIcon]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholder="Re-enter Mobile number"
                      placeholderTextColor={colors.textMuted}
                      editable={!loading}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                </>
              )}

              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Pressable
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                   {loading ? (
                     <View style={styles.loadingRow}>
                       <BrickSpinner size="small" color="#fff" />
                       <Text style={styles.loginBtnText}>Authenticating...</Text>
                     </View>
                   ) : (
                     <Text style={styles.loginBtnText}>Sign In</Text>
                   )}
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  content: { alignItems: 'center', width: '100%' },

  // Logo Section
  logoSection: { alignItems: 'center', marginBottom: spacing.lg },
  logoOuter: { position: 'relative', marginBottom: 12 },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    ...shadows.lg,
    zIndex: 2,
    overflow: 'hidden',
  },
  logoImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  logoGlow: {
    position: 'absolute',
    width: 134,
    height: 134,
    borderRadius: 67,
    backgroundColor: `${colors.primary}20`,
    top: -7,
    left: -7,
    zIndex: 1,
  },
  brand: { fontSize: 26, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  tagline: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },

  // Form container
  formContainer: { width: '100%', alignItems: 'center' },

  // Detect Badge
  detectBadge: {
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: spacing.lg,
  },
  detectText: { fontSize: 13, fontWeight: '600' },
  detectEmphasis: { fontWeight: '800' },

  // Card
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.lg,
    ...shadows.md,
  },
  inputLabel: { fontWeight: '600', color: colors.text, marginTop: spacing.sm, marginBottom: 6, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.background,
    fontSize: 16,
    color: colors.text,
  },
  inputWrapper: { position: 'relative', justifyContent: 'center' },
  inputWithIcon: { paddingRight: 44 },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Button
  loginBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Help
  helpText: {
    marginTop: spacing.xl,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});