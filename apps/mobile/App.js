import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, View, StyleSheet } from 'react-native';
import {
  useFonts,
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  PublicSans_800ExtraBold,
} from '@expo-google-fonts/public-sans';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { LocketMark } from './src/components/LocketMark';

function ThemedApp() {
  const { t, dark } = useTheme();
  const [isObscured, setIsObscured] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Obscure on 'inactive' (iOS app switcher/notification center) or 'background'
      setIsObscured(nextAppState === 'inactive' || nextAppState === 'background');
    });
    return () => subscription.remove();
  }, []);

  return (
    <>
      <AppNavigator />
      <StatusBar style={dark ? 'light' : 'dark'} />
      {isObscured && (
        <View style={[styles.privacyShield, { backgroundColor: t.paper }]}>
          <LocketMark size={72} />
        </View>
      )}
    </>
  );
}

export default function App() {
  usePreventScreenCapture();
  const [fontsLoaded, fontError] = useFonts({
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    PublicSans_800ExtraBold,
  });

  // Hold rendering until Public Sans is ready — avoids a system-font flash.
  // On a load error, render anyway (system-font fallback beats a blank app).
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  privacyShield: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
});
