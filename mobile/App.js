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
import RootNavigator from './src/navigation/RootNavigator';

// 5 Default royalty-free high-quality alarm sounds
const REMINDER_SONGS = {
  song1: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  song2: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  song3: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  song4: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  song5: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
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
        await Notifications.setNotificationChannelAsync('collection-reminders', {
          name: 'Collection Reminders',
          description: 'Payment and collection reminder notifications',
          importance: Notifications.AndroidImportance.MAX,
          bypassDnd: true,
          lightColor: '#fbbf24',
          sound: 'default', // Plays the default notification audio
          enableVibrate: false, // Disable vibration
          vibrationPattern: null,
        });
      }
    }
    setupNotifications();

    // Listen for incoming notifications when the app is active in the foreground
    const subscription = Notifications.addNotificationReceivedListener(async notification => {
      const { title, body, data } = notification.request.content;
      const songId = data?.selectedSong || 'song1';
      const songUrl = REMINDER_SONGS[songId];

      let soundInstance = null;
      if (songUrl) {
        try {
          // Play selected song
          const { sound } = await Audio.Sound.createAsync(
            { uri: songUrl },
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
      const songUrl = REMINDER_SONGS[songId];

      if (songUrl) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: songUrl },
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
        <AuthProvider>
          <CartProvider>
            <RootNavigator />
            <StatusBar style="auto" />
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

