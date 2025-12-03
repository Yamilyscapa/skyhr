import DebugMenu from '@/components/debug-menu';
import ThemedText from '@/components/themed-text';
import Button from '@/components/ui/button';
import ThemedView from '@/components/ui/themed-view';
import { TextSize } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const logoSource = require('@/assets/images/skyhr-logo.png');

export default function Welcome() {
  const { session, signOut, activeOrganization, organizations, isInitialized } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = useThemeColor({}, 'card');
  const neutralColor = useThemeColor({}, 'neutral');
  const textColor = useThemeColor({}, 'text');

  const user = session.data?.user ?? null;
  const userName = (user as Record<string, unknown>)?.name as string | undefined;
  const isAuthenticated = Boolean(user);
  const hasOrganization = Boolean(activeOrganization.data) || (organizations.data?.length ?? 0) > 0;

  // Handle routing when authenticated user lands on welcome
  useEffect(() => {
    if (!isInitialized) return;
    
    if (isAuthenticated) {
      if (hasOrganization) {
        router.replace('/(protected)/(tabs)');
      } else {
        router.replace('/(no-org)');
      }
    }
  }, [isAuthenticated, hasOrganization, isInitialized]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      // Try to sign out - this may fail due to circular reference issues in Better Auth
      await signOut();
    } catch (error) {
      // Sign out may fail due to circular reference issues in Better Auth's internal state
      // This is a known issue when Better Auth tries to serialize React Query state
      console.warn('Sign out error (non-critical, session will be cleared on next request):', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <DebugMenu screenName="Welcome" />
      <ThemedView>
        <View style={styles.hero}>
          <ThemedText style={styles.overline}>Bienvenido a</ThemedText>
          <Image source={logoSource} style={styles.logo} resizeMode="contain" accessibilityLabel="Sky HR" />
          <ThemedText style={styles.title}>Sky HR</ThemedText>
          <ThemedText style={styles.description}>
            Gestiona tu jornada desde un solo lugar.
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: cardColor, borderColor: neutralColor }]}>
          {isAuthenticated ? (
            <>
              <View style={styles.cardHeader}>
                <ThemedText style={styles.cardTitle}>
                  Hola{userName ? `, ${userName}` : ''}
                </ThemedText>
                <ThemedText style={[styles.cardSubtitle, { color: textColor }]}>
                  Ya tienes una sesión activa.
                </ThemedText>
              </View>
              <Button 
                onPress={() => {
                  if (hasOrganization) {
                    router.replace('/(protected)/(tabs)');
                  } else {
                    router.replace('/(no-org)');
                  }
                }}
              >
                Ir al inicio
              </Button>
              <Button
                type="secondary"
                onPress={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
              </Button>
            </>
          ) : (
            <>
              <ThemedText style={styles.cardTitle}>Comienza ahora</ThemedText>
              <ThemedText style={[styles.cardSubtitle, { color: textColor }]}>
                Bienvenido a Sky HR, elige cómo quieres continuar.
              </ThemedText>

              <Button onPress={() => router.push('/(public)/auth/sign-in')}>
                Iniciar sesión
              </Button>
              <Button
                type="secondary"
                onPress={() => router.push('/(public)/auth/sign-up')}
                style={styles.secondaryButton}
              >
                Crear cuenta
              </Button>
            </>
          )}
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  hero: {
    borderRadius: 24,
    padding: 24,
    gap: 8,
    marginBottom: 28,
    alignItems: 'center',
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 8,
  },
  overline: {
    fontSize: TextSize.p,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  title: {
    fontSize: TextSize.h1,
    fontWeight: '700',
  },
  description: {
    fontSize: TextSize.h5,
    lineHeight: 22,
    opacity: 0.8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  cardHeader: {
    gap: 4,
  },
  cardTitle: {
    fontSize: TextSize.h2,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: TextSize.p,
    lineHeight: 20,
    opacity: 0.8,
  },
  secondaryButton: {
    borderColor: 'transparent',
  },
});
