import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  Share,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import adminApi from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import { colors, spacing, shadows } from '../../theme';
import { formatIndianCurrency } from '../../utils/priceFormatter';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { API_BASE } from '../../config';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';

function formatDateTime(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strTime = String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
  return `${day} ${month} ${year}, ${strTime}`;
}

function formatDateOnly(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).substring(2);
  return `${day} ${month} ${year}`;
}

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function getFriendlyDayLabel(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
  const diffTime = todayMidnight.getTime() - dMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const formattedDate = formatDateOnly(d);
  
  if (diffDays === 0) {
    return `${formattedDate} • Today`;
  } else if (diffDays === 1) {
    return `${formattedDate} • 1 day ago`;
  } else if (diffDays > 1 && diffDays < 30) {
    return `${formattedDate} • ${diffDays} days ago`;
  } else if (diffDays >= 30 && diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${formattedDate} • ${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${formattedDate} • ${years} year${years > 1 ? 's' : ''} ago`;
  }
}

function formatTimeOnly(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
}

function formatDateTimeCompact(dateVal) {
  if (!dateVal) return 'N/A';
  const dateStr = formatDateOnly(dateVal);
  const timeStr = formatTimeOnly(dateVal);
  return `${dateStr} • ${timeStr}`;
}

function formatReminderDateTime(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${month} ${year}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function getReminderTimeLeft(dateVal) {
  if (!dateVal) return '';
  const target = new Date(dateVal).getTime();
  const now = Date.now();
  const diff = target - now;
  
  if (diff <= 0) return '(due now)';
  
  const diffMins = Math.floor(diff / (1000 * 60));
  if (diffMins < 60) {
    return `(in ${diffMins}m)`;
  }
  
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (diffHours < 24) {
    return `(in ${diffHours}h ${remainingMins}m)`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  return `(in ${diffDays}d ${remainingHours}h)`;
}

function formatCurrencyNoDecimals(amount) {
  if (amount === undefined || amount === null) return '0';
  const num = Number(amount);
  if (isNaN(num)) return '0';
  const isNegative = num < 0;
  const absNum = Math.abs(num).toFixed(0);
  let lastThree = absNum.substring(absNum.length - 3);
  const otherParts = absNum.substring(0, absNum.length - 3);
  if (otherParts !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherParts.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return isNegative ? '-' + formattedInt : formattedInt;
}


export default function CustomerLedgerScreen({ route, navigation }) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isStaff = !isAdmin;
  const { userId, userName } = route.params || {};

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Socket.io real-time sync
  useEffect(() => {
    const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
    socket.on('ledger:updated', ({ userId: updatedId }) => {
      if (updatedId === userId) {
        fetchLedger(true); // silent auto-refresh
      }
    });
    return () => socket.disconnect();
  }, [userId]);

  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [closeBalanceHistory, setCloseBalanceHistory] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual Transaction Modal Form States
  const [isDrModalVisible, setIsDrModalVisible] = useState(false); // You Gave (Dr)
  const [isCrModalVisible, setIsCrModalVisible] = useState(false); // You Got (Cr)
  const [isQrModalVisible, setIsQrModalVisible] = useState(false); // UPI QR Code Modal

  // Edit Profile Modal States
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAltMobile, setEditAltMobile] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editOpeningBalance, setEditOpeningBalance] = useState('');
  const [editOpeningBalanceType, setEditOpeningBalanceType] = useState('debit');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Report Scoped Date Range & View states
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportFromDate, setReportFromDate] = useState(new Date());
  const [reportToDate, setReportToDate] = useState(new Date());
  const [showReportFromPicker, setShowReportFromPicker] = useState(false);
  const [showReportToPicker, setShowReportToPicker] = useState(false);
  const [isReportActive, setIsReportActive] = useState(false);

  // Close Balance Modal States
  const [isCloseBalanceVisible, setIsCloseBalanceVisible] = useState(false);
  const [closeFromDate, setCloseFromDate] = useState(new Date());
  const [closeToDate, setCloseToDate] = useState(new Date());
  const [showCloseFromPicker, setShowCloseFromPicker] = useState(false);
  const [showCloseToPicker, setShowCloseToPicker] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  // Edit Transaction Modal States
  const [isEditTxVisible, setIsEditTxVisible] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDescription, setEditTxDescription] = useState('');
  const [editTxSubmitting, setEditTxSubmitting] = useState(false);

  // Edit Transaction product picker states (separate from add)
  const [editUseProductPicker, setEditUseProductPicker] = useState(false);
  const [editSelectedProducts, setEditSelectedProducts] = useState([]); // [{product, qty}]

  // Form Inputs
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  // QR Selection & Custom Amount States
  const [selectedPaymentSetting, setSelectedPaymentSetting] = useState(null);
  const [customQrAmount, setCustomQrAmount] = useState('');

  // Product Picker States
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]); // [{product, qty}]
  const [useProductPicker, setUseProductPicker] = useState(false);

  // Collection Reminder States & Sound Assets
  const REMINDER_SONGS = [
    { id: 'song1', name: '🎵 Chime Harmony', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { id: 'song2', name: '🎵 Bells Rhapsody', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { id: 'song3', name: '🎵 Synth Wave', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { id: 'song4', name: '🎵 Retro Pulse', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    { id: 'song5', name: '🎵 Classical Echo', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  ];

  const LOCAL_REMINDER_SONGS = {
    song1: require('../../../assets/sounds/song1.ogg'),
    song2: require('../../../assets/sounds/song2.ogg'),
    song3: require('../../../assets/sounds/song3.ogg'),
    song4: require('../../../assets/sounds/song4.ogg'),
    song5: require('../../../assets/sounds/song5.ogg'),
  };

  const [activeReminder, setActiveReminder] = useState(null);
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [reminderDate, setReminderDate] = useState(new Date());
  const [reminderTime, setReminderTime] = useState(new Date());
  const [reminderDescription, setReminderDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [selectedSong, setSelectedSong] = useState('song1');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const soundRef = useRef(null);

  const stopAnySound = async () => {
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        }
      } catch (e) {
        console.log('Error unloading sound:', e);
      } finally {
        soundRef.current = null;
      }
    }
    setIsPreviewPlaying(false);
  };

  const playSoundPreview = async (songId) => {
    await stopAnySound();
    const songAsset = LOCAL_REMINDER_SONGS[songId];
    if (!songAsset) return;

    try {
      setIsPreviewPlaying(true);
      const { sound } = await Audio.Sound.createAsync(
        songAsset,
        { shouldPlay: true }
      );
      soundRef.current = sound;
      
      // Stop and unload automatically after exactly 5 seconds
      setTimeout(async () => {
        if (soundRef.current === sound) {
          await stopAnySound();
        }
      }, 5000);
    } catch (err) {
      console.log('Failed to play sound preview:', err);
      setIsPreviewPlaying(false);
    }
  };

  useEffect(() => {
    if (!isReminderModalVisible) {
      stopAnySound();
    }
    return () => {
      stopAnySound();
    };
  }, [isReminderModalVisible]);

  // Form input sanitization handlers
  const handleAmountChange = (val) => {
    const sanitized = val.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) return;
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) return;
    // Limit integer part length to 9 digits (max 999,999,999) to prevent overflow
    if (parts[0] && parts[0].length > 9) return;
    setAmount(sanitized);
  };

  const handleQrAmountChange = (val) => {
    const sanitized = val.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    if (parts[0] && parts[0].length > 9) return;
    setCustomQrAmount(sanitized);
  };

  const hasEnteredQty = (qty) => qty !== '' && qty !== null && qty !== undefined && Number(qty) > 0;
  const calculateSelectedProductsTotal = (items) =>
    items.reduce((sum, { product, qty, price }) => hasEnteredQty(qty) ? sum + ((price !== undefined ? price : (product?.price || 0)) * Number(qty)) : sum, 0);
  const syncAmountFromSelectedProducts = (items) => {
    const total = calculateSelectedProductsTotal(items);
    setAmount(total > 0 ? String(Math.round(total)) : '');
  };
  const availableProductsForPicker = products.filter(
    p => !selectedProducts.some(item => item.product._id === p._id)
  );

  // Open modal handlers with safe form clearing
  const openDrModal = async () => {
    setAmount('');
    setDescription('');
    setSelectedProducts([]);
    setProductSearch('');
    setUseProductPicker(false);
    setIsDrModalVisible(true);
    try {
      const prods = await adminApi.getVisibleProducts();
      setProducts(prods || []);
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  };

  const openCrModal = async () => {
    setAmount('');
    setDescription('');
    setSelectedProducts([]);
    setProductSearch('');
    setUseProductPicker(false);
    setIsCrModalVisible(true);
    try {
      const prods = await adminApi.getVisibleProducts();
      setProducts(prods || []);
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  };

  const openQrModal = () => {
    setCustomQrAmount('');
    setIsQrModalVisible(true);
  };

  const fetchLedger = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (!userId) {
        throw new Error('Customer ID is missing.');
      }
      const data = await adminApi.getCustomerLedger(userId);
      setCustomer(data.customer || null);
      setCloseBalanceHistory(data.closeBalanceHistory || []);

      // Sort transactions chronologically (ascending for running balance calculations)
      const sortedTx = [...(data.transactions || [])].reverse();

      // Prepend a virtual transaction for opening balance if exists and > 0
      const hasOpening = data.customer && data.customer.openingBalance !== undefined && data.customer.openingBalance !== null;
      const chronologicalTx = hasOpening ? [
        {
          _id: 'opening-balance-virtual-id',
          date: data.customer.createdAt || new Date(),
          description: 'Opening Balance',
          type: data.customer.openingBalanceType === 'credit' ? 'cr' : 'dr',
          amount: data.customer.openingBalance,
          isOpeningBalance: true,
          isManual: false
        },
        ...sortedTx
      ] : sortedTx;

      let currentRunning = 0;
      const calculatedTx = chronologicalTx.map((t) => {
        if (t.type === 'cr') {
          currentRunning += (t.amount || 0);
        } else if (t.type === 'dr') {
          currentRunning -= (t.amount || 0);
        }
        return {
          ...t,
          runningBalance: currentRunning,
        };
      });

      // Show newest first in flat list statement, excluding the virtual opening balance row
      setTransactions(calculatedTx.reverse().filter(t => !t.isOpeningBalance));
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to load customer statement.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const data = await adminApi.getPaymentSettings();
      setPaymentSettings(data || []);
      if (data && data.length > 0) {
        setSelectedPaymentSetting(data[0]);
      }
    } catch (e) {
      console.error('Error fetching payment settings:', e);
    }
  };

  const loadActiveReminder = async () => {
    try {
      const key = `@ksk_reminder_${userId}`;
      const val = await AsyncStorage.getItem(key);
      if (val) {
        const parsed = JSON.parse(val);
        const remDate = new Date(parsed.date);
        // If reminder is in the past, clean it up from storage
        if (remDate.getTime() < Date.now()) {
          await AsyncStorage.removeItem(key);
          setActiveReminder(null);
        } else {
          setActiveReminder(parsed);
        }
      } else {
        setActiveReminder(null);
      }
    } catch (e) {
      console.error('Failed to load active reminder:', e);
    }
  };

  const openReminderModal = () => {
    // Default reminder date: today (current date)
    const today = new Date();
    
    // Default reminder time: 1 hour in the future, rounded to the next hour
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    defaultTime.setMinutes(0, 0, 0);

    if (activeReminder) {
      const activeDate = new Date(activeReminder.date);
      setReminderDate(activeDate);
      setReminderTime(activeDate);
      setReminderDescription(activeReminder.description || '');
      setSelectedSong(activeReminder.selectedSong || 'song1');
    } else {
      setReminderDate(today);
      setReminderTime(defaultTime);
      setSelectedSong('song1');
      const outstanding = Math.abs(netBal);
      setReminderDescription(
        `Friendly payment collection reminder for ${customer?.name || userName || 'Customer'}. Outstanding balance: ₹${formatCurrencyNoDecimals(outstanding)}.`
      );
    }
    setIsReminderModalVisible(true);
  };

  const handleScheduleReminder = async () => {
    if (!reminderDescription.trim()) {
      Alert.alert('Validation Error', 'Please enter a reminder description.');
      return;
    }

    const now = new Date();
    const finalTriggerDate = new Date(reminderDate);
    finalTriggerDate.setHours(
      reminderTime.getHours(),
      reminderTime.getMinutes(),
      0,
      0
    );

    // Strict Date validation: check if the selected day itself is in the past
    const selectedDateMidnight = new Date(finalTriggerDate);
    selectedDateMidnight.setHours(0, 0, 0, 0);
    
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    if (selectedDateMidnight.getTime() < todayMidnight.getTime()) {
      Alert.alert(
        'Invalid Date Selected', 
        'You cannot schedule a collection reminder for a past date. Please pick today or a future date.'
      );
      return;
    }

    // Strict Time validation: check if the selected hour/minute combination is in the past
    if (finalTriggerDate.getTime() <= now.getTime()) {
      Alert.alert(
        'Invalid Time Selected',
        'The scheduled time has already passed for today. Please select a time in the future.'
      );
      return;
    }

    setReminderSubmitting(true);
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'You need to enable notifications in your system settings to receive collection reminders on this device.',
          [{ text: 'OK' }]
        );
        setReminderSubmitting(false);
        return;
      }

      if (activeReminder && activeReminder.notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(activeReminder.notificationId);
        } catch (err) {
          console.log('Error cancelling old notification:', err);
        }
      }

      // Schedule native OS notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Payment Collection: ${customer?.name || userName || 'Customer'}`,
          body: reminderDescription.trim(),
          data: { customerId: userId, type: 'collection_reminder', selectedSong },
          sound: `${selectedSong}.ogg`,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: `collection-reminders-${selectedSong}`, // Mandated by Android for clean notification grouping
        },
        trigger: {
          type: 'date',
          date: finalTriggerDate,
        },
      });

      const reminderInfo = {
        notificationId,
        date: finalTriggerDate.toISOString(),
        description: reminderDescription.trim(),
        selectedSong,
      };

      await AsyncStorage.setItem(`@ksk_reminder_${userId}`, JSON.stringify(reminderInfo));
      setActiveReminder(reminderInfo);
      setIsReminderModalVisible(false);
      
      Alert.alert(
        'Reminder Scheduled',
        `Collection reminder set successfully for ${formatReminderDateTime(finalTriggerDate)}.`
      );
    } catch (e) {
      console.error('Failed to schedule reminder:', e);
      Alert.alert('Scheduling Error', e.message || 'Could not schedule local notification.');
    } finally {
      setReminderSubmitting(false);
    }
  };

  const handleCancelReminder = () => {
    Alert.alert(
      'Remove Reminder',
      'Are you sure you want to cancel and remove this scheduled collection reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeReminder && activeReminder.notificationId) {
                await Notifications.cancelScheduledNotificationAsync(activeReminder.notificationId);
              }
              await AsyncStorage.removeItem(`@ksk_reminder_${userId}`);
              setActiveReminder(null);
              Alert.alert('Reminder Removed', 'The collection reminder has been deleted successfully.');
            } catch (e) {
              console.error('Failed to remove reminder:', e);
              Alert.alert('Error', 'Could not cancel the scheduled notification.');
            }
          }
        }
      ]
    );
  };

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || reminderDate;
    setShowDatePicker(Platform.OS === 'ios');
    setReminderDate(currentDate);
  };

  const onChangeTime = (event, selectedTime) => {
    const currentTime = selectedTime || reminderTime;
    setShowTimePicker(Platform.OS === 'ios');
    setReminderTime(currentTime);
  };

  useEffect(() => {
    fetchLedger();
    fetchPaymentSettings();
    loadActiveReminder();
    // Preload products so Edit Transaction dropdown is ready immediately
    (async () => {
      try {
        const prods = await adminApi.getVisibleProducts();
        setProducts(prods || []);
      } catch (e) {
        console.error('Failed to preload products:', e);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!activeReminder) return;
    const msLeft = new Date(activeReminder.date).getTime() - Date.now();
    if (msLeft <= 0) {
      // Already completed, clean up immediately from storage
      (async () => {
        try {
          await AsyncStorage.removeItem(`@ksk_reminder_${userId}`);
          setActiveReminder(null);
        } catch (e) {
          console.error('Failed to clean up expired reminder:', e);
        }
      })();
      return;
    }

    // Set a timer to clean it up automatically the second it completes in real-time
    const timer = setTimeout(async () => {
      try {
        await AsyncStorage.removeItem(`@ksk_reminder_${userId}`);
        setActiveReminder(null);
      } catch (e) {
        console.error('Failed to automatically clear completed reminder:', e);
      }
    }, msLeft);

    return () => clearTimeout(timer);
  }, [activeReminder, userId]);

  const handleAddTransaction = async (type) => {
    // Amount is always from user input (now editable even when products selected)
    let finalAmount = amount;
    let productItems = [];
    if (useProductPicker && selectedProducts.length > 0) {
      productItems = selectedProducts
      .filter(({ qty }) => hasEnteredQty(qty))
      .map(({ product, qty }) => ({
        productId: product._id,
        name: product.name,
        sku: product.sku || '',
        qty: parseInt(qty, 10),
        unitPrice: product.price
      }));
    }

    const numAmount = parseFloat(finalAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (numAmount > 999999999.99) {
      Alert.alert('Validation Error', 'Amount cannot exceed ₹99,99,99,999.99.');
      return;
    }

    let finalDescription = description.trim();
    if (useProductPicker && selectedProducts.length > 0 && !finalDescription) {
      finalDescription = selectedProducts
        .filter(({ qty }) => hasEnteredQty(qty))
        .map(({product, qty}) => `${product.name} ×${qty}`)
        .join(', ');
    }
    if (!finalDescription) {
      finalDescription = type === 'dr' ? 'You Gave' : 'You Got';
    }

    try {
      setSubmitting(true);
      await adminApi.addLedgerTransaction({
        userId,
        type,
        amount: numAmount,
        description: finalDescription,
        date: new Date(),
        productItems: productItems.length > 0 ? productItems : undefined
      });

      // Reset Form and close modals
      setAmount('');
      setDescription('');
      setSelectedProducts([]);
      setUseProductPicker(false);
      setIsDrModalVisible(false);
      setIsCrModalVisible(false);

      // Reload
      await fetchLedger();
      Alert.alert('Success', 'Ledger transaction logged successfully.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to record entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = (txId) => {
    Alert.alert(
      'Delete Ledger Entry?',
      'Are you sure you want to delete this ledger entry? Balances will be recalculated immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await adminApi.deleteLedgerTransaction(txId);
              await fetchLedger();
              Alert.alert('Success', 'Ledger entry deleted successfully.');
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete transaction.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSendWhatsApp = () => {
    if (!customer) return;
    const net = customer.netBalance || 0;
    const phone = customer.mobile || '';

    if (!phone) {
      Alert.alert('Error', 'Customer mobile number is missing.');
      return;
    }

    let messageText = '';
    if (net < 0) {
      // Customer owes us
      const absBal = Math.abs(net).toFixed(2);
      messageText = `Dear ${customer.name},\n\nThis is a friendly reminder from KSK VASU & Co. Your current outstanding balance is *₹${absBal}*.\n\nPlease clear the pending amount at your earliest convenience.\n\nThank you for your business!`;
    } else if (net > 0) {
      // We owe customer
      messageText = `Dear ${customer.name},\n\nGreeting from KSK VASU & Co. You have an advance credit balance of *₹${net.toFixed(2)}* with us.\n\nThank you for your continued support!`;
    } else {
      messageText = `Dear ${customer.name},\n\nGreeting from KSK VASU & Co. Your ledger account is fully settled with ₹0.00 outstanding.\n\nThank you!`;
    }

    const encodedText = encodeURIComponent(messageText);
    const cleanPhone = phone.length === 10 ? '91' + phone : phone;
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodedText}`).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on this device.');
    });
  };

  const generateStatementHtml = (fromDate, toDate) => {
    if (!customer || !transactions.length) {
      return null;
    }

    const formatPDFCurrency = (num) => {
      const parsed = Math.abs(num || 0);
      if (parsed % 1 === 0) {
        return parsed.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      } else {
        return parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    };

    const isScoped = fromDate && toDate;
    const chronological = [...transactions].reverse();
    let scopedTx = chronological;
    let startBal = 0;
    let totalDr = 0;
    let totalCr = 0;

    if (isScoped) {
      const start = new Date(fromDate.toISOString().split('T')[0] + 'T00:00:00');
      const end = new Date(toDate.toISOString().split('T')[0] + 'T23:59:59');

      // Show only the recorded latest close opening balance without adding prior transaction amounts
      startBal = customer.openingBalanceType === 'credit' ? -(customer.openingBalance || 0) : (customer.openingBalance || 0);

      scopedTx = chronological.filter(t => {
          if (t.isOpeningBalance) return false;
          const d = new Date(t.date);
          return d >= start && d <= end;
      });
    }

    const oldestTxDate = scopedTx.length > 0 ? formatDateOnly(scopedTx[0].date) : 'Start';
    const newestTxDate = scopedTx.length > 0 ? formatDateOnly(scopedTx[scopedTx.length - 1].date) : 'End';
    const statementRangeStr = isScoped
      ? `${formatDateOnly(fromDate)} to ${formatDateOnly(toDate)}`
      : (scopedTx.length > 0 ? `${oldestTxDate} to ${newestTxDate}` : 'All-Time');

    let runningBal = startBal;
    const rowsHtml = scopedTx.map((t, index) => {
        if (t.type === 'dr') {
            runningBal += (t.amount || 0);
            totalDr += (t.amount || 0);
        } else {
            runningBal -= (t.amount || 0);
            totalCr += (t.amount || 0);
        }

        let productLinesHtml = '';
        if (t.productItems && t.productItems.length > 0) {
            productLinesHtml = t.productItems.map(p => 
                `<div style="font-size: 9.5px; color: #4b5563; margin-top: 2px; padding-left: 12px; font-weight: 500;">&bull; ${p.name}${p.sku ? ` (${p.sku})` : ''} - ${p.qty} X &#8377;${formatPDFCurrency(p.unitPrice)}</div>`
            ).join('');
        } else if (t.skuLine) {
            productLinesHtml = `<div style="font-size: 9.5px; color: #0369a1; margin-top: 2px; padding-left: 12px; font-weight: 600;">${t.skuLine}</div>`;
        }

        const source = t.orderId ? '<span style="font-size: 8.5px; background: #e0f2fe; color: #0369a1; padding: 1px 4px; border-radius: 3px; font-weight: bold; margin-left: 6px;">ORDER</span>' : '';

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 10px 8px; font-size: 10px; color: #64748b; white-space: nowrap; vertical-align: top;">
              ${formatDateOnly(t.date)}
            </td>
            <td style="padding: 10px 8px; font-size: 11px; color: #1e293b; vertical-align: top;">
              <div style="font-weight: 600; color: #0f172a;">${t.description || 'Ledger Entry'} ${source}</div>
              ${productLinesHtml}
            </td>
            <td style="padding: 10px 8px; font-size: 11px; font-weight: bold; text-align: right; color: #dc2626; vertical-align: top; white-space: nowrap; padding-right: 30px;">
              ${t.type === 'dr' ? `&#8377;${formatPDFCurrency(t.amount)}` : '<span style="color: #cbd5e1;">&mdash;</span>'}
            </td>
            <td style="padding: 10px 8px; font-size: 11px; font-weight: bold; text-align: right; color: #059669; vertical-align: top; white-space: nowrap; padding-right: 30px;">
              ${t.type === 'cr' ? `&#8377;${formatPDFCurrency(t.amount)}` : '<span style="color: #cbd5e1;">&mdash;</span>'}
            </td>
          </tr>
        `;
    }).join('');

    const netVal = runningBal;
    const generatedAtStr = formatDateTime(new Date());
    const balanceLabel = netVal === 0 ? 'Settled' : netVal > 0 ? 'Due' : 'Advance';
    const balanceColor = netVal >= 0 ? '#dc2626' : '#059669';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>KSK Ledger Statement</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 25px;
            font-size: 11px;
            line-height: 1.4;
            background-color: #fff;
          }
          .container {
            width: 100%;
          }
          .header-banner {
            background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);
            color: #ffffff;
            padding: 24px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .header-left h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .header-left p {
            margin: 4px 0 0 0;
            font-size: 11px;
            opacity: 0.9;
            font-weight: 500;
          }
          .header-right {
            text-align: right;
            font-size: 10px;
            font-weight: 500;
          }
          .header-right div {
            margin-bottom: 3px;
          }
          .profile-section {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 20px;
          }
          .profile-card {
            flex: 1;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
          }
          .profile-card h3 {
            margin: 0 0 10px 0;
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 6px;
          }
          .meta-item {
            display: flex;
            margin-bottom: 6px;
          }
          .meta-label {
            width: 100px;
            font-weight: 600;
            color: #64748b;
          }
          .meta-value {
            flex: 1;
            color: #1e293b;
            font-weight: 700;
          }
          .summary-card {
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }
          .summary-item {
            text-align: center;
            flex: 1;
          }
          .summary-item:not(:last-child) {
            border-right: 1.5px solid #cbd5e1;
          }
          .summary-label {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 4px;
            letter-spacing: 0.3px;
          }
          .summary-value {
            font-size: 18px;
            font-weight: 800;
          }
          .summary-value.dr {
            color: #dc2626;
          }
          .summary-value.cr {
            color: #059669;
          }
          .table-container {
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 12px 8px;
            border-bottom: 2px solid #cbd5e1;
          }
          td {
            padding: 12px 8px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
          }
          .footer-section {
            margin-top: 50px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            color: #64748b;
          }
          .footer-left {
            font-size: 9.5px;
            line-height: 1.5;
          }
          .footer-right {
            text-align: right;
          }
          .authorized-sig {
            border-top: 1.5px solid #64748b;
            width: 220px;
            text-align: center;
            padding-top: 6px;
            font-size: 11px;
            font-weight: bold;
            color: #1e293b;
            margin-left: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-banner">
            <div class="header-left">
              <h1>KSK VASU &amp; Co</h1>
              <p>Building Materials Service Center &amp; Logistics</p>
            </div>
            <div class="header-right">
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-bottom: 3px;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"/></svg>
                <span>+91 94433 50464</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-bottom: 3px;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"/></svg>
                <span>+91 95665 30464</span>
              </div>
              <div style="margin-top: 4px;"><a href="https://www.kskvasu.co.in" target="_blank" style="color: #ffffff; font-weight: 850; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; letter-spacing: 0.3px;">www.kskvasu.co.in</a></div>
            </div>
          </div>

          <div class="profile-section">
            <div class="profile-card">
              <h3>Statement Details</h3>
              <div class="meta-item">
                <span class="meta-label">Customer Name:</span>
                <span class="meta-value">${customer.name}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Mobile Number:</span>
                <span class="meta-value">+91 ${customer.mobile || 'N/A'}</span>
              </div>
              ${customer.altMobile ? `
                <div class="meta-item">
                  <span class="meta-label">Alt Mobile:</span>
                  <span class="meta-value">+91 ${customer.altMobile}</span>
                </div>
              ` : ''}
              <div class="meta-item">
                <span class="meta-label">Address:</span>
                <span class="meta-value">${customer.address || 'N/A'}</span>
              </div>
            </div>
            <div class="profile-card">
              <h3>Account Context</h3>
              <div class="meta-item">
                <span class="meta-label">Account Type:</span>
                <span class="meta-value">${customer.ledgerType || 'Customer'}</span>
              </div>

              <div class="meta-item">
                <span class="meta-label">Statement Date:</span>
                <span class="meta-value">${generatedAtStr}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Statement Range:</span>
                <span class="meta-value">${statementRangeStr}</span>
              </div>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-item">
              <div class="summary-label">OPENING BALANCE (${isScoped ? formatDateOnly(fromDate) : 'As On Date'})</div>
              <div class="summary-value" style="color: #475569;">&#8377;${isScoped 
                ? formatPDFCurrency(startBal) + ` (${startBal >= 0 ? 'Due' : 'Advance'})`
                : formatPDFCurrency(customer.openingBalance || 0) + ` (${customer.openingBalanceType === 'credit' ? 'Credit' : 'Debit'})`
              }</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">TOTAL DEBIT</div>
              <div class="summary-value dr">&#8377;${formatPDFCurrency(isScoped ? totalDr : (customer.totalYouGave || 0))}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">TOTAL CREDIT</div>
              <div class="summary-value cr">&#8377;${formatPDFCurrency(isScoped ? totalCr : (customer.totalYouGot || 0))}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">NET BALANCE</div>
              <div class="summary-value" style="color: ${balanceColor};">&#8377;${formatPDFCurrency(netVal)} (${balanceLabel})</div>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 18%;">Date</th>
                  <th style="width: 52%;">Description / Products / References</th>
                  <th style="width: 15%; text-align: right; padding-right: 30px;">Debit</th>
                  <th style="width: 15%; text-align: right; padding-right: 30px;">Credit</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="footer-section">
            <div class="footer-left">
              <strong>This is the Authorized Digital Statement From KSK VASU &amp; Co</strong><br/>
              <em>Thank you for doing business with us!</em>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    return html;
  };

  const handleDownloadStatement = async (fromDate, toDate) => {
    try {
      const html = generateStatementHtml(fromDate, toDate);
      if (!html) {
        Alert.alert('No Entries', 'No ledger statement data is available to download.');
        return;
      }
      await Print.printAsync({ html });
    } catch (e) {
      console.error(e);
      Alert.alert('PDF Print Failure', e.message || 'Could not compile and export ledger PDF.');
    }
  };

  const handleShareStatement = async (fromDate, toDate) => {
    try {
      const html = generateStatementHtml(fromDate, toDate);
      if (!html) {
        Alert.alert('No Entries', 'No ledger statement data is available to share.');
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      console.error(e);
      Alert.alert('PDF Sharing Failure', e.message || 'Could not compile and share ledger PDF.');
    }
  };

  const handleSwitchLedgerType = () => {
    if (!customer) return;
    const currentType = (customer.ledgerType || 'Customer').toLowerCase();
    const targetType = currentType === 'supplier' ? 'Customer' : 'Supplier';
    Alert.alert(
      'Switch Account Type?',
      `Are you sure you want to convert this account to a ${targetType}? All existing transactions will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Convert to ${targetType}`,
          onPress: async () => {
            try {
              setLoading(true);
              await adminApi.switchLedgerType(userId, targetType);
              setIsEditProfileVisible(false);
              await fetchLedger();
              Alert.alert('Success', `Account successfully converted to ${targetType}.`);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to switch ledger type.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const openEditProfile = () => {
    if (!customer) return;
    setEditName(customer.name || '');
    setEditMobile(customer.mobile || '');
    setEditEmail(customer.email || '');
    setEditAddress(customer.address || '');
    setEditAltMobile(customer.altMobile || '');
    setEditPincode(customer.pincode || '');
    setEditOpeningBalance(customer.openingBalance !== undefined ? String(customer.openingBalance) : '0');
    setEditOpeningBalanceType(customer.openingBalanceType || 'debit');
    setIsEditProfileVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
    if (!editMobile || !/^\d{10}$/.test(editMobile)) { Alert.alert('Validation', 'Valid 10-digit mobile is required.'); return; }
    setEditSubmitting(true);
    try {
      await adminApi.updateUser(userId, {
        name: editName.trim(),
        mobile: editMobile.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        altMobile: editAltMobile.trim(),
        pincode: editPincode.trim(),
        openingBalance: Number(editOpeningBalance) || 0,
        openingBalanceType: editOpeningBalanceType,
      });
      setIsEditProfileVisible(false);
      await fetchLedger();
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openReportModal = () => {
    if (transactions && transactions.length > 0) {
      const oldestDate = transactions[transactions.length - 1].date;
      setReportFromDate(new Date(oldestDate));
    } else {
      setReportFromDate(new Date());
    }
    setReportToDate(new Date());
    setIsReportModalVisible(true);
  };

  const handleGenerateReport = () => {
    if (!reportFromDate || !reportToDate) {
      Alert.alert('Validation Error', 'Both Start and End dates are required.');
      return;
    }

    const now = new Date();
    if (reportFromDate > now || reportToDate > now) {
      Alert.alert('Validation Error', 'Future dates/time are not allowed for report generation.');
      return;
    }

    setIsReportModalVisible(false);
    setIsReportActive(true);
  };

  const openCloseBalance = () => {
    if (transactions && transactions.length > 0) {
      const oldestDate = transactions[transactions.length - 1].date;
      setCloseFromDate(new Date(oldestDate));
    } else {
      setCloseFromDate(new Date());
    }
    setCloseToDate(new Date());
    setIsCloseBalanceVisible(true);
  };

  const handleCloseBalance = async () => {
    if (!closeFromDate || !closeToDate) {
      Alert.alert('Validation Error', 'Both From and To dates are required.');
      return;
    }

    const fromStr = closeFromDate.toISOString().split('T')[0];
    const toStr = closeToDate.toISOString().split('T')[0];

    Alert.alert(
      '🔒 Close & Reconcile Ledger?',
      `This will close all transactions from ${fromStr} to ${toStr} and carry their net sum to the user's Opening Balance.\n\nThe reconciled entries will NOT be deleted, but will be locked and displayed in a dull color. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setCloseSubmitting(true);
            try {
              await adminApi.closeLedgerBalance(userId, { fromDate: fromStr, toDate: toStr });
              Alert.alert('Success', 'Ledger transactions in specified range successfully closed and carried forward.');
              setIsCloseBalanceVisible(false);
              await fetchLedger();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to close ledger balance.');
            } finally {
              setCloseSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleRevertCloseBalance = (closeId) => {
    Alert.alert(
      'Revert Close Balance?',
      'This will un-lock those closed entries and restore opening balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: async () => {
            try {
              setCloseSubmitting(true);
              await adminApi.revertCloseBalance(userId, closeId);
              Alert.alert('Success', 'Close balance reverted successfully.');
              await fetchLedger();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to revert close balance.');
            } finally {
              setCloseSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteCloseBalance = (closeId) => {
    Alert.alert(
      'Delete Close Balance?',
      'This will restore opening balance and permanently delete the closed transactions in that batch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setCloseSubmitting(true);
              await adminApi.deleteCloseBalance(userId, closeId);
              Alert.alert('Success', 'Close balance deleted successfully.');
              await fetchLedger();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete close balance.');
            } finally {
              setCloseSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleRemoveUserFromLedger = () => {
    const userName = customer?.name || editName || 'this user';
    Alert.alert(
      'Delete from Ledger?',
      `Are you sure you want to permanently remove ${userName} from the ledger?\n\nThis will reset their outstanding balance to zero and permanently delete all their transactions. This action CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete User Account',
          style: 'destructive',
          onPress: async () => {
            try {
              setEditSubmitting(true);
              await adminApi.removeFromLedger(userId);
              setIsEditProfileVisible(false);
              Alert.alert('Success', `Successfully removed ${userName} from the ledger.`);
              navigation.navigate('Ledger');
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to remove user from ledger.');
            } finally {
              setEditSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleClearStatements = () => {
    const userName = customer?.name || editName || 'this user';
    Alert.alert(
      'Clear All Statements?',
      `Are you sure you want to permanently clear all ledger statements for ${userName}?\n\nThis keeps the user in ledger but resets their statement history and balances to zero. This action CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Statements',
          style: 'destructive',
          onPress: async () => {
            try {
              setEditSubmitting(true);
              await adminApi.clearLedgerStatements(userId);
              setIsEditProfileVisible(false);
              await fetchLedger();
              Alert.alert('Success', `All statements cleared for ${userName}.`);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to clear statements.');
            } finally {
              setEditSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const openEditTransaction = async (tx) => {
    setEditTx(tx);
    setEditTxAmount(String(tx.amount || ''));
    setEditTxDescription(tx.description || '');

    // Ensure products are loaded for the inventory dropdown in Edit Transaction
    if (products.length === 0) {
      try {
        const prods = await adminApi.getVisibleProducts();
        setProducts(prods || []);
      } catch (e) {
        console.error('Failed to load products for Edit Transaction:', e);
      }
    }

    // Prefill product items from the tx snapshot for editing
    if (Array.isArray(tx.productItems) && tx.productItems.length > 0) {
      const loaded = tx.productItems.map(item => ({
        product: {
          _id: item.productId || item._id || '',
          name: item.name || 'Unknown',
          sku: item.sku || '',
          price: item.unitPrice || 0
        },
        qty: item.qty || 1,
        price: item.unitPrice || 0
      }));
      setEditSelectedProducts(loaded);
      setEditUseProductPicker(true);
    } else {
      setEditSelectedProducts([]);
      setEditUseProductPicker(false);
    }

    setIsEditTxVisible(true);
  };

  // Helper for Edit Tx: update products and sync the main Amount so that
  // qty / unitPrice / add/remove changes are reflected in the Chronological Statement values.
  const syncEditProductsAndAmount = (newList) => {
    setEditSelectedProducts(newList);
    const total = newList.reduce((sum, { product, qty }) => sum + ((product.price || 0) * (parseInt(qty) || 1)), 0);
    setEditTxAmount(String(Math.round(total))); // match mobile's integer display style
  };

  const handleSaveTransaction = async () => {
    if (!editTx) return;

    // If using product picker and all items are deleted, treat it as a deletion request
    if (editUseProductPicker && editSelectedProducts.length === 0) {
      Alert.alert(
        isAdmin ? 'Delete Ledger Entry?' : 'Request Deletion?',
        isAdmin
          ? 'You have removed all items from this entry. Are you sure you want to delete this ledger entry? Balances will be recalculated immediately.'
          : 'You have removed all items from this entry. Request deletion of this ledger entry? This request requires Admin approval.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: isAdmin ? 'Delete' : 'Request',
            style: 'destructive',
            onPress: async () => {
              setEditTxSubmitting(true);
              try {
                setIsEditTxVisible(false);
                const res = await adminApi.deleteLedgerTransaction(editTx._id);
                setEditTx(null);
                setEditSelectedProducts([]);
                setEditUseProductPicker(false);
                await fetchLedger();
                if (res && res.pendingApproval) {
                  Alert.alert('Request Sent', 'Deletion request sent to Admin successfully.');
                } else {
                  Alert.alert('Success', 'Ledger entry deleted successfully.');
                }
              } catch (err) {
                Alert.alert('Error', err.message || 'Failed to delete transaction.');
              } finally {
                setEditTxSubmitting(false);
              }
            }
          }
        ]
      );
      return;
    }

    const numAmount = parseFloat(editTxAmount);
    if (isNaN(numAmount) || numAmount <= 0) { Alert.alert('Validation', 'Please enter a valid amount greater than 0.'); return; }
    setEditTxSubmitting(true);
    try {
      let productItems = [];
      let finalDescription = editTxDescription.trim() || editTx.description || '';

      if (editUseProductPicker && editSelectedProducts.length > 0) {
        productItems = editSelectedProducts.map(({ product, qty }) => ({
          productId: product._id,
          name: product.name,
          sku: product.sku || '',
          qty: parseInt(qty) || 1,
          unitPrice: price !== undefined ? price : product.price
        }));
        // Do not auto-populate description from product names
      }

      await adminApi.updateLedgerTransaction(editTx._id, {
        amount: numAmount,
        description: finalDescription,
        productItems: productItems.length > 0 ? productItems : undefined,
      });
      setIsEditTxVisible(false);
      setEditTx(null);
      setEditSelectedProducts([]);
      setEditUseProductPicker(false);
      await fetchLedger();
      Alert.alert('Success', 'Transaction updated successfully.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update transaction.');
    } finally {
      setEditTxSubmitting(false);
    }
  };

  const handleDeleteTransactionFromEdit = (txId) => {
    Alert.alert(
      'Delete Ledger Entry?',
      'Are you sure you want to delete this ledger entry? Balances will be recalculated immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsEditTxVisible(false);
              setEditSelectedProducts([]);
              setEditUseProductPicker(false);
              setLoading(true);
              await adminApi.deleteLedgerTransaction(txId);
              await fetchLedger();
              Alert.alert('Success', 'Ledger entry deleted successfully.');
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete transaction.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleApproveDelete = async (txId) => {
    Alert.alert(
      'Approve Deletion?',
      'Are you sure you want to approve this deletion request? The entry will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsEditTxVisible(false);
              setLoading(true);
              await adminApi.approveLedgerDelete(txId);
              await fetchLedger();
              Alert.alert('Success', 'Deletion approved.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to approve deletion.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRejectDelete = async (txId) => {
    Alert.alert(
      'Reject Deletion?',
      'Are you sure you want to reject this deletion request? The entry will remain active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'default',
          onPress: async () => {
            try {
              setIsEditTxVisible(false);
              setLoading(true);
              await adminApi.rejectLedgerDelete(txId);
              await fetchLedger();
              Alert.alert('Success', 'Deletion request rejected.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to reject deletion.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading && !refreshing) {
    return <Loading />;
  }

  if (!customer) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>Customer profile not found.</Text>
        <Pressable style={styles.fallbackBackBtn} onPress={() => navigation.navigate('Ledger')}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const netBal = customer.netBalance || 0;
  const isDue = netBal < 0;

  // Formulate UPI payment URI details
  const finalPaymentAmount = customQrAmount || Math.abs(netBal).toFixed(2);
  const upiUrl = `upi://pay?pa=kskvasuco@oksbi&pn=KSK%20VASU%20%26%20Co&am=${finalPaymentAmount}&cu=INR`;
  const upiQrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;

  const renderHeader = () => {
    const isDue = netBal < 0;
    const initials = (customer.name || 'U')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const isSupplier = (customer?.ledgerType || 'Customer').toLowerCase() === 'supplier';
    const headerBgColor = isSupplier ? '#0f766e' : '#0f52ba';

    return (
      <View style={styles.headerBlock}>
        {/* Blue Header Section */}
        <View style={[styles.blueHeader, { backgroundColor: headerBgColor }]}>
          <Pressable onPress={() => navigation.navigate('Ledger')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={styles.headerAvatarCircle}>
            <Text style={[styles.headerAvatarText, { color: headerBgColor }]}>{initials}</Text>
          </View>
          <Pressable onPress={openEditProfile} style={styles.headerTitleCol}>
            <Text style={styles.headerNameText} numberOfLines={1}>{customer.name}</Text>
            <Text style={[styles.headerSubLink, { color: 'rgba(255,255,255,0.7)', fontSize: 11 }]}>
              {customer.ledgerType || 'Customer'}
            </Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`tel:${customer.mobile}`)} style={styles.callIconBtn}>
            <Ionicons name="call" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Unified Edge-to-Edge Banner Block */}
        <View style={[styles.detailsKpiCard, { backgroundColor: headerBgColor, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }]}>
          <View style={styles.kpiMainRow}>
            <Text style={[styles.kpiTitleText, { color: 'rgba(255,255,255,0.8)' }]}>
              {netBal === 0 ? 'Account Settle Balanced' : isDue ? 'You will get' : 'You will give'}
            </Text>
            <Text style={[
              styles.kpiValueText,
              { color: '#fff', fontSize: 26, fontWeight: '800' }
            ]}>
              ₹{formatIndianCurrency(Math.abs(netBal))}
            </Text>
          </View>
          <View style={[styles.kpiDividerLine, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <View style={styles.kpiBottomRow}>
            {activeReminder ? (
              <>
                <Text style={[styles.kpiBottomText, { color: '#fbbf24', fontWeight: '800', flex: 1 }]} numberOfLines={1}>
                  ⏰ {formatReminderDateTime(activeReminder.date)} {getReminderTimeLeft(activeReminder.date)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable onPress={openReminderModal} style={{ marginRight: 15 }}>
                    <Text style={[styles.kpiAddLink, { color: '#fff', fontWeight: '800' }]}>EDIT</Text>
                  </Pressable>
                  <Pressable onPress={handleCancelReminder}>
                    <Text style={[styles.kpiAddLink, { color: '#f87171', fontWeight: '800' }]}>REMOVE</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.kpiBottomText, { color: 'rgba(255,255,255,0.8)' }]}>Set collection reminder</Text>
                <Pressable onPress={openReminderModal}>
                  <Text style={[styles.kpiAddLink, { color: '#fbbf24', fontWeight: '800' }]}>ADD</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Tab / Action Bar */}
        <View style={[styles.actionTabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable style={styles.actionTabItem} onPress={openReportModal}>
            <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.actionTabLabel, { color: colors.text }]}>Report</Text>
          </Pressable>
          <Pressable style={styles.actionTabItem} onPress={handleSendWhatsApp}>
            <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.actionTabLabel, { color: colors.text }]}>Reminder</Text>
          </Pressable>
          <Pressable style={styles.actionTabItem} onPress={openQrModal}>
            <Ionicons name="qr-code-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.actionTabLabel, { color: colors.text }]}>UPI QR</Text>
          </Pressable>
          <Pressable style={styles.actionTabItem} onPress={openCloseBalance}>
            <Ionicons name="lock-closed-outline" size={20} color="#dc2626" />
            <Text style={[styles.actionTabLabel, { color: '#dc2626' }]}>Close Bal</Text>
          </Pressable>
        </View>

        <Text style={[styles.ledgerHistoryTitle, { marginHorizontal: spacing.md, marginTop: spacing.md }]}>Chronological History Statement</Text>
        <View style={[styles.columnHeaders, { marginHorizontal: spacing.md, borderRadius: 8 }]}>
          <Text style={[styles.colHeaderLabel, { flex: 2 }]}>ENTRIES</Text>
          <Text style={[styles.colHeaderLabel, { flex: 1, textAlign: 'center' }]}>YOU GAVE</Text>
          <Text style={[styles.colHeaderLabel, { flex: 1, textAlign: 'center' }]}>YOU GOT</Text>
        </View>
      </View>
    );
  };

  // Scoped calculation values for Mobile Screen report
  let reportOpeningBalance = 0;
  let reportTotalDebit = 0;
  let reportTotalCredit = 0;
  let reportClosingBalance = 0;
  let reportScopedTx = [];

  if (isReportActive && reportFromDate && reportToDate) {
    const chronological = [...transactions].reverse();
    const start = new Date(reportFromDate.toISOString().split('T')[0] + 'T00:00:00');
    const end = new Date(reportToDate.toISOString().split('T')[0] + 'T23:59:59');

    // Show only the recorded latest close opening balance without adding prior transaction amounts
    let runningVal = customer.openingBalanceType === 'credit' ? -(customer.openingBalance || 0) : (customer.openingBalance || 0);
    reportOpeningBalance = runningVal;

    // Scoped transactions (excluding the virtual opening balance item itself)
    const scoped = chronological.filter(t => {
      if (t.isOpeningBalance) return false;
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    reportScopedTx = scoped.map(t => {
      if (t.type === 'dr') {
        reportTotalDebit += (t.amount || 0);
        runningVal += (t.amount || 0);
      } else {
        reportTotalCredit += (t.amount || 0);
        runningVal -= (t.amount || 0);
      }
      return {
        ...t,
        scopedRunningBalance: runningVal
      };
    });
    reportClosingBalance = runningVal;
  }

  return (
    <View style={styles.container}>
      {isReportActive ? (
        /* DATE RANGE SCOPED STATEMENT REPORT VIEW */
        <FlatList
          data={reportScopedTx}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={() => (
            <View style={{ backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 28) + 12, paddingBottom: spacing.md }}>
              {/* Go Back Header */}
              <Pressable 
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.md }} 
                onPress={() => setIsReportActive(false)}
              >
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary, marginLeft: 8 }}>
                  Go Back to Full Ledger
                </Text>
              </Pressable>

              {/* Title */}
              <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                  📊 Scoped Statement Report
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                  Statement for {customer.name} from {formatDateOnly(reportFromDate)} to {formatDateOnly(reportToDate)}.
                </Text>
              </View>

              {/* Scoped Summary Card Layout */}
              <View style={{ marginHorizontal: spacing.md, backgroundColor: colors.card, borderLeftWidth: 4, borderLeftColor: colors.primary, borderRadius: 8, padding: spacing.md, gap: spacing.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, marginBottom: spacing.lg }}>
                {/* Grid items */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>OPENING BALANCE ({formatDateOnly(reportFromDate)})</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                      ₹{Math.abs(reportOpeningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({reportOpeningBalance >= 0 ? 'Due' : 'Advance'})
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>NET BALANCE</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: reportClosingBalance >= 0 ? '#dc2626' : '#059669', marginTop: 2 }}>
                      ₹{Math.abs(reportClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({reportClosingBalance >= 0 ? 'Due' : 'Advance'})
                    </Text>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>TOTAL DEBIT</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#dc2626', marginTop: 2 }}>
                      ₹{reportTotalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>TOTAL CREDIT</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#059669', marginTop: 2 }}>
                      ₹{reportTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.ledgerHistoryTitle, { marginHorizontal: spacing.md }]}>Scoped Transactions List</Text>
              <View style={[styles.columnHeaders, { marginHorizontal: spacing.md, borderRadius: 8 }]}>
                <Text style={[styles.colHeaderLabel, { flex: 2 }]}>ENTRIES</Text>
                <Text style={[styles.colHeaderLabel, { flex: 1, textAlign: 'center' }]}>YOU GAVE</Text>
                <Text style={[styles.colHeaderLabel, { flex: 1, textAlign: 'center' }]}>YOU GOT</Text>
              </View>
            </View>
          )}
          ListFooterComponent={() => (
            <View style={{ padding: spacing.md, gap: spacing.md, marginBottom: 50 }}>
              <Pressable 
                style={{ backgroundColor: '#0f52ba', padding: spacing.md, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, elevation: 2 }}
                onPress={() => handleDownloadStatement(reportFromDate, reportToDate)}
              >
                <Ionicons name="download" size={18} color="white" />
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>
                  Download PDF Statement
                </Text>
              </Pressable>

              <Pressable 
                style={{ backgroundColor: '#059669', padding: spacing.md, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, elevation: 2 }}
                onPress={() => handleShareStatement(reportFromDate, reportToDate)}
              >
                <Ionicons name="share-social" size={18} color="white" />
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>
                  Share PDF Statement
                </Text>
              </Pressable>

              <Pressable 
                style={{ backgroundColor: colors.border, padding: spacing.md, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setIsReportActive(false)}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                  ⬅️ Go Back to Full Ledger
                </Text>
              </Pressable>
            </View>
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          ListEmptyComponent={() => (
            <View style={[styles.emptyHistoryContainer, { marginHorizontal: spacing.md, paddingVertical: 40 }]}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyHistoryText}>No transactions in selected range.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isDr = item.type === 'dr';
            return (
              <View style={{ paddingHorizontal: spacing.md }}>
                <View style={styles.transactionRow}>
                  <View style={[styles.entryDetailsCol, { flex: 2 }]}>
                    <View style={styles.entryRowHeader}>
                      <Text style={styles.txDateCompact}>{formatDateOnly(item.date)}</Text>
                    </View>
                    <Text style={styles.txDescription}>{item.description || 'Ledger Entry'}</Text>
                    {item.productItems && item.productItems.length > 0 && (
                      <View style={{ marginTop: 4, paddingLeft: 4 }}>
                        {item.productItems.map((p, pIdx) => (
                          <Text key={pIdx} style={{ fontSize: 11, color: colors.textMuted }}>
                            📦 {p.name} - {p.qty} X ₹{p.unitPrice}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={[styles.amountCol, { flex: 1, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f1f5f9' }]}>
                    <Text style={[styles.amountVal, { color: '#dc2626', textAlign: 'center', fontWeight: '700' }]}>
                      {isDr ? `₹${item.amount.toLocaleString('en-IN')}` : '—'}
                    </Text>
                  </View>

                  <View style={[styles.amountCol, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={[styles.amountVal, { color: '#059669', textAlign: 'center', fontWeight: '700' }]}>
                      {!isDr ? `₹${item.amount.toLocaleString('en-IN')}` : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <>
          <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLedger(true)}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        ListEmptyComponent={
          <View style={[styles.emptyHistoryContainer, { marginHorizontal: spacing.md }]}>
            <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyHistoryText}>No transactions recorded.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isDr = item.type === 'dr';

          // Check if we should render a date section header badge above this row
          const showDateHeader = index === 0 || !isSameDay(item.date, transactions[index - 1].date);

          return (
            <View style={{ paddingHorizontal: spacing.md }}>
              {showDateHeader && (
                <View style={styles.sectionHeaderContainer}>
                  <View style={styles.sectionHeaderBadge}>
                    <Text style={styles.sectionHeaderBadgeText}>
                      {getFriendlyDayLabel(item.date)}
                    </Text>
                  </View>
                </View>
              )}
              <Pressable 
                style={({ pressed }) => [
                  styles.transactionRow,
                  item.isClosed && { opacity: 0.45, backgroundColor: colors.background },
                  pressed && !item.isClosed && { opacity: 0.7, backgroundColor: 'rgba(0,0,0,0.03)' }
                ]}
                disabled={item.isClosed}
                onPress={() => {
                  if (item.isManual) {
                    openEditTransaction(item);
                  } else {
                    Alert.alert('Order Entry', 'This statement entry was created automatically via an order and cannot be modified directly.');
                  }
                }}
              >
                {/* Left Column: Entries details */}
                <View style={[styles.entryDetailsCol, { flex: 2 }]}>
                   <View style={styles.entryRowHeader}>
                     <Text style={styles.txDateCompact}>
                       {formatTimeOnly(item.date)}
                     </Text>
                     {item.isClosed && (
                       <View style={{ marginLeft: 6, flexDirection: 'row', alignItems: 'center' }}>
                         <Ionicons name="lock-closed" size={10} color="#94a3b8" />
                         <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 'bold', marginLeft: 2 }}>CLOSED</Text>
                       </View>
                     )}
                   </View>
                  <Text style={styles.txDescCompact} numberOfLines={2}>
                    {item.description}
                  </Text>
                  {item.skuLine ? (
                    <View style={styles.skuBadge}>
                      <Text style={styles.skuBadgeText}>{item.skuLine}</Text>
                    </View>
                  ) : null}
                  {item.orderId && (
                    <Text style={styles.txOrderIdLabelCompact}>ID: {item.orderId.substring(0, 10)}...</Text>
                  )}
                </View>

                {/* Middle Column: You Gave box (Dr) */}
                <View style={[styles.gaveColBox, { flex: 1 }]}>
                  {isDr ? (
                    <View style={styles.gaveBoxActive}>
                      <Text style={styles.gaveAmountText}>
                        ₹{formatCurrencyNoDecimals(item.amount)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.emptyBox} />
                  )}
                </View>

                {/* Right Column: You Got box (Cr) */}
                <View style={[styles.gotColBox, { flex: 1 }]}>
                  {!isDr ? (
                    <View style={styles.gotBoxActive}>
                      <Text style={styles.gotAmountText}>
                        ₹{formatCurrencyNoDecimals(item.amount)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.emptyBox} />
                  )}
                </View>
              </Pressable>
            </View>
          );
        }}
      />

      {/* Floating Bottom Action Bar */}
      <View style={styles.bottomActionBar}>
        <Pressable style={styles.bottomGiveBtn} onPress={openDrModal}>
          <Text style={styles.bottomBtnText}>YOU GAVE ₹</Text>
        </Pressable>
        <Pressable style={styles.bottomGetBtn} onPress={openCrModal}>
          <Text style={styles.bottomBtnText}>YOU GOT ₹</Text>
        </Pressable>
      </View>
      </>)}

      {/* ═══════════════════════════════════════════
         MODAL: YOU GAVE (Dr Form Entry)
      ═══════════════════════════════════════════ */}
      <Modal visible={isDrModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: colors.danger }]} />
                <Text style={[styles.modalTitle, { color: colors.danger }]}>You Gave (Credit Extended)</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsDrModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Pressable 
                onPress={() => setUseProductPicker(!useProductPicker)}
                style={styles.pickerToggleRow}
              >
                <Ionicons 
                  name={useProductPicker ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={useProductPicker ? colors.primary : colors.textMuted} 
                />
                <Text style={styles.pickerToggleText}>Select Products from Inventory</Text>
              </Pressable>

              {useProductPicker && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerSectionTitle}>Choose Product to Add</Text>
                  
                  <View style={styles.dropdownWrapper}>
                    <Picker
                      selectedValue=""
                      onValueChange={(val) => {
                        if (!val) return;
                        const p = products.find(prod => prod._id === val);
                        if (p) {
                          setSelectedProducts(prev => {
                            const existing = prev.find(item => item.product._id === p._id);
                            if (existing) {
                              return prev;
                            }
                            return [...prev, { product: p, qty: '', price: p.price }];
                          });
                        }
                      }}
                      style={styles.pickerDropdown}
                    >
                      <Picker.Item label="➕ Choose a product..." value="" enabled={false} />
                      {availableProductsForPicker.map(p => (
                        <Picker.Item 
                          key={p._id} 
                          label={`${p.name} ${p.sku ? `(${p.sku})` : ''} — ₹${p.price}`} 
                          value={p._id} 
                        />
                      ))}
                    </Picker>
                  </View>

                  {selectedProducts.length > 0 ? (
                    <View style={styles.selectedItemsList}>
                      <Text style={styles.selectedTitle}>Selected Items:</Text>
                      {selectedProducts.map(({ product, qty, price }) => (
                        <View key={product._id} style={styles.selectedItemCard}>
                          <Text style={styles.selectedItemName} numberOfLines={1}>
                            {product.name} {product.sku ? `(${product.sku})` : ''}
                          </Text>
                          <View style={styles.selectedItemControls}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
                              <Text style={{ fontSize: 13, color: colors.textMuted }}>₹</Text>
                              <TextInput
                                keyboardType="numeric"
                                value={price !== undefined ? String(price) : String(product.price)}
                                onChangeText={(text) => {
                                  const raw = text.replace(/[^0-9.]/g, '');
                                  const parts = raw.split('.');
                                  if (parts.length > 2) return;
                                  if (parts[1] && parts[1].length > 2) return;
                                  const val = parseFloat(raw) || 0;
                                  if (val > 99999999) return;
                                  setSelectedProducts(prev => {
                                    const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                    syncAmountFromSelectedProducts(next);
                                    return next;
                                  });
                                }}
                                style={{
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  borderRadius: 4,
                                  width: 55,
                                  height: 32,
                                  textAlign: 'center',
                                  fontSize: 13,
                                  color: colors.text,
                                  backgroundColor: colors.card,
                                  padding: 0,
                                  marginHorizontal: 4,
                                }}
                              />
                              <Text style={{ fontSize: 13, color: colors.textMuted }}>×</Text>
                            </View>
                             <TextInput
                               keyboardType="numeric"
                               value={qty && qty !== 0 && qty !== '0' ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\D/g, '');
                                 const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseInt(raw, 10) || 0);
                                 setSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   syncAmountFromSelectedProducts(next);
                                   return next;
                                 });
                               }}
                               style={styles.qtyInput}
                             />
                             <Pressable 
                               onPress={() => {
                                setSelectedProducts(prev => {
                                  const next = prev.filter(item => item.product._id !== product._id);
                                  syncAmountFromSelectedProducts(next);
                                  return next;
                                });
                              }}
                               style={styles.removeBtn}
                             >
                               <Ionicons name="trash-outline" size={16} color={colors.danger} />
                             </Pressable>
                           </View>
                         </View>
                       ))}
                      {calculateSelectedProductsTotal(selectedProducts) > 0 ? (
                        <Text style={[styles.calculatedTotal, { color: colors.danger }]}>
                          Total: ₹{formatCurrencyNoDecimals(calculateSelectedProductsTotal(selectedProducts))}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.noSelectedText}>No products selected yet. Search above.</Text>
                  )}
                </View>
              )}

              <Text style={styles.formLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                placeholder="Enter amount (editable even with products)"
                value={amount}
                onChangeText={handleAmountChange}
                autoFocus={!useProductPicker}
              />

              <Text style={styles.formLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Manual sales dispatch, custom charge extension, etc."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.danger }, submitting && styles.disabledBtn]}
                onPress={() => handleAddTransaction('dr')}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm You Gave</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      {/* ═══════════════════════════════════════════
         MODAL: YOU GOT (Cr Form Entry)
      ═══════════════════════════════════════════ */}
      <Modal visible={isCrModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.modalTitle, { color: colors.success }]}>You Got (Payment Received)</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsCrModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Pressable 
                onPress={() => setUseProductPicker(!useProductPicker)}
                style={styles.pickerToggleRow}
              >
                <Ionicons 
                  name={useProductPicker ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={useProductPicker ? colors.primary : colors.textMuted} 
                />
                <Text style={styles.pickerToggleText}>Select Products from Inventory</Text>
              </Pressable>

              {useProductPicker && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerSectionTitle}>Choose Product to Add</Text>
                  
                  <View style={styles.dropdownWrapper}>
                    <Picker
                      selectedValue=""
                      onValueChange={(val) => {
                        if (!val) return;
                        const p = products.find(prod => prod._id === val);
                        if (p) {
                          setSelectedProducts(prev => {
                            const existing = prev.find(item => item.product._id === p._id);
                            if (existing) {
                              return prev;
                            }
                            return [...prev, { product: p, qty: '', price: p.price }];
                          });
                        }
                      }}
                      style={styles.pickerDropdown}
                    >
                      <Picker.Item label="➕ Choose a product..." value="" enabled={false} />
                      {availableProductsForPicker.map(p => (
                        <Picker.Item 
                          key={p._id} 
                          label={`${p.name} ${p.sku ? `(${p.sku})` : ''} — ₹${p.price}`} 
                          value={p._id} 
                        />
                      ))}
                    </Picker>
                  </View>

                  {selectedProducts.length > 0 ? (
                    <View style={styles.selectedItemsList}>
                      <Text style={styles.selectedTitle}>Selected Items:</Text>
                      {selectedProducts.map(({ product, qty }) => (
                        <View key={product._id} style={styles.selectedItemCard}>
                          <Text style={styles.selectedItemName} numberOfLines={1}>
                            {product.name} {product.sku ? `(${product.sku})` : ''}
                          </Text>
                          <View style={styles.selectedItemControls}>
                            {hasEnteredQty(qty) ? <Text style={styles.selectedItemPrice}>₹{product.price} ×</Text> : null}
                            <TextInput
                              keyboardType="numeric"
                              value={qty && qty !== 0 && qty !== '0' ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\D/g, '');
                                 const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseInt(raw, 10) || 0);
                                setSelectedProducts(prev => {
                                  const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                  syncAmountFromSelectedProducts(next);
                                  return next;
                                });
                              }}
                              style={styles.qtyInput}
                            />
                            <Pressable 
                              onPress={() => {
                                setSelectedProducts(prev => {
                                  const next = prev.filter(item => item.product._id !== product._id);
                                  syncAmountFromSelectedProducts(next);
                                  return next;
                                });
                              }}
                              style={styles.removeBtn}
                            >
                              <Ionicons name="trash-outline" size={16} color={colors.danger} />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      {calculateSelectedProductsTotal(selectedProducts) > 0 ? (
                        <Text style={[styles.calculatedTotal, { color: colors.success }]}>
                          Total: ₹{formatCurrencyNoDecimals(calculateSelectedProductsTotal(selectedProducts))}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.noSelectedText}>No products selected yet. Search above.</Text>
                  )}
                </View>
              )}

              <Text style={styles.formLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                placeholder="Enter amount (editable even with products)"
                value={amount}
                onChangeText={handleAmountChange}
                autoFocus={!useProductPicker}
              />

              <Text style={styles.formLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Received GPay payment, cash advance, bank transfer..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.success }, submitting && styles.disabledBtn]}
                onPress={() => handleAddTransaction('cr')}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm You Got</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      {/* ═══════════════════════════════════════════
         MODAL: COLLECTION REMINDER SCHEDULER
      ═══════════════════════════════════════════ */}
      <Modal visible={isReminderModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="alarm-outline" size={24} color="#fbbf24" style={{ marginRight: 8 }} />
                  <Text style={[styles.modalTitle, { color: '#fbbf24' }]}>
                    {activeReminder ? 'Edit Collection Reminder' : 'Set Collection Reminder'}
                  </Text>
                </View>
                <Pressable style={styles.modalCloseBtn} onPress={() => setIsReminderModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody}>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 15, lineHeight: 18 }}>
                  Schedule a local notification reminder on this device. The system will alert you even if the app is closed or running in the background.
                </Text>

                {/* Date Selection Trigger */}
                <Text style={styles.formLabel}>Reminder Date *</Text>
                <Pressable 
                  style={styles.dateTimeSelectBox}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                  <Text style={styles.dateTimeSelectText}>
                    {reminderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </Pressable>

                {/* Time Selection Trigger */}
                <Text style={styles.formLabel}>Reminder Time *</Text>
                <Pressable 
                  style={styles.dateTimeSelectBox}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                  <Text style={styles.dateTimeSelectText}>
                    {formatTimeOnly(reminderTime)}
                  </Text>
                </Pressable>

                {/* Inline DateTimePicker components for Android / iOS */}
                {showDatePicker && (
                  <DateTimePicker
                    value={reminderDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date(new Date().setHours(0,0,0,0))}
                    onValueChange={onChangeDate}
                    onDismiss={() => setShowDatePicker(false)}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={reminderTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={onChangeTime}
                    onDismiss={() => setShowTimePicker(false)}
                  />
                )}

                {/* Custom Alarm Song Selection */}
                <Text style={styles.formLabel}>Notification Alarm Sound *</Text>
                <View style={styles.songSelectionContainer}>
                  <View style={styles.songPickerWrapper}>
                    <Picker
                      selectedValue={selectedSong}
                      onValueChange={(val) => {
                        setSelectedSong(val);
                        playSoundPreview(val); // Autoplay 5 second preview when chosen
                      }}
                      style={styles.songPicker}
                    >
                      {REMINDER_SONGS.map(song => (
                        <Picker.Item key={song.id} label={song.name} value={song.id} color="#0f172a" />
                      ))}
                    </Picker>
                  </View>
                  
                  <Pressable 
                    style={[styles.playPreviewBtn, isPreviewPlaying && styles.playingBtn]} 
                    onPress={() => isPreviewPlaying ? stopAnySound() : playSoundPreview(selectedSong)}
                  >
                    <Ionicons 
                      name={isPreviewPlaying ? "stop" : "play"} 
                      size={18} 
                      color="#0f52ba" 
                    />
                    <Text style={styles.playPreviewText}>
                      {isPreviewPlaying ? "Stop (5s)" : "Preview"}
                    </Text>
                  </Pressable>
                </View>

                {/* Custom Description Text Input */}
                <Text style={styles.formLabel}>Notification Description *</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  placeholder="Enter reminder description..."
                  value={reminderDescription}
                  onChangeText={setReminderDescription}
                  multiline
                  numberOfLines={4}
                />

                <Pressable
                  style={[styles.confirmBtn, { backgroundColor: '#fbbf24' }, reminderSubmitting && styles.disabledBtn]}
                  onPress={handleScheduleReminder}
                  disabled={reminderSubmitting}
                >
                  {reminderSubmitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={[styles.confirmBtnText, { color: '#000', fontWeight: '800' }]}>
                      {activeReminder ? 'Update & Schedule' : 'Schedule Reminder'}
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════
         MODAL: PREMIUM UPI QR OVERLAY MODAL
      ═══════════════════════════════════════════ */}
      <Modal visible={isQrModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, styles.darkQrModal]}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>💳 UPI QR Statement Overlay</Text>
              <Pressable style={styles.qrCloseBtn} onPress={() => setIsQrModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.qrModalBody}>
              {/* Payment bank selection */}
              {paymentSettings.length > 0 ? (
                <View style={styles.qrFormGroup}>
                  <Text style={styles.qrFormLabel}>Select Payee Bank Account / UPI</Text>
                  <View style={styles.qrPickerWrapper}>
                    <Picker
                      selectedValue={selectedPaymentSetting ? selectedPaymentSetting._id : ''}
                      onValueChange={(val) => {
                        const set = paymentSettings.find(p => p._id === val);
                        setSelectedPaymentSetting(set);
                      }}
                      style={styles.qrPicker}
                      dropdownIconColor="#fff"
                    >
                      {paymentSettings.map(setting => (
                        <Picker.Item key={setting._id} label={`${setting.name} (${setting.type === 'bank' ? 'Bank AC' : 'UPI QR'})`} value={setting._id} color={Platform.OS === 'android' ? '#000' : '#fff'} />
                      ))}
                    </Picker>
                  </View>
                </View>
              ) : null}

              {/* Dynamic QR Input amount */}
              <View style={styles.qrFormGroup}>
                <Text style={styles.qrFormLabel}>Payment Amount (₹)</Text>
                <TextInput
                  style={styles.qrInput}
                  keyboardType="numeric"
                  placeholder={Math.abs(netBal).toFixed(2)}
                  placeholderTextColor="#64748b"
                  value={customQrAmount}
                  onChangeText={handleQrAmountChange}
                />
                <Text style={styles.qrSubtext}>Defaults to current outstanding ledger balance.</Text>
              </View>

              {/* Image QR Block */}
              <View style={styles.qrBox}>
                {selectedPaymentSetting && selectedPaymentSetting.qrCode ? (
                  // Custom saved system image QR
                  <View style={styles.qrInnerBlock}>
                    <Image
                      source={{ uri: selectedPaymentSetting.qrCode }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrInnerTitle}>{selectedPaymentSetting.name}</Text>
                    <Text style={styles.qrInnerLabel}>Scan saved QR image code to pay.</Text>
                  </View>
                ) : (
                  // Dynamic API generated canvas QR
                  <View style={styles.qrInnerBlock}>
                    <Image
                      source={{ uri: upiQrApiUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrInnerTitle}>₹{finalPaymentAmount}</Text>
                    <Text style={styles.qrInnerLabelUpi}>Payee: KSK VASU & Co (kskvasuco@oksbi)</Text>
                    <Text style={styles.qrPayMethods}>Scan QR with PhonePe / GPay / Paytm</Text>
                  </View>
                )}
              </View>

              {/* Bank AC text details for Bank type settings */}
              {selectedPaymentSetting && selectedPaymentSetting.type === 'bank' ? (
                <View style={styles.bankDetailBox}>
                  <Text style={styles.bankLabelHeader}>BANK ACCOUNT TRANSFER DETAILS</Text>
                  <Text style={styles.bankNameText}>{selectedPaymentSetting.bankName || selectedPaymentSetting.name}</Text>
                  <View style={styles.bankItems}>
                    <Text style={styles.bankItemText}>AC Name: {selectedPaymentSetting.accountName || 'N/A'}</Text>
                    <Text style={styles.bankItemText}>AC No:   {selectedPaymentSetting.accountNumber}</Text>
                    <Text style={styles.bankItemText}>IFSC:    {selectedPaymentSetting.ifsc}</Text>
                  </View>
                </View>
              ) : null}

              <Pressable
                style={styles.qrCloseActionBtn}
                onPress={() => setIsQrModalVisible(false)}
              >
                <Text style={styles.qrCloseActionText}>Done / Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      {/* ═══════════════════════════════════════════
         MODAL: EDIT USER PROFILE
      ═══════════════════════════════════════════ */}
      <Modal visible={isEditProfileVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: '#0f52ba' }]} />
                <Text style={[styles.modalTitle, { color: '#0f52ba' }]}>Edit Profile</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsEditProfileVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.formLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full name"
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>Mobile *</Text>
              <TextInput
                style={styles.formInput}
                value={editMobile}
                onChangeText={v => setEditMobile(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                keyboardType="numeric"
                maxLength={10}
              />

              <Text style={styles.formLabel}>Email</Text>
              <TextInput
                style={styles.formInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Alt Mobile</Text>
              <TextInput
                style={styles.formInput}
                value={editAltMobile}
                onChangeText={v => setEditAltMobile(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="Alternative mobile number"
                keyboardType="numeric"
                maxLength={10}
              />

              <Text style={styles.formLabel}>Pincode</Text>
              <TextInput
                style={styles.formInput}
                value={editPincode}
                onChangeText={v => setEditPincode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit pincode"
                keyboardType="numeric"
                maxLength={6}
              />

              <Text style={styles.formLabel}>Opening Balance (₹)</Text>
              <TextInput
                style={styles.formInput}
                value={editOpeningBalance}
                onChangeText={v => setEditOpeningBalance(v.replace(/[^\d.]/g, ''))}
                placeholder="Opening Balance"
                keyboardType="numeric"
              />

              <Text style={styles.formLabel}>Address</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Full address"
                multiline
                numberOfLines={3}
              />

              {/* Convert Account Type */}
              <View style={styles.convertSection}>
                <Text style={styles.convertSectionLabel}>ACCOUNT TYPE</Text>
                <Pressable
                  style={[styles.convertBtn, {
                    backgroundColor: (customer?.ledgerType || '').toLowerCase() === 'supplier' ? '#059669' : '#4f46e5'
                  }]}
                  onPress={handleSwitchLedgerType}
                >
                  <Ionicons name="swap-horizontal" size={16} color="#fff" />
                  <Text style={styles.convertBtnText}>
                    Convert to {(customer?.ledgerType || '').toLowerCase() === 'supplier' ? 'Customer' : 'Supplier'}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: '#0f52ba' }, editSubmitting && styles.disabledBtn]}
                onPress={handleSaveProfile}
                disabled={editSubmitting}
              >
                {editSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>💾 Save Profile</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: '#d97706', marginTop: 12 }, editSubmitting && styles.disabledBtn]}
                onPress={handleClearStatements}
                disabled={editSubmitting}
              >
                <Text style={styles.confirmBtnText}>🧹 Clear All Statements</Text>
              </Pressable>

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.danger, marginTop: 12 }, editSubmitting && styles.disabledBtn]}
                onPress={handleRemoveUserFromLedger}
                disabled={editSubmitting}
              >
                <Text style={styles.confirmBtnText}>🗑️ Delete User from Ledger</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* ═══════════════════════════════════════════
       MODAL: CLOSE BALANCE & RECONCILE
    ═══════════════════════════════════════════ */}
    <Modal visible={isCloseBalanceVisible} animationType="fade" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: colors.danger }]} />
                <Text style={[styles.modalTitle, { color: colors.danger }]}>Close Balance</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsCloseBalanceVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 15, lineHeight: 18 }}>
                Select a date range to reconcile and carry forward. Transactions in this range will be closed, locked, and their net value carried into the Opening Balance.
              </Text>

              <Text style={styles.formLabel}>From Date *</Text>
              <Pressable 
                style={[styles.formInput, { justifyContent: 'center', minHeight: 45 }]}
                onPress={() => setShowCloseFromPicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {closeFromDate.toISOString().split('T')[0]}
                </Text>
              </Pressable>

              <Text style={styles.formLabel}>To Date *</Text>
              <Pressable 
                style={[styles.formInput, { justifyContent: 'center', minHeight: 45 }]}
                onPress={() => setShowCloseToPicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {closeToDate.toISOString().split('T')[0]}
                </Text>
              </Pressable>

              {showCloseFromPicker && (
                <DateTimePicker
                  value={closeFromDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowCloseFromPicker(false);
                    if (date) setCloseFromDate(date);
                  }}
                />
              )}

              {showCloseToPicker && (
                <DateTimePicker
                  value={closeToDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowCloseToPicker(false);
                    if (date) setCloseToDate(date);
                  }}
                />
              )}

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.danger, marginTop: 15 }, closeSubmitting && styles.disabledBtn]}
                onPress={handleCloseBalance}
                disabled={closeSubmitting}
              >
                {closeSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>🔒 Close Balance</Text>
                )}
              </Pressable>

              {closeBalanceHistory.length > 0 && (
                <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 }}>
                  <Text style={[styles.formLabel, { marginBottom: 8 }]}>Recent Close Balances</Text>
                  {closeBalanceHistory.map((rec) => (
                    <View key={rec._id} style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                        {formatDateOnly(rec.fromDate)} to {formatDateOnly(rec.toDate)} • {rec.closedCount || 0} txns
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Status: {rec.status}</Text>
                      {rec.status === 'active' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <Pressable
                            style={[styles.confirmBtn, { backgroundColor: '#475569', flex: 1, marginTop: 0, marginBottom: 0, paddingVertical: 10 }]}
                            disabled={closeSubmitting}
                            onPress={() => handleRevertCloseBalance(rec._id)}
                          >
                            <Text style={[styles.confirmBtnText, { fontSize: 12 }]}>Revert</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.confirmBtn, { backgroundColor: colors.danger, flex: 1, marginTop: 0, marginBottom: 0, paddingVertical: 10 }]}
                            disabled={closeSubmitting}
                            onPress={() => handleDeleteCloseBalance(rec._id)}
                          >
                            <Text style={[styles.confirmBtnText, { fontSize: 12 }]}>Delete</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* ═══════════════════════════════════════════
       MODAL: SELECT REPORT DATE RANGE
    ═══════════════════════════════════════════ */}
    <Modal visible={isReportModalVisible} animationType="fade" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.modalTitle, { color: colors.primary }]}>Select Date Range</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 15, lineHeight: 18 }}>
                Choose a start and end date to generate a scoped statement report for this user.
              </Text>

              <Text style={styles.formLabel}>Start Date *</Text>
              <Pressable 
                style={[styles.formInput, { justifyContent: 'center', minHeight: 45 }]}
                onPress={() => setShowReportFromPicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {reportFromDate.toISOString().split('T')[0]}
                </Text>
              </Pressable>

              <Text style={styles.formLabel}>End Date *</Text>
              <Pressable 
                style={[styles.formInput, { justifyContent: 'center', minHeight: 45 }]}
                onPress={() => setShowReportToPicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {reportToDate.toISOString().split('T')[0]}
                </Text>
              </Pressable>

              {showReportFromPicker && (
                <DateTimePicker
                  value={reportFromDate}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    setShowReportFromPicker(false);
                    if (date) setReportFromDate(date);
                  }}
                />
              )}

              {showReportToPicker && (
                <DateTimePicker
                  value={reportToDate}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    setShowReportToPicker(false);
                    if (date) setReportToDate(date);
                  }}
                />
              )}

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.primary, marginTop: 15 }]}
                onPress={handleGenerateReport}
              >
                <Text style={styles.confirmBtnText}>💾 Generate Report</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      {/* ═══════════════════════════════════════════
         MODAL: EDIT TRANSACTION
      ═══════════════════════════════════════════ */}
      <Modal visible={isEditTxVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: '#0f52ba' }]} />
                <Text style={[styles.modalTitle, { color: '#0f52ba' }]}>Edit Transaction</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => {
                setIsEditTxVisible(false);
                setEditSelectedProducts([]);
                setEditUseProductPicker(false);
              }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {editTx && (
                <View style={[styles.editTxTypeBadge, {
                  backgroundColor: editTx.type === 'dr' ? '#fdf2f2' : '#ecfdf5'
                }]}>
                  <Text style={[styles.editTxTypeText, {
                    color: editTx.type === 'dr' ? colors.danger : colors.success
                  }]}>
                    {editTx.type === 'dr' ? '🔴 You Gave (Dr)' : '🟢 You Got (Cr)'}
                  </Text>
                </View>
              )}

              {/* Product picker toggle + editor (amount stays independently editable) */}
              <Pressable 
                onPress={() => setEditUseProductPicker(!editUseProductPicker)}
                style={styles.pickerToggleRow}
              >
                <Ionicons 
                  name={editUseProductPicker ? "checkbox" : "square-outline"} 
                  size={18} 
                  color={editUseProductPicker ? colors.primary : colors.textMuted} 
                />
                <Text style={styles.pickerToggleText}>Select Products from Inventory</Text>
              </Pressable>

              {editUseProductPicker && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerSectionTitle}>Edit Product Items</Text>
                  
                  <View style={styles.dropdownWrapper}>
                     <Picker
                       selectedValue=""
                       onValueChange={(val) => {
                         if (!val) return;
                         const p = products.find(prod => prod._id === val);
                         if (p) {
                           setEditSelectedProducts(prev => {
                             const existing = prev.find(item => item.product._id === p._id);
                             let next;
                             if (existing) {
                               next = prev.map(item => item.product._id === p._id ? { ...item, qty: item.qty + 1 } : item);
                             } else {
                               next = [...prev, { product: p, qty: '', price: p.price }];  // start empty
                             }
                             const total = next.reduce((sum, it) => sum + ((it.product.price || 0) * (parseInt(it.qty) || 0)), 0);
                             setEditTxAmount(String(Math.round(total)));
                             return next;
                           });
                         }
                       }}
                       style={styles.pickerDropdown}
                     >
                       <Picker.Item label="➕ Choose a product..." value="" enabled={false} />
                       {products
                         .filter(p => !editSelectedProducts.some(item => item.product._id === p._id))
                         .map(p => (
                           <Picker.Item 
                             key={p._id} 
                             label={`${p.name} ${p.sku ? `(${p.sku})` : ''} — ₹${p.price}`} 
                             value={p._id} 
                           />
                         ))}
                     </Picker>
                  </View>

                  {editSelectedProducts.length > 0 ? (
                    <View style={styles.selectedItemsList}>
                      <Text style={styles.selectedTitle}>Current Items:</Text>
                      {editSelectedProducts.map(({ product, qty, price }) => (
                        <View key={product._id} style={styles.selectedItemCard}>
                          <Text style={styles.selectedItemName} numberOfLines={1}>
                            {product.name} {product.sku ? `(${product.sku})` : ''}
                          </Text>
                          <View style={styles.selectedItemControls}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
                              <Text style={{ fontSize: 13, color: colors.textMuted }}>₹</Text>
                              <TextInput
                                keyboardType="numeric"
                                value={price !== undefined ? String(price) : String(product.price)}
                                onChangeText={(text) => {
                                  const raw = text.replace(/[^0-9.]/g, '');
                                  const parts = raw.split('.');
                                  if (parts.length > 2) return;
                                  if (parts[1] && parts[1].length > 2) return;
                                  const val = parseFloat(raw) || 0;
                                  if (val > 99999999) return;
                                  setEditSelectedProducts(prev => {
                                    const next = prev.map(item => item.product._id === product._id ? { ...item, price: val } : item);
                                    const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 0)), 0);
                                    setEditTxAmount(String(Math.round(total)));
                                    return next;
                                  });
                                }}
                                style={{
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  borderRadius: 4,
                                  width: 55,
                                  height: 32,
                                  textAlign: 'center',
                                  fontSize: 13,
                                  color: colors.text,
                                  backgroundColor: colors.card,
                                  padding: 0,
                                  marginHorizontal: 4,
                                }}
                              />
                              <Text style={{ fontSize: 13, color: colors.textMuted }}>×</Text>
                            </View>
                             <TextInput
                               keyboardType="numeric"
                               value={qty && qty !== 0 && qty !== '0' ? String(qty) : ''}
                               onChangeText={(text) => {
                                 const raw = text.replace(/\D/g, '');
                                 const val = (raw === '' || raw === '0') ? '' : Math.min(999999, parseInt(raw, 10) || 0);
                                 setEditSelectedProducts(prev => {
                                   const next = prev.map(item => item.product._id === product._id ? { ...item, qty: val } : item);
                                   const total = next.reduce((sum, it) => sum + ((it.price !== undefined ? it.price : (it.product.price || 0)) * (parseInt(it.qty) || 0)), 0);
                                   setEditTxAmount(String(Math.round(total)));
                                   return next;
                                 });
                               }}
                               style={styles.qtyInput}
                             />
                             <Pressable 
                               onPress={() => {
                                 setEditSelectedProducts(prev => {
                                   const next = prev.filter(item => item.product._id !== product._id);
                                   const total = next.reduce((sum, it) => sum + ((it.product.price || 0) * (parseInt(it.qty) || 0)), 0);
                                   setEditTxAmount(String(Math.round(total)));
                                   return next;
                                 });
                               }}
                               style={styles.removeBtn}
                             >
                              <Ionicons name="trash-outline" size={14} color={colors.danger} />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                       <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary, textAlign: 'right', marginTop: 4 }}>
                         Items total: ₹{editSelectedProducts.reduce((sum, {product, qty, price}) => sum + ((price !== undefined ? price : product.price) * (parseInt(qty) || 1)), 0)}
                       </Text>
                    </View>
                  ) : (
                    <Text style={styles.noSelectedText}>No products — pick above to itemize.</Text>
                  )}
                </View>
              )}

              <Text style={styles.formLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={editTxAmount}
                onChangeText={v => {
                  const s = v.replace(/[^0-9.]/g, '');
                  const parts = s.split('.');
                  if (parts.length > 2) return;
                  if (parts[1] && parts[1].length > 2) return;
                  setEditTxAmount(s);
                }}
                placeholder="Enter amount"
                autoFocus
              />

              <Text style={styles.formLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                value={editTxDescription}
                onChangeText={setEditTxDescription}
                placeholder="Enter description"
                multiline
                numberOfLines={3}
              />

              {editTx?.deleteRequest?.status === 'pending' ? (
                <>
                  <View style={{ backgroundColor: '#fffbeb', borderLeftWidth: 4, borderColor: '#d97706', padding: 12, borderRadius: 8, marginBottom: 15 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#b45309' }}>⏳ Deletion Request Pending</Text>
                    <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                      Requested by: {editTx.deleteRequest.requestedBy || 'Staff'}
                    </Text>
                  </View>

                  {isAdmin ? (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <Pressable
                        style={[styles.confirmBtn, { backgroundColor: colors.success, flex: 1, marginTop: 0 }]}
                        onPress={() => editTx && handleApproveDelete(editTx._id)}
                      >
                        <Text style={styles.confirmBtnText}>✅ Approve</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.confirmBtn, { backgroundColor: '#475569', flex: 1, marginTop: 0 }]}
                        onPress={() => editTx && handleRejectDelete(editTx._id)}
                      >
                        <Text style={styles.confirmBtnText}>❌ Reject</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={[styles.confirmBtn, { backgroundColor: colors.border }, styles.disabledBtn]}>
                      <Text style={[styles.confirmBtnText, { color: colors.textMuted }]}>🔒 Locked for Admin Review</Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.confirmBtn, { backgroundColor: '#0f52ba' }, editTxSubmitting && styles.disabledBtn]}
                    onPress={handleSaveTransaction}
                    disabled={editTxSubmitting}
                  >
                    {editTxSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.confirmBtnText}>💾 Save Changes</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.editTxDeleteBtn, editTxSubmitting && styles.disabledBtn]}
                    onPress={() => editTx && handleDeleteTransactionFromEdit(editTx._id)}
                    disabled={editTxSubmitting}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={styles.editTxDeleteBtnText}>🗑️ Delete Transaction</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dateTimeSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 15,
  },
  dateTimeSelectText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  songSelectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  songPickerWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    overflow: 'hidden',
    height: 48,
    justifyContent: 'center',
  },
  songPicker: {
    height: 48,
    color: colors.text,
  },
  playPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#0f52ba',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  playingBtn: {
    backgroundColor: '#e0f2fe',
  },
  playPreviewText: {
    color: '#0f52ba',
    fontSize: 12,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 0,
    paddingBottom: spacing.xl,
  },
  headerBlock: {
    marginBottom: spacing.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.background,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  fallbackBackBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    ...shadows.sm,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  profileMobile: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  locationCol: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  locationVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fafafa',
    padding: 8,
    borderRadius: 8,
    marginTop: spacing.xs,
  },
  addressIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  addressText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceLabelTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: spacing.xs,
  },
  balanceSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  bookingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  giveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingVertical: 12,
    borderRadius: 8,
    ...shadows.sm,
  },
  getBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.success,
    paddingVertical: 12,
    borderRadius: 8,
    ...shadows.sm,
  },
  bookingBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Utility actions row
  utilityGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  utilityBtnWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#25d366',
    paddingVertical: 10,
    borderRadius: 8,
    ...shadows.sm,
  },
  utilityBtnShare: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#475569',
    paddingVertical: 10,
    borderRadius: 8,
    ...shadows.sm,
  },
  utilityBtnQR: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    ...shadows.sm,
  },
  utilityBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  ledgerHistoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // List Empty History
  emptyHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  emptyHistoryText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },

  // Transaction Cards
  transactionItemCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  txDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  orderIdBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderIdBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  manualBadge: {
    backgroundColor: '#faf5ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  manualBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  txMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  descCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  txOrderIdLabel: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  runningBalLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  runningBalVal: {
    fontWeight: '700',
  },
  deleteTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  deleteTxText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '700',
  },

  // Native Modals General
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  centeredModalContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    maxHeight: '80%',
    ...shadows.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: spacing.md,
  },
  modalScroll: {
    maxHeight: '100%',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
    color: colors.text,
  },
  formTextarea: {
    height: 70,
    textAlignVertical: 'top',
  },
  confirmBtn: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.6,
  },

  // QR Modal Premium Black Theme
  darkQrModal: {
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qrModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38ef7d',
  },
  qrCloseBtn: {
    padding: 4,
  },
  qrModalBody: {
    padding: spacing.md,
  },
  qrFormGroup: {
    marginBottom: spacing.md,
  },
  qrFormLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
  },
  qrPickerWrapper: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    height: 40,
    justifyContent: 'center',
  },
  qrPicker: {
    color: '#fff',
    height: 40,
  },
  qrInput: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#1e293b',
    color: '#fff',
  },
  qrSubtext: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginVertical: spacing.sm,
  },
  qrInnerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 180,
    height: 180,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
  },
  qrInnerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: spacing.sm,
  },
  qrInnerLabel: {
    fontSize: 12,
    color: '#a7f3d0',
    marginTop: 2,
  },
  qrInnerLabelUpi: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
  qrPayMethods: {
    fontSize: 12,
    color: '#38ef7d',
    fontWeight: '700',
    marginTop: 6,
  },
  bankDetailBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  bankLabelHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  bankNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  bankItems: {
    marginTop: 6,
    gap: 2,
  },
  bankItemText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  qrCloseActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  qrCloseActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  switchTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: spacing.sm,
    backgroundColor: '#eff6ff',
  },
  switchTypeBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
    alignSelf: 'center',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  columnHeaders: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderBottomWidth: 2,
    borderColor: colors.border,
    paddingVertical: 8,
    marginTop: spacing.md,
    paddingHorizontal: 10,
  },
  colHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  transactionRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 90,
    alignItems: 'stretch',
  },
  entryDetailsCol: {
    padding: 10,
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  entryRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  txDateCompact: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  orderSyncText: {
    fontSize: 9,
    color: '#3b82f6',
    fontWeight: '700',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  manualText: {
    fontSize: 9,
    color: '#854d0e',
    fontWeight: '700',
    backgroundColor: '#fef9c3',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  txDescCompact: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginVertical: 2,
  },
  txOrderIdLabelCompact: {
    fontSize: 9,
    color: colors.textMuted,
  },
  entryRowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  runningBalLabelCompact: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  runningBalValCompact: {
    fontWeight: '700',
  },
  deleteTxIconBtn: {
    padding: 4,
  },
  editTxIconBtn: {
    padding: 4,
    backgroundColor: 'rgba(15,82,186,0.08)',
    borderRadius: 6,
    marginLeft: 4,
  },
  convertSection: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderStyle: 'dashed',
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  convertSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  convertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  convertBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  editTxTypeBadge: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  editTxTypeText: {
    fontWeight: '800',
    fontSize: 13,
  },
  editTxDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  editTxDeleteBtnText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  gaveColBox: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  gaveBoxActive: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.lightRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  gaveAmountText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  gotColBox: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  gotBoxActive: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  gotAmountText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBox: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    ...shadows.md,
  },
  bottomGiveBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGetBtn: {
    flex: 1,
    backgroundColor: colors.success,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  blueHeader: {
    backgroundColor: '#0f52ba',
    paddingTop: Platform.OS === 'ios' ? 66 : (StatusBar.currentHeight ?? 28) + 24,
    paddingBottom: 24,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 12,
  },
  headerAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    color: '#0f52ba',
    fontWeight: '800',
    fontSize: 13,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerNameText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  headerSubLink: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  callIconBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  detailsKpiCard: {
    padding: spacing.md,
    marginHorizontal: 0,
    marginTop: 0,
    borderWidth: 0,
  },
  kpiMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiTitleText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  kpiValueText: {
    fontSize: 20,
    fontWeight: '800',
  },
  kpiDividerLine: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  kpiBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiBottomText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  kpiAddLink: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  actionTabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  actionTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionTabLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  quickCashBanner: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTextCol: {
    flex: 1,
    marginRight: 10,
  },
  bannerBadgeText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bannerMainText: {
    fontSize: 12,
    color: '#451a03',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 6,
  },
  bannerCheckBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  bannerCheckBtnText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  bannerAvatarCol: {
    padding: 6,
  },
  sectionHeaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    width: '100%',
  },
  sectionHeaderBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...shadows.sm,
  },
  sectionHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  runningBalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  runningBalBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  pickerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  pickerToggleText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  pickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
  },
  pickerSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  pickerSearchInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    marginBottom: 8,
  },
  suggestionsContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    maxHeight: 120,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  suggestionPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  selectedItemsList: {
    marginBottom: 8,
  },
  selectedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  selectedItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  selectedItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginRight: 8,
  },
  selectedItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedItemPrice: {
    fontSize: 12,
    color: '#64748b',
    marginRight: 6,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    width: 24,
    textAlign: 'center',
  },
  removeBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  calculatedTotal: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  noSelectedText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  disabledInput: {
    backgroundColor: '#e2e8f0',
    color: '#64748b',
  },
   skuBadge: {
     alignSelf: 'flex-start',
     backgroundColor: '#e0f2fe',
     borderRadius: 4,
     paddingHorizontal: 6,
     paddingVertical: 2,
     marginTop: 8,
     borderWidth: 1,
     borderColor: '#bae6fd',
   },
  skuBadgeText: {
    color: '#0369a1',
    fontSize: 10,
    fontWeight: '600',
  },
  dropdownWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  pickerDropdown: {
    height: 50,
    width: '100%',
    color: '#334155',
  },
  qtyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,
    width: 45,
    height: 30,
    textAlign: 'center',
    fontSize: 13,
    color: colors.text,
    padding: 0,
  },
});
