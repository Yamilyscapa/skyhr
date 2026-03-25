import api, { ApiError, NetworkError } from "@/api";
import DebugMenu from "@/components/debug-menu";
import QRScannerOverlay from "@/components/qr-scanner-overlay";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCameraPermission } from "@/hooks/use-camera-permission";
import { useThemeColor } from "@/hooks/use-theme-color";
import { extractQrPayloadFromPhoto } from "@/modules/qr/scan-from-photo";
import { Ionicons } from "@expo/vector-icons";
import { BarcodeScanningResult, CameraView } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCAN_THROTTLE_MS = 700;
const DUPLICATE_SCAN_COOLDOWN_MS = 1500;

export default function QRScanner() {
  const { hasPermission, isLoading, requestPermission } = useCameraPermission();
  const { activeOrganization, organizations } = useAuth();
  const primaryColor = useThemeColor({}, "primary");
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Wait for organization data to finish loading before making decisions
  const isOrganizationDataLoaded =
    !activeOrganization.isPending && !organizations.isPending;
  const hasOrganization =
    Boolean(activeOrganization.data) || (organizations.data?.length ?? 0) > 0;
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
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScreenActive, setIsScreenActive] = useState(false);
  const [isManualProcessing, setIsManualProcessing] = useState(false);

  useEffect(() => {
    if (!hasPermission && !isLoading) {
      requestPermission();
    }
  }, [hasPermission, isLoading, requestPermission]);

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

  const processScannedData = useCallback(async (scannedData: string) => {
    try {
      const { data } = await api.validateQR(scannedData);
      const { location_id, organization_id } = data;

      if (!location_id || !organization_id) {
        Alert.alert(
          "QR invalido",
          "El codigo QR no es correcto, intente nuevamente",
          [
            {
              text: "OK",
              onPress: () => {
                isProcessingRef.current = false;
              },
            },
          ],
        );
        return;
      }

      router.push(
        `/(protected)/biometrics-scanner?location_id=${location_id}&organization_id=${organization_id}`,
      );
    } catch (error) {
      console.error("QR validation failed:", error);

      let errorMessage = "El codigo QR no es correcto, intente nuevamente";
      if (error instanceof NetworkError) {
        errorMessage =
          "Error de conexión. Verifica tu internet e intenta nuevamente.";
      } else if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }

      Alert.alert(
        error instanceof NetworkError ? "Error de conexión" : "QR invalido",
        errorMessage,
        [
          {
            text: "OK",
            onPress: () => {
              isProcessingRef.current = false;
            },
          },
        ],
      );
    }
  }, []);

  const handleBarcodeScanned = async (event: BarcodeScanningResult) => {
    if (
      isProcessingRef.current ||
      isManualProcessingRef.current ||
      !isCameraReady
    ) {
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
      isProcessingRef.current ||
      isManualProcessingRef.current
    ) {
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
          "QR invalido",
          "No pudimos leer el codigo QR. Intenta nuevamente.",
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
    height,
    isCameraReady,
    processScannedData,
    scannerLeft,
    scannerSize,
    scannerTop,
    width,
  ]);

  // Show loading while organization data is being fetched
  if (!isOrganizationDataLoaded) {
    return (
      <View style={styles.centeredContent}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.statusText}>
          Cargando información de organización...
        </Text>
      </View>
    );
  }

  // Check for organization after data is loaded
  if (!hasOrganization) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.statusText}>
          Necesitas una organización activa para registrar tu asistencia.
        </Text>
        <Button onPress={() => router.replace("/(protected)/(tabs)")}>
          Volver al inicio
        </Button>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centeredContent}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.statusText}>Verificando permisos de cámara...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.statusText}>
          Se necesitan permisos de cámara para continuar
        </Text>
      </View>
    );
  }

  const shouldRenderCamera = isScreenActive && hasPermission;

  return (
    <View style={styles.screen}>
      <DebugMenu screenName="QR Scanner" />

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
          <Text style={styles.statusText}>Preparando cámara...</Text>
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
    gap: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
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
    gap: 16,
    paddingHorizontal: 24,
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
