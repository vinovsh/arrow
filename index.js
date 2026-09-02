/**
 * Arrow Escape — entry point.
 * react-native-gesture-handler must be the very first import in the bundle.
 */
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
