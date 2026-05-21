import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/user/HomeScreen';
import MyOrdersScreen from '../screens/user/MyOrdersScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import CartScreen from '../screens/user/CartScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Shop' }} />
      <Tab.Screen name="Orders" component={MyOrdersScreen} options={{ title: 'My Orders' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function UserNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="UserMain" component={UserTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Cart' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
    </Stack.Navigator>
  );
}
