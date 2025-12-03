import api, { ApiError, NetworkError } from "@/api";
import DebugMenu from "@/components/debug-menu";
import ThemedText from "@/components/themed-text";
import Button from "@/components/ui/button";
import ThemedView from "@/components/ui/themed-view";
import { TextSize } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const flowSteps = [
  'Pídele a tu manager que envíe una invitación a tu correo corporativo.',
  'Cuando recibas el correo, abre el enlace “Aceptar invitación”.',
  'Completa el acceso desde el navegador iniciando sesión con esta misma cuenta.',
  'Regresa a la app y toca “Ya acepté la invitación” para actualizar tu organización activa.',
];

const statusColors = {
  success: { background: 'rgba(15, 157, 88, 0.15)', text: '#0F9D58' },
  warning: { background: 'rgba(245, 158, 11, 0.15)', text: '#B45309' },
  error: { background: 'rgba(239, 68, 68, 0.15)', text: '#B91C1C' },
  info: { background: 'rgba(59, 130, 246, 0.15)', text: '#1D4ED8' },
} as const;

export default function AwaitingInvitationScreen() {
  const { session, activeOrganization, organizations, setActiveOrganization, signOut } = useAuth();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const neutralColor = useThemeColor({}, 'neutral');
  const tintColor = useThemeColor({}, 'tint');
  const primaryColor = useThemeColor({}, 'primary');
  const user = session.data?.user as Record<string, unknown> | null;
  const userEmail = (user?.email as string) ?? '';

  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [invitationStatusKey, setInvitationStatusKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusLevel, setStatusLevel] = useState<keyof typeof statusColors>('info');

  useEffect(() => {
    if (activeOrganization.data) {
      router.replace('/(protected)/(tabs)');
    }
  }, [activeOrganization.data, router]);

  const handleCheckInvitation = useCallback(async () => {
    if (!userEmail) {
      setStatusLevel('error');
      setStatusMessage('No encontramos un correo asociado a tu cuenta. Cierra sesión y vuelve a iniciar para continuar.');
      setInvitationStatusKey(null);
      return;
    }

    setIsCheckingStatus(true);
    setStatusMessage(null);

    try {
      const response = await api.getPublicInvitationStatus(userEmail);
      const payload = response?.data ?? null;
      console.log('res', response);
      const normalizedStatus = (payload?.status as string | undefined)?.toLowerCase();
      if (normalizedStatus === 'pending') {
        setInvitationStatusKey('pending');
        setStatusLevel('info');
      } else if (normalizedStatus === 'accepted') {
        setInvitationStatusKey('accepted');
        setStatusLevel('success');
      } else {
        setInvitationStatusKey('not_found');
        setStatusLevel('warning');
      }

      setStatusMessage(response?.message ?? 'Consulta completada correctamente.');
    } catch (error) {
      let message = 'No pudimos consultar la invitación.';
      
      if (error instanceof NetworkError) {
        message = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
      } else if (error instanceof ApiError) {
        if (error.statusCode === 400) {
          message = 'Verifica tu correo y vuelve a intentarlo.';
        } else {
          message = error.message || message;
        }
      } else if (error instanceof Error) {
        message = error.message.includes('HTTP 400')
          ? 'Verifica tu correo y vuelve a intentarlo.'
          : error.message || message;
      }
      
      setInvitationStatusKey(null);
      setStatusLevel('error');
      setStatusMessage(message);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) {
      handleCheckInvitation();
    }
  }, [userEmail, handleCheckInvitation]);

  const handleRefreshContext = async () => {
    setIsRefreshingContext(true);

    try {
      const results = await Promise.allSettled([
        session.refetch(),
        activeOrganization.refetch?.(),
        organizations.refetch?.(),
      ]);

      // After refetching, check the reactive state
      // The refetch methods may not return data directly, so we check the hook state
      // Use a small delay to allow state to update
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if we have an active organization
      if (activeOrganization.data) {
        router.replace('/(protected)/(tabs)');
        return;
      }

      // If no active org but we have organizations, try to set the first one as active
      const orgs = organizations.data;

      if (orgs && Array.isArray(orgs) && orgs.length > 0) {
        const firstOrg = orgs[0];
        if (firstOrg && typeof firstOrg === 'object' && 'id' in firstOrg) {
          try {
            await setActiveOrganization({ organizationId: firstOrg.id as string });
            // Wait for the active org to update
            await new Promise(resolve => setTimeout(resolve, 200));
            // Refetch to get the updated active organization
            await activeOrganization.refetch?.();
            // Check again after refetch
            await new Promise(resolve => setTimeout(resolve, 100));
            if (activeOrganization.data) {
              router.replace('/(protected)/(tabs)');
              return;
            }
          } catch (error) {
            console.error('Failed to set active organization:', error);
          }
        }
      }
    } finally {
      setIsRefreshingContext(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      // Try to sign out - this may fail due to circular reference issues in Better Auth
      await signOut();
    } catch (error) {
      console.warn('Sign out error (non-critical, session will be cleared on next request):', error);
    } finally {
      router.replace('/(public)/auth/welcome');
      setIsSigningOut(false);
    }
  };


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <DebugMenu screenName="AwaitingInvitation" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView>
          <View style={styles.hero}>
            <ThemedText style={[styles.overline, { color: primaryColor }]}>Falta conectar tu organización</ThemedText>
            <ThemedText style={styles.title}>Espera la invitación de tu manager</ThemedText>
            <ThemedText style={[styles.subtitle, { color: textColor }]}>
              Para usar Sky HR necesitas aceptar una invitación enviada desde tu organización. Te avisamos cómo continuar.
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: cardColor, borderColor: neutralColor }]}>
            <ThemedText style={styles.cardTitle}>Estado de la invitación</ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Tu correo</ThemedText>
              <TextInput
                style={[styles.input, styles.disabledInput, { borderColor: neutralColor, backgroundColor: backgroundColor, color: textColor }]}
                value={userEmail}
                editable={false}
              />
              <ThemedText style={[styles.helperText, { color: textColor }]}>
                Debes aceptar la invitación con esta misma cuenta.
              </ThemedText>
            </View>

            <Button onPress={handleCheckInvitation} disabled={isCheckingStatus}>
              {isCheckingStatus ? 'Consultando…' : 'Consultar estado de la invitación'}
            </Button>

            {statusMessage && (
              <View style={[
                styles.statusBanner,
                { backgroundColor: statusColors[statusLevel].background },
              ]}>
                <ThemedText style={[styles.statusText, { color: statusColors[statusLevel].text }]}>
                  {
                    invitationStatusKey === 'pending' ? 'Tu invitación está pendiente.' :
                      invitationStatusKey === 'accepted' ? 'Tu invitación ya fue aceptada.' :
                        invitationStatusKey === 'expired' ? 'La invitación expiró.' :
                          invitationStatusKey === 'revoked' ? 'La invitación fue cancelada.' :
                            invitationStatusKey === 'not_found' ? 'Aún no encontramos tu invitación.' :
                              statusMessage
                  }
                </ThemedText>
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: cardColor, borderColor: neutralColor }]}>
            <ThemedText style={styles.cardTitle}>¿Qué debes hacer?</ThemedText>
            <View style={styles.steps}>
              {flowSteps.map((step) => (
                <View key={step} style={styles.stepRow}>
                  <View style={[styles.stepBullet, { backgroundColor: tintColor }]} />
                  <ThemedText style={[styles.stepText, { color: textColor }]}>{step}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            <Button onPress={handleRefreshContext} disabled={isRefreshingContext}>
              {isRefreshingContext ? 'Actualizando…' : 'Ya acepté la invitación'}
            </Button>
            <Button type="secondary" onPress={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </Button>
          </View>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  hero: {
    borderRadius: 24,
    paddingTop: 20,
    marginBottom: 24,
    gap: 8,
  },
  overline: {
    fontSize: TextSize.p,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  title: {
    fontSize: TextSize.h2,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: TextSize.h5,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: TextSize.h3,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: TextSize.p,
    lineHeight: 20,
  },
  code: {
    fontFamily: 'Courier',
    fontSize: TextSize.p,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  disabledInput: {
    opacity: 0.8,
  },
  helperText: {
    fontSize: TextSize.small,
    opacity: 0.8,
  },
  statusBanner: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  statusText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  invitationCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  invitationTitle: {
    fontWeight: '700',
    fontSize: TextSize.h4,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusPillText: {
    fontWeight: '600',
  },
  invitationHelper: {
    fontSize: TextSize.p,
    lineHeight: 20,
  },
  invitationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontWeight: '600',
  },
  detailValue: {
    fontWeight: '500',
  },
  steps: {
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBullet: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  stepText: {
    flex: 1,
    fontSize: TextSize.p,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    marginBottom: 32,
  },
});
