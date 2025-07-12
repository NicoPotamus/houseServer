import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { DeviceProvider, useDevice } from '../context/DeviceContext';
import DevicesScreen from './(tabs)/devices';
import AuthScreen from './auth';

// Only enable URL configuration in development
const isDev = process.env.NODE_ENV === 'development';

function MainLayout() {
  const { user, loading } = useAuth();
  const { device } = useDevice();
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Base URL setting is no longer needed since all file operations 
    // now use WebRTC instead of HTTP requests
    if (isDev) {
      console.log('Development mode: All file operations use WebRTC, no HTTP base URL needed');
      // Legacy HTTP base URL code removed - file operations now use WebRTC data channel
      // const devApiUrl = 'a5a5222e-4637-4383-bc7b-2514fc752d11.niconet.tech';
      // fileService.setBaseUrl(devApiUrl);
    }
  }, []);

  if (loading) return null;
  if (!user) return <AuthScreen />;
  if (!loaded) return null;
  if (!device) return <DevicesScreen />;
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <DeviceProvider>
        <MainLayout />
      </DeviceProvider>
    </AuthProvider>
  );
}
