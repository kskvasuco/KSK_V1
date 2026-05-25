import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import CreateOrderScreen from '../screens/admin/CreateOrderScreen';
import LedgerScreen from '../screens/admin/LedgerScreen';
import CustomerLedgerScreen from '../screens/admin/CustomerLedgerScreen';
import { colors, spacing, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';

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

const GROUPS = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', title: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
      { name: 'FullWebAdmin', title: 'Full Web Admin', icon: 'globe-outline', iconActive: 'globe' },
    ]
  },
  {
    title: 'FINANCE & BILLING',
    items: [
      { name: 'Ledger', title: 'KSK Ledger', icon: 'book-outline', iconActive: 'book' },
      { name: 'CreateOrder', title: 'Create Order', icon: 'add-circle-outline', iconActive: 'add-circle' },
      { name: 'Reports', title: 'Visual Reports', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
      { name: 'Payment', title: 'Payment Settings', icon: 'card-outline', iconActive: 'card' },
    ]
  },
  {
    title: 'ORDER PROCESSING',
    items: [
      { name: 'Pending', title: 'Active Orders', icon: 'cart-outline', iconActive: 'cart' },
      { name: 'RateRequested', title: 'Rate Requested', icon: 'time-outline', iconActive: 'time' },
      { name: 'RateApproved', title: 'Rate Approved', icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle' },
      { name: 'Confirmed', title: 'Confirmed', icon: 'thumbs-up-outline', iconActive: 'thumbs-up' },
      { name: 'Dispatch', title: 'Dispatch', icon: 'bus-outline', iconActive: 'bus' },
      { name: 'Balance', title: 'Balance', icon: 'cash-outline', iconActive: 'cash' },
      { name: 'Advance', title: 'Advance Payments', icon: 'wallet-outline', iconActive: 'wallet' },
      { name: 'Completed', title: 'Completed', icon: 'checkmark-done-outline', iconActive: 'checkmark-done' },
      { name: 'Paused', title: 'Paused', icon: 'pause-outline', iconActive: 'pause' },
      { name: 'Hold', title: 'Hold', icon: 'hand-right-outline', iconActive: 'hand-right' },
      { name: 'Delivered', title: 'Delivered', icon: 'gift-outline', iconActive: 'gift' },
      { name: 'Cancelled', title: 'Cancelled', icon: 'close-circle-outline', iconActive: 'close-circle' },
    ]
  },
  {
    title: 'ADMIN SETUP',
    items: [
      { name: 'Products', title: 'Products', icon: 'cube-outline', iconActive: 'cube' },
      { name: 'Users', title: 'Users List', icon: 'people-outline', iconActive: 'people' },
      { name: 'Drivers', title: 'Logistics Drivers', icon: 'car-outline', iconActive: 'car' },
      { name: 'RecycleBin', title: 'Recycle Bin', icon: 'trash-outline', iconActive: 'trash' },
      { name: 'Settings', title: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
    ]
  }
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

function CustomDrawerContent(props) {
  const { logout } = useAuth();
  const { activeTheme } = useTheme();
  const activeRouteName = props.state.routes[props.state.index].name;

  const isDark = activeTheme === 'dark';
  const sidebarBg = isDark ? '#0f172a' : '#ffffff';
  const itemActiveBg = isDark ? '#1e293b' : '#f1f5f9';
  const labelActiveColor = isDark ? '#ffffff' : '#0f172a';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';
  const headerTitleColor = isDark ? '#ffffff' : '#0f172a';

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: sidebarBg }}>
      {/* Sidebar Header */}
      <View style={[styles.sidebarHeader, { borderBottomColor: borderColor }]}>
        <Text style={[styles.sidebarTitle, { color: headerTitleColor }]}>KSK Admin Panel</Text>
        <Text style={styles.sidebarSubtitle}>VASU & Co</Text>
      </View>
      
      {GROUPS.map((group, gIdx) => (
        <View key={gIdx} style={styles.groupContainer}>
          <Text style={styles.groupHeader}>{group.title}</Text>
          {group.items.map((item, iIdx) => {
            const isActive = activeRouteName === item.name;
            return (
              <Pressable
                key={iIdx}
                onPress={() => props.navigation.navigate(item.name)}
                style={[
                  styles.drawerItem,
                  isActive && { backgroundColor: itemActiveBg }
                ]}
              >
                <Ionicons
                  name={isActive ? item.iconActive : item.icon}
                  size={18}
                  color={isActive ? colors.primary : colors.textMuted}
                  style={styles.drawerIcon}
                />
                <Text
                  style={[
                    styles.drawerLabel,
                    isActive ? { color: labelActiveColor, fontWeight: '700' } : { color: colors.textMuted }
                  ]}
                >
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Logout button at the bottom */}
      <View style={[styles.logoutContainer, { borderTopColor: borderColor }]}>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} style={styles.drawerIcon} />
          <Text style={styles.logoutLabel}>Logout</Text>
        </Pressable>
      </View>
      <View style={{ height: 40 }} />
    </DrawerContentScrollView>
  );
}

export default function AdminNavigator() {
  const { logout } = useAuth();
  const { activeTheme } = useTheme();

  const isDark = activeTheme === 'dark';
  const sidebarBg = isDark ? '#0f172a' : '#ffffff';

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        drawerStyle: { backgroundColor: sidebarBg },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textMuted,
        headerRight: () => (
          <Pressable onPress={logout} style={{ marginRight: 16 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Logout</Text>
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
      <Drawer.Screen
        name="CreateOrder"
        component={CreateOrderScreen}
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
      <Drawer.Screen name="Products" component={ProductsScreen} />
      <Drawer.Screen name="Users" component={UsersScreen} />
      <Drawer.Screen name="Payment" component={PaymentSettingsScreen} />
      <Drawer.Screen name="Drivers" component={DeliveryAgentsScreen} options={{ title: 'Logistics Drivers' }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ title: 'Visual Reports' }} />
      <Drawer.Screen name="RecycleBin" component={RecycleBinScreen} options={{ title: 'Recycle Bin' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
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

const styles = StyleSheet.create({
  sidebarHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 10,
  },
  sidebarTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sidebarSubtitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  groupContainer: {
    marginTop: 15,
    paddingHorizontal: 12,
  },
  groupHeader: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingLeft: 8,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 1.5,
  },
  drawerItemActive: {
    backgroundColor: '#1e293b',
  },
  drawerIcon: {
    marginRight: 10,
  },
  drawerLabel: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontWeight: '600',
  },
  drawerLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  logoutContainer: {
    marginTop: 30,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutLabel: {
    color: colors.danger,
    fontSize: 13.5,
    fontWeight: '700',
  },
});
