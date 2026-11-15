// In-memory AsyncStorage for tests (official mock shipped with the package).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);


// Gesture Handler's official test setup (charts use a pan gesture to scrub).
import 'react-native-gesture-handler/jestSetup';
