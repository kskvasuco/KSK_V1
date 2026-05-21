import { createDrawerNavigator } from '@react-navigation/drawer';
import { Pressable, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import DashboardScreen from '../screens/admin/DashboardScreen';
import OrderListScreen from '../screens/admin/OrderListScreen';
import ProductsScreen from '../screens/admin/ProductsScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import SettingsScreen from '../screens/admin/SettingsScreen';
import RecycleBinScreen from '../screens/admin/RecycleBinScreen';
import PaymentSettingsScreen from '../screens/admin/PaymentSettingsScreen';
import AdminWebScreen from '../screens/admin/AdminWebScreen';
import DeliveryAgentsScreen from '../screens/admin/DeliveryAgentsScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import { colors } from '../theme';

const Drawer = createDrawerNavigator();

const orderScreens = [
  { name: 'Pending', status: 'pending', title: 'Active Orders' },
  { name: 'RateRequested', status: 'rate-request', title: 'Rate Requested' },
  { name: 'RateApproved', status: 'rate-approved', title: 'Rate Approved' },
  { name: 'Confirmed', status: 'confirmed', title: 'Confirmed' },
  { name: 'Dispatch', status: 'dispatch', title: 'Dispatch' },
  { name: 'Balance', status: 'balance', title: 'Balance' },
  { name: 'Advance', status: 'advance', title: 'Advance Payments' },
  { name: 'Completed', status: 'completed', title: 'Completed' },
  { name: 'Paused', status: 'paused', title: 'Paused' },
  { name: 'Hold', status: 'hold', title: 'Hold' },
  { name: 'Delivered', status: 'delivered', title: 'Delivered' },
  { name: 'Cancelled', status: 'cancelled', title: 'Cancelled' },
];

function makeOrderScreen(status, title) {
  return function Screen(props) {
    return (
      <OrderListScreen
        {...props}
        route={{ ...props.route, params: { status, title } }}
        isAdmin
      />
    );
  };
}

export default function AdminNavigator() {
  const { logout } = useAuth();

  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.adminBg },
        headerTintColor: '#fff',
        drawerStyle: { backgroundColor: colors.adminSidebar },
        drawerActiveTintColor: '#fff',
        drawerInactiveTintColor: '#ccc',
        headerRight: () => (
          <Pressable onPress={logout} style={{ marginRight: 16 }}>
            <Text style={{ color: '#fff' }}>Logout</Text>
          </Pressable>
        ),
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen
        name="FullWebAdmin"
        component={AdminWebScreen}
        options={{ title: 'Full Admin (Web UI)' }}
      />
      {orderScreens.map((s) => (
        <Drawer.Screen
          key={s.name}
          name={s.name}
          component={makeOrderScreen(s.status, s.title)}
          options={{ title: s.title }}
        />
      ))}
      <Drawer.Screen name="Products" component={ProductsScreen} />
      <Drawer.Screen name="Users" component={UsersScreen} />
      <Drawer.Screen name="Payment" component={PaymentSettingsScreen} />
      <Drawer.Screen name="Drivers" component={DeliveryAgentsScreen} options={{ title: 'Logistics Drivers' }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ title: 'Visual Reports' }} />
      <Drawer.Screen name="RecycleBin" component={RecycleBinScreen} options={{ title: 'Recycle Bin' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}
