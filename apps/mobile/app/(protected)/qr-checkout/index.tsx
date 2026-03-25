import api, { ApiError, NetworkError } from "@/api";
import DebugMenu from "@/components/debug-menu";
import QRScannerOverlay from "@/components/qr-scanner-overlay";
import Button from "@/components/ui/button";
import { ATTENDANCE_REFRESH_EVENT } from "@/constants/events";
import { useActiveOrganization } from "@/hooks/use-auth";
import { useCameraPermission } from "@/hooks/use-camera-permission";
import { useLocation } from "@/hooks/use-location";
import { useThemeColor } from "@/hooks/use-theme-color";
import { extractQrPayloadFromPhoto } from "@/modules/qr/scan-from-photo";
import { Ionicons } from "@expo/vector-icons";
import { BarcodeScanningResult, CameraView } from "expo-camera";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCAN_THROTTLE_MS = 700;
const DUPLICATE_SCAN_COOLDOWN_MS = 1500;

export default function QRCheckout() {
  const router = useRouter();
  const primaryColor = useThemeColor({}, "primary");
  const { attendance_event_id, location_id: expectedLocationId } =
    useLocalSearchParams<{
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
  const insets = useSafeAreaInsets();
  const scannerSize = 250;
  const scannerTop = height * 0.3 - scannerSize / 2;
  const scannerLeft = (width - scannerSize) / 2;
  const borderRadius = 16;
  const isProcessingRef = useRef(false);
  const isManualProcessingRef = useRef(false);
  const cameraRef = useRef<CameraView | null>(null);
  const lastScanAtRef = useRef(0);
  const lastScannedDataRef = useRef<string | null>(null);
  const lastScannedDataAtRef = useRef(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScreenActive, setIsScreenActive] = useState(false);
  const [isManualProcessing, setIsManualProcessing] = useState(false);
  const activeOrganization = useActiveOrganization();
  const hasOrganization = Boolean(activeOrganization);

  // Only check for attendance_event_id when the screen is actually focused, not during prefetch
  useFocusEffect(
    useCallback(() => {
      if (!attendance_event_id) {
        Alert.alert(
          "Sin registro de entrada",
          "No pudimos encontrar tu registro de asistencia. Registra tu entrada antes de marcar la salida.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(protected)/(tabs)"),
            },
          ],
        );
      }
    }, [attendance_event_id, router]),
  );

  useFocusEffect(
    useCallback(() => {
      setIsScreenActive(true);
      setIsCameraReady(false);
      isProcessingRef.current = false;
      isManualProcessingRef.current = false;
      setIsManualProcessing(false);
      lastScanAtRef.current = 0;
      lastScannedDataRef.current = null;
      lastScannedDataAtRef.current = 0;

      return () => {
        setIsScreenActive(false);
        setIsCameraReady(false);
        isProcessingRef.current = false;
        isManualProcessingRef.current = false;
        setIsManualProcessing(false);
      };
    }, []),
  );

  useEffect(() => {
    if (!hasPermission && !isLoading) {
      requestPermission();
    }
  }, [hasPermission, isLoading, requestPermission]);

  const processScannedData = useCallback(
    async (scannedData: string) => {
      if (!attendance_event_id) {
        isProcessingRef.current = false;
        return;
      }

      try {
        const { data } = await api.validateQR(scannedData);
        const { location_id: scannedLocationId } = data;

        if (!scannedLocationId) {
          throw new Error(
            "El código QR no pertenece a un punto válido. Intenta nuevamente.",
          );
        }

        if (expectedLocationId && scannedLocationId !== expectedLocationId) {
          throw new Error(
            "El QR escaneado no corresponde a tu punto de registro.",
          );
        }

        setIsSubmitting(true);
        await api.checkOut({
          attendanceEventId: attendance_event_id,
          latitude,
          longitude,
        });
        DeviceEventEmitter.emit(ATTENDANCE_REFRESH_EVENT);

        Alert.alert(
          "Salida registrada",
          "Tu salida ha sido registrada correctamente.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(protected)/(tabs)"),
            },
          ],
        );
      } catch (error) {
        let errorMessage = "El código QR no es correcto, intenta nuevamente.";
        let errorTitle = "QR inválido";

        if (error instanceof NetworkError) {
          errorTitle = "Error de conexión";
          errorMessage =
            "Error de conexión. Verifica tu internet e intenta nuevamente.";
        } else if (error instanceof ApiError) {
          errorMessage = error.message || errorMessage;
        } else if (error instanceof Error) {
          errorMessage = error.message || errorMessage;
        }

        Alert.alert(errorTitle, errorMessage, [
          {
            text: "OK",
            onPress: () => {
              isProcessingRef.current = false;
            },
          },
        ]);
      } finally {
        setIsSubmitting(false);
      }
    },
    [attendance_event_id, expectedLocationId, latitude, longitude, router],
  );

  const handleBarcodeScanned = async (event: BarcodeScanningResult) => {
    if (
      isProcessingRef.current ||
      isManualProcessingRef.current ||
      !attendance_event_id ||
      !isCameraReady
    ) {
      return;
    }
    if (!hasLocationPermission || !latitude || !longitude) {
      return;
    }

    const now = Date.now();
    if (now - lastScanAtRef.current < SCAN_THROTTLE_MS) {
      return;
    }
    lastScanAtRef.current = now;

    const scannedData = event.data?.trim();
    if (!scannedData) {
      return;
    }

    if (
      lastScannedDataRef.current === scannedData &&
      now - lastScannedDataAtRef.current < DUPLICATE_SCAN_COOLDOWN_MS
    ) {
      return;
    }

    if (event.cornerPoints && event.cornerPoints.length > 0) {
      const pointsInside = event.cornerPoints.filter((point) => {
        return (
          point.x >= scannerLeft &&
          point.x <= scannerLeft + scannerSize &&
          point.y >= scannerTop &&
          point.y <= scannerTop + scannerSize
        );
      }).length;

      const percentageInside = pointsInside / event.cornerPoints.length;
      if (percentageInside < 0.8) {
        return;
      }
    }

    isProcessingRef.current = true;
    lastScannedDataRef.current = scannedData;
    lastScannedDataAtRef.current = now;

    await processScannedData(scannedData);
  };

  const handleManualScanPress = useCallback(async () => {
    if (
      !cameraRef.current ||
      !isCameraReady ||
      !attendance_event_id ||
      isProcessingRef.current ||
      isManualProcessingRef.current
    ) {
      return;
    }
    if (!hasLocationPermission || !latitude || !longitude) {
      return;
    }

    isManualProcessingRef.current = true;
    setIsManualProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri || !photo.width || !photo.height) {
        throw new Error("No se pudo capturar la foto");
      }

      const payload = await extractQrPayloadFromPhoto({
        photoUri: photo.uri,
        photoWidth: photo.width,
        photoHeight: photo.height,
        previewWidth: width,
        previewHeight: height,
        scannerFrame: {
          left: scannerLeft,
          top: scannerTop,
          size: scannerSize,
        },
      });

      if (!payload) {
        Alert.alert(
          "QR inválido",
          "No pudimos leer el código QR. Intenta nuevamente.",
        );
        return;
      }

      const now = Date.now();
      if (
        lastScannedDataRef.current === payload &&
        now - lastScannedDataAtRef.current < DUPLICATE_SCAN_COOLDOWN_MS
      ) {
        return;
      }

      isProcessingRef.current = true;
      lastScanAtRef.current = now;
      lastScannedDataRef.current = payload;
      lastScannedDataAtRef.current = now;

      await processScannedData(payload);
    } catch (error) {
      console.error("Manual QR capture failed:", error);
      Alert.alert(
        "Error de escaneo",
        "No pudimos procesar la captura. Intenta nuevamente.",
      );
    } finally {
      isManualProcessingRef.current = false;
      setIsManualProcessing(false);
    }
  }, [
    attendance_event_id,
    hasLocationPermission,
    height,
    isCameraReady,
    latitude,
    longitude,
    processScannedData,
    scannerLeft,
    scannerSize,
    scannerTop,
    width,
  ]);

  if (!hasOrganization) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.permissionText}>
          Necesitas una organización activa para registrar tu salida.
        </Text>
        <Button onPress={() => router.replace("/(protected)/(tabs)")}>
          Volver al inicio
        </Button>
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
        <Text style={styles.permissionText}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  if (!hasLocationPermission || !latitude || !longitude) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.permissionText}>
          Se necesitan permisos de ubicación para registrar tu salida
        </Text>
        {locationError && <Text style={styles.errorText}>{locationError}</Text>}
      </View>
    );
  }

  const shouldRenderCamera = isScreenActive && hasPermission;

  return (
    <View style={styles.screen}>
      <DebugMenu screenName="QR Checkout" />

      {shouldRenderCamera && (
        <CameraView
          ref={cameraRef}
          facing="back"
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcodeScanned}
          onCameraReady={() => setIsCameraReady(true)}
        />
      )}

      {shouldRenderCamera && !isCameraReady && (
        <View style={styles.cameraStatusOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.submittingText}>Preparando cámara...</Text>
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

      <View
        style={[
          styles.scanner,
          {
            top: scannerTop,
            left: scannerLeft,
          },
        ]}
      />

      {isSubmitting && (
        <View style={styles.submittingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.submittingText}>Registrando salida...</Text>
        </View>
      )}

      <View style={[styles.fallbackContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[
            styles.scanAssistButton,
            { backgroundColor: primaryColor },
            (!isCameraReady || isManualProcessing) &&
              styles.scanAssistButtonDisabled,
          ]}
          activeOpacity={0.7}
          onPress={handleManualScanPress}
          disabled={!isCameraReady || isManualProcessing}
          accessibilityRole="button"
          accessibilityLabel="Escanear"
          accessibilityHint="Toma una foto para extraer el codigo QR si el escaneo automatico falla"
          accessibilityState={{
            disabled: !isCameraReady || isManualProcessing,
          }}
        >
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.scanAssistButtonText}>Escanear</Text>
        </TouchableOpacity>
        {isManualProcessing && (
          <Text style={styles.scanAssistHint}>Procesando QR...</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  centeredContent: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    marginHorizontal: 32,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  scanner: {
    width: 250,
    height: 250,
    backgroundColor: "transparent",
    borderRadius: 16,
    position: "absolute",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  cameraStatusOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  submittingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  submittingText: {
    color: "white",
    fontSize: 16,
    marginTop: 16,
  },
  fallbackContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 8,
  },
  scanAssistButton: {
    minWidth: 148,
    minHeight: 56,
    borderRadius: 100,
    padding: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scanAssistButtonDisabled: {
    opacity: 0.5,
  },
  scanAssistButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scanAssistHint: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
  },
});
