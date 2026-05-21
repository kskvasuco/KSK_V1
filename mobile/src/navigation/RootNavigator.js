import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import UserNavigator from './UserNavigator';
import AdminNavigator from './AdminNavigator';
import StaffNavigator from './StaffNavigator';
import Loading from '../components/Loading';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { loading, role, isAuthenticated } = useAuth();

  if (loading) return <Loading message="Starting KSK..." />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : role === 'admin' ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : role === 'staff' ? (
          <Stack.Screen name="Staff" component={StaffNavigator} />
        ) : (
          <Stack.Screen name="User" component={UserNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
