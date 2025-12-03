import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
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
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch((err) => {
        console.error('Error hiding splash screen:', err);
      });
    }
  }, [loaded]);

  useEffect(() => {
    if (error) {
      console.error('Error loading fonts:', error);
      // Fonts will fall back to system fonts, so we still allow the app to render
    }
  }, [error]);

  if (!loaded && !error) {
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
