import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LoginScreen from '../screens/auth/LoginScreen';
import UserNavigator from './UserNavigator';
import AdminNavigator from './AdminNavigator';
import StaffNavigator from './StaffNavigator';
import Loading from '../components/Loading';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { loading, role, isAuthenticated } = useAuth();
  const { activeTheme, colors } = useTheme();

  if (loading) return <Loading message="Starting KSK..." />;

  const baseTheme = activeTheme === 'dark' ? DarkTheme : DefaultTheme;

  const navTheme = {
    ...baseTheme,
    dark: activeTheme === 'dark',
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    }
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="User" component={UserNavigator} />
        ) : role === 'admin' ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : role === 'staff' ? (
          <Stack.Screen name="Staff" component={StaffNavigator} />
        ) : (
          <Stack.Screen name="User" component={UserNavigator} />
        )}
      </Stack.Navigator>
      <StatusBar 
        style={activeTheme === 'dark' ? 'light' : 'dark'} 
        backgroundColor={colors.card}
      />
    </NavigationContainer>
  );
}
