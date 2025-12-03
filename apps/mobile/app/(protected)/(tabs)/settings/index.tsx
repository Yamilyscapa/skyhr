import ThemedText from "@/components/themed-text";
import Button from "@/components/ui/button";
import ThemedView from "@/components/ui/themed-view";
import { TextSize } from "@/constants/theme";
import { useActiveOrganization, useAuth, useOrganizations, useUser } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getUserFaceUrls } from "@/lib/user";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const registrationTips = [
  'Busca un lugar bien iluminado sin sombras fuertes en el rostro.',
  'Retira accesorios que cubran tu cara como gorras o lentes oscuros.',
  'Mantén la mirada al frente y alinéate con el óvalo del escáner.',
];

export default function SettingsScreen() {
  const user = useUser();
  const [organization, setOrganization] = useState<Record<string, unknown> | null>(null);
  const activeOrganization = useActiveOrganization();
  const organizations = useOrganizations();
  const { session, getFullOrganization, signOut } = useAuth();
  const router = useRouter();
  const refetchSession = session.refetch;
  const userId = session.data?.user?.id;

  const dividerColor = useThemeColor({}, 'neutral');
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');

  const faceUrls = getUserFaceUrls(user);
  const hasRegisteredFace = faceUrls.length > 0;

  useFocusEffect(
    useCallback(() => {
      refetchSession();
    }, [refetchSession])
  );

  const activeOrganizationId = (activeOrganization as Record<string, unknown> | null)?.id as string | undefined;

  useEffect(() => {
    let isMounted = true;

    async function fetchOrganization() {
      try {
        const response = await getFullOrganization();
        if (isMounted) {
          setOrganization(response?.data ?? null);
        }
      } catch (error) {
        console.error('Failed to load organization data', error);
        if (isMounted) {
          setOrganization(null);
        }
      }
    }

    if (!userId || !activeOrganizationId) {
      setOrganization(null);
      return () => {
        isMounted = false;
      };
    }

    fetchOrganization();

    return () => {
      isMounted = false;
    };
  }, [getFullOrganization, userId, activeOrganizationId]);

  const fallbackOrganization = (organizations?.[0] as Record<string, unknown>) ?? null;

  const organizationName =
    ((organization as Record<string, unknown>)?.name as string) ||
    ((activeOrganization as Record<string, unknown>)?.name as string) ||
    ((fallbackOrganization)?.name as string) ||
    'Sin nombre';

  const hasOrganization = Boolean(organization || activeOrganization || fallbackOrganization);

  useEffect(() => {
    if (!hasOrganization) {
      router.replace('/(no-org)');
    }
  }, [hasOrganization, router]);

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleRegisterPress = () => {
    if (hasRegisteredFace) return;
    router.push('/(protected)/settings/register-face');
  };

  const handleWatchModePress = () => {
    router.push('/(protected)/watch-mode');
  };

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
      // Always navigate to welcome screen regardless of signOut success/failure
      router.replace('/(public)/auth/welcome');
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView>
          <ThemedText style={styles.title}>Ajustes</ThemedText>
          <ThemedText style={styles.subtitle}>Controla la configuración de tu cuenta y tus datos biométricos.</ThemedText>

          <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
            <ThemedText style={styles.cardTitle}>Información de la cuenta</ThemedText>

            {hasOrganization && (
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: textColor }]}>Organización:</ThemedText>
                <ThemedText style={styles.infoValue}>{organizationName}</ThemedText>
              </View>
            )}

            {user && (
              <>
                <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textColor }]}>Nombre:</ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {(user as Record<string, unknown>)?.name as string || 'Sin nombre'}
                  </ThemedText>
                </View>

                {(user as Record<string, unknown>)?.email && (
                  <>
                    <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: textColor }]}>Email:</ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {(user as Record<string, unknown>)?.email as string}
                      </ThemedText>
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>Biometría facial</ThemedText>
              <View style={[styles.statusPill, { backgroundColor: hasRegisteredFace ? 'rgba(15, 157, 88, 0.1)' : 'rgba(245, 158, 11, 0.15)' }]}>
                <ThemedText style={[styles.statusText, { color: hasRegisteredFace ? '#0F9D58' : '#B45309' }]}>
                  {hasRegisteredFace ? 'Rostro registrado' : 'Pendiente de registro'}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.cardDescription}>
              Registra tu rostro para habilitar la verificación biométrica de tus asistencias.
            </ThemedText>

            {!hasRegisteredFace && (
              <>
                <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                <View style={styles.tips}>
                  <ThemedText style={styles.tipsTitle}>Recomendaciones</ThemedText>
                  {registrationTips.map((tip) => (
                    <View key={tip} style={styles.tipRow}>
                      <View style={styles.bullet} />
                      <ThemedText style={[styles.tipText, { color: textColor }]}>{tip}</ThemedText>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Button onPress={handleRegisterPress} disabled={hasRegisteredFace}>
              {hasRegisteredFace ? 'Tu rostro ya está registrado' : 'Registrar rostro'}
            </Button>
          </View>

          <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>Modo vigilante</ThemedText>
            </View>

            <ThemedText style={styles.cardDescription}>Permite que cualquier usuario pueda registrar su asistencia mediante este dispositivo.</ThemedText>
            <Button onPress={handleWatchModePress}>
              Abrir modo vigilante
            </Button>
          </View>

          <Button type="secondary" style={styles.logoutButton} onPress={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </ThemedView>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  title: {
    fontSize: TextSize.h1,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: TextSize.h5,
    marginTop: 8,
    marginBottom: 28,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: TextSize.h3,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: TextSize.p,
    opacity: 0.8,
    lineHeight: 20,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  statusText: {
    fontWeight: '600',
    fontSize: TextSize.small,
  },
  divider: {
    height: 1,
    opacity: 0.4,
  },
  tips: {
    gap: 8,
  },
  tipsTitle: {
    fontSize: TextSize.h5,
    fontWeight: '600',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: '#0051FE',
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: TextSize.p,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: TextSize.p,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  logoutButton: {
    marginTop: 12,
  },
});
