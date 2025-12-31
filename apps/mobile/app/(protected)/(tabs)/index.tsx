import api, { ApiError } from "@/api";
import AttendanceOptionsModal from "@/components/attendance-options-sheet";
import DebugMenu from "@/components/debug-menu";
import ThemedText from "@/components/themed-text";
import AnnouncementsCollection from "@/components/ui/announcements-collection";
import Button from "@/components/ui/button";
import DottedBackground from "@/components/ui/dotted-background";
import ThemedView from "@/components/ui/themed-view";
import { ATTENDANCE_REFRESH_EVENT } from "@/constants/events";
import { TextSize } from "@/constants/theme";
import { useUser } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useAnnouncements } from "@/modules/announcements/use-announcements";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface AttendanceEvent {
  data: {
    id: string;
    organization_id: string;
    user_id: string;
    location_id: string;
    start_time: string;
    check_out: string | null;
  };
}

async function getTodayAttendanceEvent(userId: string): Promise<AttendanceEvent | null> {
  if (!userId) {
    return null;
  }

  try {
    const response = await api.getTodayAttendanceEvent(userId);

    // 404 is a valid state (no attendance event today)
    if (response.status === 404) {
      return null;
    }

    if (response.status !== 200) {
      return null;
    }

    if (!response.data || response.data.check_out) {
      return null;
    }

    return response.data as AttendanceEvent;
  } catch (error) {
    console.error('Failed to fetch attendance event', error);
    return null;
  }
}



export default function Index() {
  const user = useUser() ?? { name: 'Usuario', id: '' };
  const themeColor = useThemeColor({}, 'neutral');
  const primaryColor = useThemeColor({}, 'primary');
  const tintColor = useThemeColor({}, 'tint');
  const cardColor = useThemeColor({}, 'card');
  const colorScheme = useColorScheme();
  const [todayAttendanceEvent, setTodayAttendanceEvent] = useState<AttendanceEvent | null>(null);
  const [primaryButtonText, setPrimaryButtonText] = useState<string>('Registrar asistencia');
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const accentColor = colorScheme === 'dark' ? tintColor : primaryColor;
  const headerBackgroundColor = colorScheme === 'dark' ? primaryColor : tintColor;
  const dotColor = colorScheme === 'dark'
    ? 'rgba(255, 255, 255, 0.16)'
    : 'rgba(0, 81, 254, 0.14)';
  const dotPatternSize = colorScheme === 'dark' ? 14 : 12;
  const dotRadius = colorScheme === 'dark' ? 2.1 : 1.8;

  const { announcements, loading, refreshing, fetchAnnouncements } = useAnnouncements();

  const refreshTodayAttendanceEvent = useCallback(async () => {
    try {
      const attendanceEvent = await getTodayAttendanceEvent(user.id);

      if (!attendanceEvent || attendanceEvent.data.check_out) {
        setTodayAttendanceEvent(null);
        setPrimaryButtonText('Registrar asistencia');
        return;
      }
      
      setPrimaryButtonText('Registrar salida');
      setTodayAttendanceEvent(attendanceEvent);
    } catch (error) {
      console.error('Failed to fetch attendance event', error);
      // Don't show alert for 404 (no event today is valid)
      if (error instanceof ApiError && error.statusCode === 404) {
        setTodayAttendanceEvent(null);
        setPrimaryButtonText('Registrar asistencia');
        return;
      }
      // For other errors, silently fail and keep current state
      // User can still try to check in/out
      setTodayAttendanceEvent(null);
    }
  }, [user.id]);

  useEffect(() => {
    router.prefetch('/(protected)/qr-scanner');
    router.prefetch('/(protected)/qr-checkout');
    refreshTodayAttendanceEvent();
  }, [refreshTodayAttendanceEvent]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      ATTENDANCE_REFRESH_EVENT,
      () => {
        refreshTodayAttendanceEvent();
      },
    );

    return () => subscription.remove();
  }, [refreshTodayAttendanceEvent]);

  useFocusEffect(
    useCallback(() => {
      refreshTodayAttendanceEvent();
      fetchAnnouncements();
    }, [refreshTodayAttendanceEvent, fetchAnnouncements]),
  );

  const hasActiveAttendance = Boolean(todayAttendanceEvent);

  const handleAttendanceAction = () => {
    console.log('todayAttendanceEvent', todayAttendanceEvent);

    if (!todayAttendanceEvent) {
      router.push('/(protected)/qr-scanner');
      return;
    }

    const { data: { id, location_id } } = todayAttendanceEvent;
    if (id && location_id) {
      router.push({
        pathname: '/(protected)/qr-checkout',
        params: {
          attendance_event_id: id,
          location_id: location_id,
        },
      });
      return;
    }

    router.push('/(protected)/qr-scanner');
  };

  const onRefreshAnnouncements = useCallback(() => {
    fetchAnnouncements(true);
  }, [fetchAnnouncements]);
  
  return <>
    <SafeAreaView>
      <ThemedView>
        <DebugMenu screenName="Home" />
        <View style={styles.header}>
          <DottedBackground
            style={styles.headerBackground}
            backgroundColor={headerBackgroundColor}
            dotColor={dotColor}
            dotSpacing={dotPatternSize}
            dotRadius={dotRadius}
          />
          <ThemedText style={{ fontSize: TextSize.h1, fontWeight: 'bold' }}>Bienvenido</ThemedText>
          <ThemedText style={{ fontSize: TextSize.h1, fontWeight: 'medium' }}>{user.name}</ThemedText>
        </View>

        <View style={[styles.attendanceController, { borderColor: themeColor, borderWidth: 1, backgroundColor: cardColor }]}>
          <View>
            <ThemedText style={{ fontSize: TextSize.p, fontWeight: 'bold', color: accentColor }}>Recuerda</ThemedText>
            <ThemedText style={{ fontSize: TextSize.h2, fontWeight: 'medium', marginTop: 8 }}> Registrar tu asistencia</ThemedText>
          </View>

          <View style={styles.attendanceControllerButtons}>
            <Button style={{ flex: 7 }} onPress={handleAttendanceAction}>{primaryButtonText}</Button>
            <Button type="secondary" style={{ flex: 3 }} onPress={() => setIsOptionsModalVisible(true)}>Ver más</Button>
          </View>
        </View>

        <AnnouncementsCollection
          announcements={announcements}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefreshAnnouncements}
          variant="compact"
        />
      </ThemedView>
    </SafeAreaView>
    <AttendanceOptionsModal
      visible={isOptionsModalVisible}
      onClose={() => setIsOptionsModalVisible(false)}
    />
  </>
}

const styles = StyleSheet.create({
  header: {
    position: 'relative',
  },
  headerBackground: {
    position: 'absolute',
    top: -200,
    left: -200,
    right: -200,
    bottom: -80,
  },
  attendanceController: {
    display: 'flex',
    gap: 16,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginTop: 28,
  },
  attendanceControllerButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
});
