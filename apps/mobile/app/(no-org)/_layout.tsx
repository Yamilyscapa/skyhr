import { Redirect, Stack } from 'expo-router';

import FullScreenLoader from '@/components/full-screen-loader';
import { useAuth } from '@/hooks/use-auth';

export default function NoOrganizationLayout() {
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

  if (hasOrganization) {
    return <Redirect href="/(protected)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Invitación pendiente',
        }}
      />
    </Stack>
  );
}
