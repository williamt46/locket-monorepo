import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, View, StyleSheet, Text } from 'react-native';
import { colors } from './src/theme/colors';

export default function App() {
  usePreventScreenCapture();
  const [isObscured, setIsObscured] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Obscure on 'inactive' (iOS app switcher/notification center) or 'background'
      setIsObscured(nextAppState === 'inactive' || nextAppState === 'background');
    });
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator />
        <StatusBar style="dark" />
        {isObscured && (
          <View style={styles.privacyShield}>
             <View style={styles.lockIcon} />
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  privacyShield: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  lockIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gold,
    opacity: 0.5,
  },
});
