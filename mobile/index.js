import { LogBox } from 'react-native';

// Suppress noisy expo-notifications remote push warnings & DateTimePicker deprecation warnings globally
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'expo-notifications functionality is not fully supported in Expo Go',
  'DateTimePicker: `onChange` is deprecated',
]);

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
