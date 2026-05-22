import { createDrawerNavigator } from '@react-navigation/drawer';
import { Pressable, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import OrderListScreen from '../screens/admin/OrderListScreen';
import ProductsScreen from '../screens/admin/ProductsScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import AdminWebScreen from '../screens/admin/AdminWebScreen';
import DeliveryAgentsScreen from '../screens/admin/DeliveryAgentsScreen';
import CreateOrderScreen from '../screens/admin/CreateOrderScreen';
import LedgerScreen from '../screens/admin/LedgerScreen';
import CustomerLedgerScreen from '../screens/admin/CustomerLedgerScreen';
import { colors } from '../theme';

const Drawer = createDrawerNavigator();

const orderScreens = [
  { name: 'Pending', status: 'pending', title: 'Active Orders' },
  { name: 'RateRequested', status: 'rate-request', title: 'Rate Requested' },
  { name: 'RateApproved', status: 'rate-approved', title: 'Rate Approved' },
  { name: 'Confirmed', status: 'confirmed', title: 'Confirmed' },
  { name: 'Dispatch', status: 'dispatch', title: 'Dispatch' },
  { name: 'Balance', status: 'balance', title: 'Balance' },
  { name: 'Advance', status: 'advance', title: 'Advance' },
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
        isAdmin={false}
      />
    );
  };
}

function StaffCreateOrderScreen(props) {
  return <CreateOrderScreen {...props} isAdmin={false} />;
}

function StaffProductsScreen(props) {
  return <ProductsScreen {...props} readOnly />;
}

export default function StaffNavigator() {
  const { logout } = useAuth();

  return (
    <Drawer.Navigator
      initialRouteName="Pending"
      screenOptions={{
        headerStyle: { backgroundColor: colors.adminBg },
        headerTintColor: '#fff',
        drawerStyle: { backgroundColor: colors.adminSidebar },
        drawerActiveTintColor: '#fff',
        headerRight: () => (
          <Pressable onPress={logout} style={{ marginRight: 16 }}>
            <Text style={{ color: '#fff' }}>Logout</Text>
          </Pressable>
        ),
      }}
    >
      <Drawer.Screen
        name="FullWebStaff"
        component={AdminWebScreen}
        options={{ title: 'Full Staff (Web UI)' }}
      />
      <Drawer.Screen
        name="CreateOrder"
        component={StaffCreateOrderScreen}
        options={{ title: 'Create Order' }}
      />
      {orderScreens.map((s) => (
        <Drawer.Screen
          key={s.name}
          name={s.name}
          component={makeOrderScreen(s.status, s.title)}
          options={{ title: s.title }}
        />
      ))}
      <Drawer.Screen name="Products" component={StaffProductsScreen} />
      <Drawer.Screen name="Users" component={UsersScreen} />
      <Drawer.Screen name="Drivers" component={DeliveryAgentsScreen} options={{ title: 'Logistics Drivers' }} />
      <Drawer.Screen name="Ledger" component={LedgerScreen} options={{ title: 'KSK Ledger' }} />
      <Drawer.Screen 
        name="CustomerLedger" 
        component={CustomerLedgerScreen} 
        options={{ 
          title: 'Customer Ledger', 
          drawerItemStyle: { display: 'none' } 
        }} 
      />
    </Drawer.Navigator>
  );
}
