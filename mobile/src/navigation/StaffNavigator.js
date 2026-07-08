import { useState, useEffect } from 'react';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import OrderListScreen from '../screens/admin/OrderListScreen';
import ProductsScreen from '../screens/admin/ProductsScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import AdminWebScreen from '../screens/admin/AdminWebScreen';
import DeliveryAgentsScreen from '../screens/admin/DeliveryAgentsScreen';
import CreateOrderScreen from '../screens/admin/CreateOrderScreen';
import LedgerScreen from '../screens/admin/LedgerScreen';
import CustomerLedgerScreen from '../screens/admin/CustomerLedgerScreen';
import OrderCountScreen from '../screens/admin/OrderCountScreen';
import { colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import adminApi from '../api/adminApi';

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

const GROUPS = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'FullWebStaff', title: 'Full Staff Web UI', icon: 'globe-outline', iconActive: 'globe' },
    ]
  },
  {
    title: 'FINANCE & BILLING',
    items: [
      { name: 'Ledger', title: 'KSK Ledger', icon: 'book-outline', iconActive: 'book' },
      { name: 'OrderCount', title: 'Order Count', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
      { name: 'CreateOrder', title: 'Create Order', icon: 'add-circle-outline', iconActive: 'add-circle' },
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
    title: 'STAFF SETUP',
    items: [
      { name: 'Products', title: 'Products', icon: 'cube-outline', iconActive: 'cube' },
      { name: 'Users', title: 'Users List', icon: 'people-outline', iconActive: 'people' },
      { name: 'Drivers', title: 'Logistics Drivers', icon: 'car-outline', iconActive: 'car' },
    ]
  }
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

function CustomDrawerContent(props) {
  const { logout } = useAuth();
  const { activeTheme } = useTheme();
  const activeRouteName = props.state.routes[props.state.index].name;
  const isDark = activeTheme === 'dark';
  const [orderCounts, setOrderCounts] = useState({});

  const fetchCounts = async () => {
    try {
      const counts = await adminApi.getOrderCounts();
      setOrderCounts(counts || {});
    } catch (err) {
      console.error('Error fetching status counts:', err);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
      <View style={styles.sidebarHeader}>
        <Text style={[styles.sidebarTitle, { color: isDark ? '#fff' : '#0f172a' }]}>KSK VASU & Co</Text>
        <Text style={styles.sidebarSubtitle}>Staff Dashboard Panel</Text>
      </View>
      {GROUPS.map((group) => (
        <View key={group.title} style={styles.groupContainer}>
          <Text style={styles.groupHeader}>{group.title}</Text>
          {group.items.map((item) => {
            const isFocused = activeRouteName === item.name;
            const count = orderScreens.find((s) => s.name === item.name)
              ? orderCounts[orderScreens.find((s) => s.name === item.name).title] || 0
              : 0;

            return (
              <Pressable
                key={item.name}
                style={[
                  styles.drawerItem,
                  isFocused && { backgroundColor: isDark ? 'rgba(15, 82, 186, 0.25)' : '#e0f2fe' },
                ]}
                onPress={() => props.navigation.navigate(item.name)}
              >
                <Ionicons
                  name={isFocused ? item.iconActive : item.icon}
                  size={20}
                  color={isFocused ? colors.primary : isDark ? '#94a3b8' : '#475569'}
                  style={styles.drawerIcon}
                />
                <Text
                  style={[
                    styles.drawerLabel,
                    { color: isDark ? '#cbd5e1' : '#1e293b' },
                    isFocused && { color: colors.primary, fontWeight: 'bold' },
                  ]}
                >
                  {item.title}
                </Text>
                {count > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" style={styles.drawerIcon} />
        <Text style={styles.logoutLabel}>Logout</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

export default function StaffNavigator() {
  const { activeTheme } = useTheme();
  const isDark = activeTheme === 'dark';

  return (
    <Drawer.Navigator
      initialRouteName="Pending"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? '#1e293b' : '#fff' },
        headerTintColor: isDark ? '#fff' : '#0f172a',
        drawerStyle: { backgroundColor: isDark ? '#0f172a' : '#fff' },
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
      <Drawer.Screen name="OrderCount" component={OrderCountScreen} options={{ title: 'Order Count' }} />
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
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
