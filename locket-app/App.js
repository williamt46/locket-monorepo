import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import LogDataScreen from './src/screens/LogDataScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <LogDataScreen />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
