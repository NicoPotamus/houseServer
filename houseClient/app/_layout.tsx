import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { DeviceProvider, useDevice } from '../context/DeviceContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fileService } from '../services/fileService';
import AuthScreen from './auth';
import DevicesScreen from './(tabs)/devices';

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
    if (isDev) {
      // You can change this URL during development
      const devApiUrl = 'a5a5222e-4637-4383-bc7b-2514fc752d11.niconet.tech'; // Replace with your local IP when needed
      fileService.setBaseUrl(devApiUrl);
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
