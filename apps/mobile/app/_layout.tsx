import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/error-boundary';
import { AuthProvider } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LocationProvider } from '@/hooks/use-location';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '/(public)/auth/welcome',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      try {
        // Wait for fonts to load (or error)
        // In production builds, fonts should load quickly
        // Don't add artificial delay - hide splash as soon as ready
        if (loaded || error) {
          setAppIsReady(true);
        }
      } catch (e) {
        console.warn('Error preparing app:', e);
        setAppIsReady(true);
      }
    }

    prepare();
  }, [loaded, error]);

  useEffect(() => {
    if (appIsReady) {
      // Hide native splash screen once app is ready to render
      // This should happen before AuthProvider shows its loading state
      SplashScreen.hideAsync().catch((err) => {
        console.error('Error hiding splash screen:', err);
      });
    }
  }, [appIsReady]);

  // Don't render anything until ready - keep native splash visible
  if (!appIsReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <LocationProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Slot />
            <StatusBar style="auto" />
          </ThemeProvider>
        </LocationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
