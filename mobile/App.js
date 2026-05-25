import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { ThemeProvider } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';

// 5 Default royalty-free high-quality alarm sounds
const REMINDER_SONGS = {
  song1: require('./assets/sounds/song1.wav'),
  song2: require('./assets/sounds/song2.wav'),
  song3: require('./assets/sounds/song3.wav'),
  song4: require('./assets/sounds/song4.wav'),
  song5: require('./assets/sounds/song5.wav'),
};

// Configure foreground notifications behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    async function setupNotifications() {
      if (Platform.OS === 'android') {
        const songs = ['song1', 'song2', 'song3', 'song4', 'song5'];
        const songNames = {
          song1: 'Chime Harmony',
          song2: 'Bells Rhapsody',
          song3: 'Synth Wave',
          song4: 'Retro Pulse',
          song5: 'Classical Echo',
        };
        for (const s of songs) {
          await Notifications.setNotificationChannelAsync(`collection-reminders-${s}`, {
            name: `Collection Reminders (${songNames[s]})`,
            description: `Payment and collection reminder notifications playing ${songNames[s]}`,
            importance: Notifications.AndroidImportance.MAX,
            bypassDnd: true,
            lightColor: '#fbbf24',
            sound: `${s}.wav`,
            enableVibrate: true,
          });
        }
      }
    }
    setupNotifications();

    // Listen for incoming notifications when the app is active in the foreground
    const subscription = Notifications.addNotificationReceivedListener(async notification => {
      const { title, body, data } = notification.request.content;
      const songId = data?.selectedSong || 'song1';
      const songAsset = REMINDER_SONGS[songId];

      let soundInstance = null;
      if (songAsset) {
        try {
          // Play selected song
          const { sound } = await Audio.Sound.createAsync(
            songAsset,
            { shouldPlay: true }
          );
          soundInstance = sound;
          
          // Stop and unload after exactly 5 seconds
          setTimeout(async () => {
            if (soundInstance) {
              try {
                await soundInstance.stopAsync();
                await soundInstance.unloadAsync();
              } catch (err) {
                console.log('Failed to stop sound:', err);
              }
            }
          }, 5000);
        } catch (error) {
          console.log('Error playing foreground alarm sound:', error);
        }
      }

      // Render a stylized warning dialog displaying the customized description (plays notification sound)
      Alert.alert(
        title || '🔔 Collection Reminder Alert',
        body || 'A collection reminder has arrived.',
        [{ 
          text: 'Dismiss', 
          style: 'cancel',
          onPress: async () => {
            if (soundInstance) {
              try {
                await soundInstance.stopAsync();
                await soundInstance.unloadAsync();
              } catch (err) {
                console.log('Failed to dismiss sound:', err);
              }
            }
          }
        }],
        { cancelable: true }
      );
    });

    // Listen for notification tap / responses (tapped from background)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(async response => {
      const { data } = response.notification.request.content;
      const songId = data?.selectedSong || 'song1';
      const songAsset = REMINDER_SONGS[songId];

      if (songAsset) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            songAsset,
            { shouldPlay: true }
          );
          setTimeout(async () => {
            try {
              await sound.stopAsync();
              await sound.unloadAsync();
            } catch (err) {
              console.log('Failed to stop background-tapped sound:', err);
            }
          }, 5000);
        } catch (error) {
          console.log('Error playing tapped alarm sound:', error);
        }
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <RootNavigator />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

