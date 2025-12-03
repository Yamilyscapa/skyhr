import api, { ApiError, NetworkError, OrganizationGeofence } from "@/api";
import ThemedText from "@/components/themed-text";
import Button from "@/components/ui/button";
import ThemedView from "@/components/ui/themed-view";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { clearWatchModeEvents, useWatchModeEvents } from "@/modules/watch-mode/events-store";
import { StatusTone } from "@/modules/watch-mode/types";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WatchModeScreen() {
  const { activeOrganization, organizations } = useAuth();
  const router = useRouter();
  
  // Wait for organization data to finish loading before making decisions
  const isOrganizationDataLoaded = !activeOrganization.isPending && !organizations.isPending;
  const organizationId = ((activeOrganization.data ?? organizations.data?.[0]) as Record<string, unknown> | null)?.id as string | undefined;
  
  const [geofences, setGeofences] = useState<OrganizationGeofence[]>([]);
  const [geofencesLoading, setGeofencesLoading] = useState(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<string | null>(null);
  const recentEvents = useWatchModeEvents();
  const cardColor = useThemeColor({}, 'card');
  const dividerColor = useThemeColor({}, 'neutral');
  const successColor = '#0F9D58';
  const warningColor = '#F59E0B';
  const errorColor = '#DC2626';
  const [status, setStatus] = useState<{ text: string; tone: StatusTone }>({
    text: 'Selecciona una ubicación y abre el modo vigilante para comenzar.',
    tone: 'idle',
  });

  const fetchGeofences = useCallback(async () => {
    if (!organizationId) {
      setGeofences([]);
      setSelectedGeofenceId(null);
      setGeofenceError('No hay una organización activa. Selecciona una organización desde configuración.');
      setStatus({ text: 'Debes seleccionar una organización activa para usar el modo vigilante.', tone: 'error' });
      return;
    }

    setGeofencesLoading(true);
    setGeofenceError(null);
    try {
      const response = await api.getOrganizationGeofences(organizationId, { pageSize: 50 });
      const list = response.data ?? [];
      setGeofences(list);
      setSelectedGeofenceId((prev) => {
        if (prev && list.some((gf) => gf.id === prev)) {
          return prev;
        }
        return list[0]?.id ?? null;
      });

      if (list.length === 0) {
        setStatus({ text: 'Configura al menos una geocerca para usar el modo vigilante.', tone: 'warning' });
      } else {
        setStatus({ text: 'Selecciona una ubicación y abre el modo vigilante para comenzar.', tone: 'idle' });
      }
    } catch (error) {
      console.error('Failed to load geofences', error);
      const message = error instanceof ApiError || error instanceof NetworkError
        ? error.message
        : 'No pudimos cargar las ubicaciones disponibles.';
      setGeofenceError(message);
      setStatus({ text: message, tone: 'error' });
    } finally {
      setGeofencesLoading(false);
    }
  }, [organizationId]);

  useFocusEffect(
    useCallback(() => {
      fetchGeofences();
    }, [fetchGeofences])
  );
  
  const selectedGeofence = geofences.find((gf) => gf.id === selectedGeofenceId) ?? null;

  const handleSelectGeofence = (geofenceId: string) => {
    setSelectedGeofenceId(geofenceId);
    clearWatchModeEvents();
  };

  const handleStartWatchMode = () => {
    if (!organizationId) {
      setStatus({ text: 'Debes seleccionar una organización activa para usar el modo vigilante.', tone: 'error' });
      return;
    }

    if (!selectedGeofence) {
      setStatus({ text: 'Selecciona una ubicación antes de abrir el modo vigilante.', tone: 'warning' });
      return;
    }

    router.push({
      pathname: '/(protected)/watch-mode/capture',
      params: {
        organization_id: organizationId,
        location_id: selectedGeofence.id,
        location_name: selectedGeofence.name,
      },
    });

    setStatus({ text: `Modo vigilante activo para ${selectedGeofence.name}.`, tone: 'idle' });
  };

  const statusStyles = useMemo(() => {
    const base = {
      backgroundColor: 'rgba(255,255,255,0.05)',
      color: '#fff',
    };

    if (status.tone === 'success') {
      return { backgroundColor: 'rgba(15, 157, 88, 0.15)', color: successColor };
    }
    if (status.tone === 'warning') {
      return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: warningColor };
    }
    if (status.tone === 'error') {
      return { backgroundColor: 'rgba(220, 38, 38, 0.15)', color: errorColor };
    }
    return base;
  }, [status.tone, successColor, warningColor, errorColor]);

  // Show loading state while organization data is being fetched
  if (!isOrganizationDataLoaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0F9D58" />
          <ThemedText style={styles.loadingText}>Cargando datos de organización...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={[styles.card, { backgroundColor: cardColor }]}> 
          <ThemedText style={styles.title}>Modo vigilante</ThemedText>
          <ThemedText style={styles.subtitle}>
            Deja este dispositivo cuidando la entrada. La cámara buscará rostros y registrará la asistencia de cada colaborador.
          </ThemedText>

          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Ubicación activa</ThemedText>
            {geofencesLoading && <ActivityIndicator size="small" />}
          </View>

          {geofenceError ? (
            <ThemedText style={[styles.warningText, { color: errorColor }]}>{geofenceError}</ThemedText>
          ) : geofences.length === 0 ? (
            <ThemedText style={styles.mutedText}>Crea una geocerca desde el panel web para comenzar.</ThemedText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationsList}>
              {geofences.map((geofence) => {
                const isSelected = geofence.id === selectedGeofenceId;
                return (
                  <Pressable
                    key={geofence.id}
                    onPress={() => handleSelectGeofence(geofence.id)}
                    style={[
                      styles.locationChip,
                      { borderColor: isSelected ? successColor : dividerColor },
                      isSelected && { backgroundColor: 'rgba(15, 157, 88, 0.1)' },
                    ]}
                  >
                    <ThemedText style={[styles.locationChipText, isSelected && { color: successColor }]}>
                      {geofence.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Button onPress={handleStartWatchMode} disabled={!organizationId || !selectedGeofenceId}>
            Abrir modo vigilante
          </Button>

          <View style={[styles.statusBadge, { backgroundColor: statusStyles.backgroundColor }]}> 
            <ThemedText style={[styles.statusText, { color: statusStyles.color }]}>{status.text}</ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: cardColor }]}> 
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Últimos registros</ThemedText>
            {recentEvents.length > 0 && (
              <ThemedText style={styles.mutedText}>En orden cronológico</ThemedText>
            )}
          </View>
          {recentEvents.length === 0 ? (
            <ThemedText style={styles.mutedText}>Aún no hay registros capturados en este modo.</ThemedText>
          ) : (
            recentEvents.map((event) => (
              <View key={event.id} style={[styles.historyItem, { borderColor: dividerColor }]}> 
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.historyName}>{event.userName}</ThemedText>
                  <ThemedText style={styles.historyMeta}>{event.recordedAt}</ThemedText>
                </View>
                <View style={styles.historyTag}> 
                  <ThemedText style={styles.historyTagText}>{event.status}</ThemedText>
                </View>
              </View>
            ))
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  locationsList: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  locationChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  locationChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
  },
  mutedText: {
    fontSize: 14,
    opacity: 0.7,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyName: {
    fontSize: 16,
    fontWeight: '600',
  },
  historyMeta: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 4,
  },
  historyTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  historyTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
