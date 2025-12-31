import { Redirect, Stack } from 'expo-router';

import FullScreenLoader from '@/components/full-screen-loader';
import { useAuth } from '@/hooks/use-auth';

export default function ProtectedLayout() {
  const { session, activeOrganization, organizations, isInitialized } = useAuth();

  const isLoading =
    !isInitialized ||
    session.isPending ||
    activeOrganization.isPending ||
    organizations.isPending;

  const isAuthenticated = !!session.data?.user;
  const hasOrganization = Boolean(activeOrganization.data) || (organizations.data?.length ?? 0) > 0;

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(public)/auth/welcome" />;
  }

  if (!hasOrganization) {
    return <Redirect href="/(no-org)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackVisible: true,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="qr-scanner/index"
        options={{
          title: 'Escanear QR',
          headerBackTitle: 'Cancelar',
        }}
      />
      <Stack.Screen
        name="qr-checkout/index"
        options={{
          title: 'Registrar salida',
          headerBackTitle: 'Cancelar',
        }}
      />
      <Stack.Screen
        name="biometrics-scanner/index"
        options={{
          title: 'Escanear Biometrico',
          headerBackTitle: 'Cancelar',
        }}
      />
      <Stack.Screen
        name="settings/register-face"
        options={{
          title: 'Registrar rostro',
          headerBackTitle: 'Atrás',
        }}
      />
      <Stack.Screen
        name="watch-mode/index"
        options={{
          title: 'Modo vigilante',
          headerBackTitle: 'Atrás',
        }}
      />
      <Stack.Screen
        name="watch-mode/capture"
        options={{
          title: 'Capturar asistencia',
          headerBackTitle: 'Atrás',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="visitors/scan-visitor"
        options={{
          title: 'Escanear Visitante',
          headerBackTitle: 'Cancelar',
        }}
      />
    </Stack>
  );
}
