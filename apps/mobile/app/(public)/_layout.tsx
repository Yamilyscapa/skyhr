import { Redirect, Stack } from 'expo-router';

import FullScreenLoader from '@/components/full-screen-loader';
import { useAuth } from '@/hooks/use-auth';

export default function PublicLayout() {
  const { session, isInitialized } = useAuth();
  const isAuthenticated = !!session.data?.user;

  if (!isInitialized || session.isPending) {
    return <FullScreenLoader />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(protected)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="auth/welcome"
        options={{
          title: 'Bienvenido',
        }}
      />
      <Stack.Screen
        name="auth/sign-up"
        options={{
          title: 'Crear cuenta',
        }}
      />
      <Stack.Screen
        name="auth/sign-in"
        options={{
          title: 'Iniciar sesión',
        }}
      />
    </Stack>
  );
}
