import api, { ApiError, NetworkError } from "@/api";
import DebugMenu from "@/components/debug-menu";
import QRScannerOverlay from "@/components/qr-scanner-overlay";
import Button from "@/components/ui/button";
import { useCameraPermission } from "@/hooks/use-camera-permission";
import { useThemeColor } from "@/hooks/use-theme-color";
import { extractQrPayloadFromPhoto } from "@/modules/qr/scan-from-photo";
import { Ionicons } from "@expo/vector-icons";
import { BarcodeScanningResult, CameraView } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
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

export default function ScanVisitor() {
  const { hasPermission, isLoading, requestPermission } = useCameraPermission();
  const primaryColor = useThemeColor({}, "primary");
  const router = useRouter();
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
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScreenActive, setIsScreenActive] = useState(false);
  const [isManualProcessing, setIsManualProcessing] = useState(false);

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

  const processScannedData = useCallback(
    async (scannedData: string) => {
      try {
        const response = await api.validateVisitorQR(scannedData);
        const visitor = response.data;

        if (!visitor || !visitor.id) {
          throw new Error("Datos del visitante no válidos");
        }

        Alert.alert("Visitante Encontrado", `QR válido para: ${visitor.name}`, [
          {
            text: "Ver Detalles",
            onPress: () => {
              router.replace({
                pathname: "/(protected)/visitors",
                params: { visitorId: visitor.id },
              });
            },
          },
        ]);
      } catch (error) {
        console.error("Visitor QR validation failed:", error);

        let errorMessage = "El código QR no es válido para visitantes.";
        let errorTitle = "QR Inválido";

        if (error instanceof NetworkError) {
          errorTitle = "Error de conexión";
          errorMessage =
            "Verifica tu conexión a internet e intenta nuevamente.";
        } else if (error instanceof ApiError) {
          errorMessage = error.message || errorMessage;
        }

        Alert.alert(errorTitle, errorMessage, [
          {
            text: "Intentar nuevamente",
            onPress: () => {
              setTimeout(() => {
                isProcessingRef.current = false;
              }, 1000);
            },
          },
          {
            text: "Cancelar",
            style: "cancel",
            onPress: () => router.back(),
          },
        ]);
      }
    },
    [router],
  );

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

    const { cornerPoints } = event;
    if (cornerPoints && cornerPoints.length > 0) {
      const pointsInside = cornerPoints.reduce((acc, point) => {
        return (
          acc +
          (point.x >= scannerLeft &&
          point.x <= scannerLeft + scannerSize &&
          point.y >= scannerTop &&
          point.y <= scannerTop + scannerSize
            ? 1
            : 0)
        );
      }, 0);

      const percentageInside = pointsInside / cornerPoints.length;
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
    height,
    isCameraReady,
    processScannedData,
    scannerLeft,
    scannerSize,
    scannerTop,
    width,
  ]);

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
        <Button onPress={requestPermission} style={{ marginTop: 20 }}>
          Solicitar Permisos
        </Button>
      </View>
    );
  }

  const shouldRenderCamera = isScreenActive && hasPermission;

  return (
    <View style={styles.screen}>
      <DebugMenu screenName="Visitor Scanner" />

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
            width: scannerSize,
            height: scannerSize,
            borderRadius,
          },
        ]}
      />

      <View
        style={[styles.instructionsContainer, { bottom: insets.bottom + 96 }]}
      >
        <Text style={styles.instructionsTitle}>Escanear Visitante</Text>
        <Text style={styles.instructionsText}>
          Alinea el código QR del visitante dentro del marco
        </Text>
      </View>

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
  },
  centeredContent: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  statusText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
    textAlign: "center",
  },
  cameraStatusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  scanner: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  closeButton: {
    position: "absolute",
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  instructionsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  instructionsTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  instructionsText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    textAlign: "center",
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
