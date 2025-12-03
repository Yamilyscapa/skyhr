import api, { ApiError, NetworkError } from "@/api";
import DebugMenu from "@/components/debug-menu";
import QRScannerOverlay from "@/components/qr-scanner-overlay";
import Button from "@/components/ui/button";
import { ATTENDANCE_REFRESH_EVENT } from "@/constants/events";
import { useActiveOrganization } from "@/hooks/use-auth";
import { useCameraPermission } from "@/hooks/use-camera-permission";
import { useLocation } from "@/hooks/use-location";
import { BarcodeScanningResult, CameraView } from "expo-camera";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, DeviceEventEmitter, StyleSheet, Text, useWindowDimensions, View } from "react-native";

export default function QRCheckout() {
  const router = useRouter();
  const { attendance_event_id, location_id: expectedLocationId } = useLocalSearchParams<{
    attendance_event_id?: string;
    location_id?: string;
  }>();
  const { hasPermission, isLoading, requestPermission } = useCameraPermission();
  const {
    latitude,
    longitude,
    hasPermission: hasLocationPermission,
    isLoading: isLocationLoading,
    error: locationError,
  } = useLocation();
  const { width, height } = useWindowDimensions();
  const isProcessingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScreenActive, setIsScreenActive] = useState(false);
  const activeOrganization = useActiveOrganization();
  const hasOrganization = Boolean(activeOrganization);

  // Only check for attendance_event_id when the screen is actually focused, not during prefetch
  useFocusEffect(
    useCallback(() => {
      if (!attendance_event_id) {
        Alert.alert(
          'Sin registro de entrada',
          'No pudimos encontrar tu registro de asistencia. Registra tu entrada antes de marcar la salida.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(protected)/(tabs)'),
            },
          ],
        );
      }
    }, [attendance_event_id, router])
  );

  useFocusEffect(
    useCallback(() => {
      setIsScreenActive(true);
      setIsCameraReady(false);
      isProcessingRef.current = false;

      return () => {
        setIsScreenActive(false);
        setIsCameraReady(false);
        isProcessingRef.current = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!hasPermission && !isLoading) {
      requestPermission();
    }
  }, [hasPermission, isLoading, requestPermission]);

  const handleBarcodeScanned = async (event: BarcodeScanningResult) => {
    if (isProcessingRef.current || !attendance_event_id || !isCameraReady) return;
    if (!hasLocationPermission || !latitude || !longitude) return;

    const scannerWidth = 250;
    const scannerHeight = 250;
    const distanceFromTop = 0.30;

    const scannerLeft = (width - scannerWidth) / 2;
    const scannerTop = height * distanceFromTop - scannerHeight / 2;
    const scannerRight = scannerLeft + scannerWidth;
    const scannerBottom = scannerTop + scannerHeight;

    if (!event.cornerPoints || event.cornerPoints.length === 0) {
      return;
    }

    const pointsInside = event.cornerPoints.filter(point => {
      return point.x >= scannerLeft &&
        point.x <= scannerRight &&
        point.y >= scannerTop &&
        point.y <= scannerBottom;
    }).length;

    const percentageInside = pointsInside / event.cornerPoints.length;

    if (percentageInside < 0.8) {
      return;
    }

    isProcessingRef.current = true;

    try {
      const scannedData = event.data;
      if (!scannedData) {
        throw new Error('El código QR no es válido, intenta nuevamente.');
      }

      const { data } = await api.validateQR(scannedData);
      const { location_id: scannedLocationId } = data;

      if (!scannedLocationId) {
        throw new Error('El código QR no pertenece a un punto válido. Intenta nuevamente.');
      }

      if (expectedLocationId && scannedLocationId !== expectedLocationId) {
        throw new Error('El QR escaneado no corresponde a tu punto de registro.');
      }

      setIsSubmitting(true);
      await api.checkOut({
        attendanceEventId: attendance_event_id,
        latitude,
        longitude,
      });
      DeviceEventEmitter.emit(ATTENDANCE_REFRESH_EVENT);

      Alert.alert(
        'Salida registrada',
        'Tu salida ha sido registrada correctamente.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(protected)/(tabs)'),
          },
        ],
      );
    } catch (error) {
      let errorMessage = 'El código QR no es correcto, intenta nuevamente.';
      let errorTitle = 'QR inválido';
      
      if (error instanceof NetworkError) {
        errorTitle = 'Error de conexión';
        errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
      } else if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      
      Alert.alert(
        errorTitle,
        errorMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              isProcessingRef.current = false;
            },
          },
        ],
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const scannerSize = 250;
  const scannerTop = height * 0.30 - scannerSize / 2;
  const scannerLeft = (width - scannerSize) / 2;
  const borderRadius = 16;

  if (!hasOrganization) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.permissionText}>
          Necesitas una organización activa para registrar tu salida.
        </Text>
        <Button onPress={() => router.replace('/(protected)/(tabs)')}>Volver al inicio</Button>
      </View>
    );
  }

  if (!hasPermission && !isLoading) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.permissionText}>
          Se necesitan permisos de cámara
        </Text>
      </View>
    );
  }

  if (isLocationLoading) {
    return (
      <View style={styles.centeredContent}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.permissionText}>
          Obteniendo ubicación...
        </Text>
      </View>
    );
  }

  if (!hasLocationPermission || !latitude || !longitude) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.permissionText}>
          Se necesitan permisos de ubicación para registrar tu salida
        </Text>
        {locationError && (
          <Text style={styles.errorText}>
            {locationError}
          </Text>
        )}
      </View>
    );
  }

  const shouldRenderCamera = isScreenActive && hasPermission;

  return (
    <View style={styles.screen}>
      <DebugMenu screenName="QR Checkout" />

      {shouldRenderCamera && (
        <CameraView
          facing="back"
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
          onCameraReady={() => setIsCameraReady(true)}
        />
      )}

      {shouldRenderCamera && !isCameraReady && (
        <View style={styles.cameraStatusOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.submittingText}>
            Preparando cámara...
          </Text>
        </View>
      )}

      <QRScannerOverlay
        width={width}
        height={height}
        scannerSize={scannerSize}
        scannerTop={scannerTop}
        scannerLeft={scannerLeft}
        borderRadius={borderRadius}
      />

      <View style={[styles.scanner, {
        top: scannerTop,
        left: scannerLeft,
      }]} />

      {isSubmitting && (
        <View style={styles.submittingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.submittingText}>
            Registrando salida...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContent: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 32,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  scanner: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    borderRadius: 16,
    position: 'absolute',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  cameraStatusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submittingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submittingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
});
