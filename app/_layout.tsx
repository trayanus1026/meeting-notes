import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setupNotifications, handleNotificationResponse } from '@/lib/notifications';
import { AuthProvider } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash as soon as the app has mounted (no custom fonts to wait for)
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    setupNotifications();
    const sub = handleNotificationResponse();
    return () => sub.remove();
  }, []);

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="meeting/[id]"
          options={{ headerShown: true, title: 'Meeting', headerBackTitle: 'Back' }}
        />
      </Stack>
    </AuthProvider>
  );
}
