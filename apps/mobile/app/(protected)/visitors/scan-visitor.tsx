import api, { ApiError, NetworkError } from "@/api";
import DebugMenu from "@/components/debug-menu";
import QRScannerOverlay from "@/components/qr-scanner-overlay";
import Button from "@/components/ui/button";
import { useCameraPermission } from "@/hooks/use-camera-permission";
import { Ionicons } from "@expo/vector-icons";
import { BarcodeScanningResult, CameraView } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ScanVisitor() {
    const { hasPermission, isLoading, requestPermission } = useCameraPermission();
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isProcessingRef = useRef(false);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isScreenActive, setIsScreenActive] = useState(false);

    useFocusEffect(
        useCallback(() => {
            setIsScreenActive(true);
            isProcessingRef.current = false;
            return () => {
                setIsScreenActive(false);
                isProcessingRef.current = false;
            };
        }, [])
    );

    const handleBarcodeScanned = async (event: BarcodeScanningResult) => {
        if (isProcessingRef.current || !isCameraReady) return;

        // Additional check to prevent duplicate scans
        const { cornerPoints, bounds } = event;
        if (cornerPoints && cornerPoints.length > 0) {
            const pointsInside = cornerPoints.reduce((acc, point) => {
                return acc + (
                    point.x >= scannerLeft &&
                    point.x <= scannerLeft + scannerSize &&
                    point.y >= scannerTop &&
                    point.y <= scannerTop + scannerSize ? 1 : 0
                );
            }, 0);

            const percentageInside = pointsInside / cornerPoints.length;

            if (percentageInside < 0.8) {
                // QR not fully inside the box, ignore
                return;
            }
        }

        isProcessingRef.current = true;
        const scannedData = event.data;

        if (!scannedData) {
            isProcessingRef.current = false;
            return;
        }

        try {
            const response = await api.validateVisitorQR(scannedData);
            const visitor = response.data;

            if (!visitor || !visitor.id) {
                throw new Error("Datos del visitante no válidos");
            }

            Alert.alert(
                "Visitante Encontrado",
                `QR válido para: ${visitor.name}`,
                [
                    {
                        text: "Ver Detalles",
                        onPress: () => {
                            router.replace({
                                pathname: "/(protected)/visitors",
                                params: { visitorId: visitor.id }
                            });
                        }
                    }
                ]
            );

        } catch (error) {
            console.error('Visitor QR validation failed:', error);
            
            let errorMessage = 'El código QR no es válido para visitantes.';
            let errorTitle = 'QR Inválido';

            if (error instanceof NetworkError) {
                errorTitle = 'Error de conexión';
                errorMessage = 'Verifica tu conexión a internet e intenta nuevamente.';
            } else if (error instanceof ApiError) {
                errorMessage = error.message || errorMessage;
            }

            Alert.alert(
                errorTitle,
                errorMessage,
                [
                    {
                        text: 'Intentar nuevamente',
                        onPress: () => {
                            // Small delay to prevent immediate rescanning of the same invalid QR
                            setTimeout(() => {
                                isProcessingRef.current = false;
                            }, 1000);
                        }
                    },
                    {
                        text: 'Cancelar',
                        style: 'cancel',
                        onPress: () => router.back()
                    }
                ]
            );
        }
    };

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
                <Text style={styles.statusText}>Se necesitan permisos de cámara para continuar</Text>
                <Button onPress={requestPermission} style={{ marginTop: 20 }}>
                    Solicitar Permisos
                </Button>
            </View>
        );
    }

    const scannerSize = 250;
    const scannerTop = height * 0.30 - scannerSize / 2;
    const scannerLeft = (width - scannerSize) / 2;
    const borderRadius = 16;

    const shouldRenderCamera = isScreenActive && hasPermission;

    return (
        <View style={styles.screen}>
            <DebugMenu screenName="Visitor Scanner" />
            
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

            <View style={[styles.scanner, {
                top: scannerTop,
                left: scannerLeft,
                width: scannerSize,
                height: scannerSize,
                borderRadius: borderRadius,
            }]} />

            <TouchableOpacity 
                style={[styles.closeButton, { top: insets.top + 10 }]}
                onPress={() => router.back()}
            >
                <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>

            <View style={[styles.instructionsContainer, { bottom: insets.bottom + 80 }]}>
                <Text style={styles.instructionsTitle}>Escanear Visitante</Text>
                <Text style={styles.instructionsText}>
                    Alinea el código QR del visitante dentro del marco
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#000',
    },
    centeredContent: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    statusText: {
        color: '#fff',
        marginTop: 10,
        fontSize: 16,
        textAlign: 'center',
    },
    cameraStatusOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    scanner: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: 'transparent',
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    instructionsContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    instructionsTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    instructionsText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        textAlign: 'center',
    }
});

