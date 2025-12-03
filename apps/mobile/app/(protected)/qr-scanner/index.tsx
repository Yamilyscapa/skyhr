import api, { ApiError, NetworkError } from "@/api";
import DebugMenu from "@/components/debug-menu";
import QRScannerOverlay from "@/components/qr-scanner-overlay";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCameraPermission } from "@/hooks/use-camera-permission";
import { BarcodeScanningResult, CameraView } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, useWindowDimensions, View } from "react-native";

export default function QRScanner() {
    const { hasPermission, isLoading, requestPermission } = useCameraPermission();
    const { activeOrganization, organizations } = useAuth();
    const { width, height } = useWindowDimensions();
    
    // Wait for organization data to finish loading before making decisions
    const isOrganizationDataLoaded = !activeOrganization.isPending && !organizations.isPending;
    const hasOrganization = Boolean(activeOrganization.data) || (organizations.data?.length ?? 0) > 0;
    const isProcessingRef = useRef(false);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isScreenActive, setIsScreenActive] = useState(false);

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

            return () => {
                setIsScreenActive(false);
                setIsCameraReady(false);
                isProcessingRef.current = false;
            };
        }, [])
    );

    const handleBarcodeScanned = async (event: BarcodeScanningResult) => {
        // Use ref for immediate synchronous check to prevent race conditions
        if (isProcessingRef.current || !isCameraReady) return;

        const scannerWidth = 250;
        const scannerHeight = 250;
        const distanceFromTop = 0.30;

        const scannerLeft = (width - scannerWidth) / 2;
        const scannerTop = height * distanceFromTop - scannerHeight / 2;
        const scannerRight = scannerLeft + scannerWidth;
        const scannerBottom = scannerTop + scannerHeight;

        // Verificar si al menos el 80% del código QR está dentro del área del scanner
        if (event.cornerPoints && event.cornerPoints.length > 0) {
            // Contar cuántos puntos del código QR están dentro del área
            const pointsInside = event.cornerPoints.filter(point => {
                return point.x >= scannerLeft &&
                    point.x <= scannerRight &&
                    point.y >= scannerTop &&
                    point.y <= scannerBottom;
            }).length;

            const percentageInside = pointsInside / event.cornerPoints.length;

            if (percentageInside >= 0.8) {
                // Set ref immediately to block subsequent scans
                isProcessingRef.current = true;

                const scannedData = event.data;
                if (!scannedData) {
                    isProcessingRef.current = false;
                    return;
                }

                // Send QR data to API for validation
                try {
                    const { data } = await api.validateQR(scannedData);
                    const { location_id, organization_id } = data;

                    if (!location_id || !organization_id) {
                        Alert.alert(
                            'QR invalido',
                            'El codigo QR no es correcto, intente nuevamente',
                            [
                                {
                                    text: 'OK',
                                    onPress: () => {
                                        isProcessingRef.current = false;
                                    }
                                }
                            ]
                        );
                        return;
                    }

                    router.push(`/(protected)/biometrics-scanner?location_id=${location_id}&organization_id=${organization_id}`);
                } catch (error) {
                    console.error('QR validation failed:', error);
                    
                    let errorMessage = 'El codigo QR no es correcto, intente nuevamente';
                    if (error instanceof NetworkError) {
                        errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
                    } else if (error instanceof ApiError) {
                        errorMessage = error.message || errorMessage;
                    } else if (error instanceof Error) {
                        errorMessage = error.message || errorMessage;
                    }
                    
                    Alert.alert(
                        error instanceof NetworkError ? 'Error de conexión' : 'QR invalido',
                        errorMessage,
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    isProcessingRef.current = false;
                                }
                            }
                        ]
                    );
                }
            }
        }
    }

    // Show loading while organization data is being fetched
    if (!isOrganizationDataLoaded) {
        return (
            <View style={styles.centeredContent}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.statusText}>Cargando información de organización...</Text>
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
                <Button onPress={() => router.replace('/(protected)/(tabs)')}>Volver al inicio</Button>
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
                <Text style={styles.statusText}>Se necesitan permisos de cámara para continuar</Text>
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
            <DebugMenu screenName="QR Scanner" />

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
            }]} />
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
        gap: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
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
        gap: 16,
        paddingHorizontal: 24,
    },
});
