import api, { ApiError, NetworkError } from "@/api";
import DebugMenu from "@/components/debug-menu";
import FaceScannerOverlay from "@/components/face-scanner-overlay";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCameraPermission } from "@/hooks/use-camera-permission";
import { useLocation } from "@/hooks/use-location";
import { calculateScannerPosition, timingConfig } from "@/modules/biometrics/config";
import { CapturedImage } from "@/modules/biometrics/use-cases/continuous-detection";
import { useFaceDetection } from "@/modules/biometrics/use-face-detection";
import { CameraView } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, useWindowDimensions, View } from "react-native";

export default function BiometricsScanner() {
    const { hasPermission, isLoading, requestPermission } = useCameraPermission();
    const { width, height } = useWindowDimensions();
    const cameraRef = useRef<any>(null);
    const [isCaptureDone, setIsCaptureDone] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const router = useRouter();
    const { location_id, organization_id } = useLocalSearchParams<{
        location_id?: string;
        organization_id?: string;
    }>();

    const { latitude, longitude, hasPermission: hasLocationPermission, isLoading: isLocationLoading, error: locationError } = useLocation();
    const { activeOrganization, organizations } = useAuth();

    // Wait for organization data to finish loading before making decisions
    const isOrganizationDataLoaded = !activeOrganization.isPending && !organizations.isPending;
    const hasOrganization = Boolean(activeOrganization.data) || (organizations.data?.length ?? 0) > 0;

    useEffect(() => {
        if (!location_id || !organization_id) {
            Alert.alert('QR invalido', 'El codigo QR no es correcto, intente nuevamente');
            router.replace('/(protected)/qr-scanner');
        }
    }, [location_id, organization_id, router]);

    const handleDetectionComplete = useCallback(async (image: CapturedImage) => {
        if (!hasOrganization) {
            Alert.alert('Sin organización activa', 'Debes pertenecer a una organización para registrar asistencia.');
            return;
        }
        if (!image.base64 || !location_id || !organization_id) {
            Alert.alert('Error', 'Datos incompletos para registrar asistencia');
            return;
        }

        if (!latitude || !longitude) {
            Alert.alert('Error de ubicación', 'No se pudo obtener tu ubicación. Asegúrate de haber otorgado permisos de ubicación.');
            return;
        }

        setIsCaptureDone(true);
        setIsSubmitting(true);

        try {
            const response = await api.checkIn({
                organization_id,
                location_id,
                image: image.base64,
                latitude,
                longitude,
            });

            // Check for spoof flag and show warning if detected
            if (response.data.spoof_flag) {
                Alert.alert(
                    'Advertencia de verificación',
                    'El sistema detectó posibles problemas con la calidad de la imagen. Por favor, intenta nuevamente con mejor iluminación y asegúrate de usar la cámara en vivo, no una foto.',
                    [
                        {
                            text: 'Reintentar',
                            onPress: () => {
                                setIsCaptureDone(false);
                                setIsSubmitting(false);
                            },
                        },
                        {
                            text: 'Continuar',
                            style: 'cancel',
                            onPress: () => router.replace('/(protected)/(tabs)'),
                        },
                    ]
                );
            } else {
                // Optional: Log liveness score for debugging/monitoring
                const livenessScore = response.data.liveness_score;
                const score = livenessScore ? parseFloat(livenessScore) : null;
                
                if (score !== null) {
                    console.log(`Check-in successful. Liveness score: ${score.toFixed(1)}`);
                    
                    // Provide user feedback based on liveness score
                    let feedbackMessage = 'Tu entrada ha sido registrada exitosamente';
                    if (score < 50) {
                        feedbackMessage += '\n\nNota: La calidad de la imagen fue baja. Asegúrate de tener buena iluminación.';
                    } else if (score < 70) {
                        feedbackMessage += '\n\nNota: La calidad de la imagen es aceptable pero podría ser mejor.';
                    }
                    
                    Alert.alert(
                        'Asistencia registrada',
                        feedbackMessage,
                        [
                            {
                                text: 'OK',
                                onPress: () => router.replace('/(protected)/(tabs)'),
                            },
                        ]
                    );
                } else {
                    Alert.alert(
                        'Asistencia registrada',
                        'Tu entrada ha sido registrada exitosamente',
                        [
                            {
                                text: 'OK',
                                onPress: () => router.replace('/(protected)/(tabs)'),
                            },
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('Check-in error:', error);
            
            let errorMessage = 'No se pudo registrar la asistencia. Intenta nuevamente.';
            if (error instanceof NetworkError) {
                errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
            } else if (error instanceof ApiError) {
                errorMessage = error.message || errorMessage;
            } else if (error instanceof Error) {
                errorMessage = error.message || errorMessage;
            }
            
            Alert.alert('Error', errorMessage);
            setIsCaptureDone(false);
            // Only navigate back if it's not a network error (user might want to retry)
            if (!(error instanceof NetworkError)) {
                router.replace('/(protected)/qr-scanner');
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [hasOrganization, location_id, organization_id, latitude, longitude, router]);

    useFaceDetection(cameraRef, {
        enabled: hasPermission && !isCaptureDone && hasOrganization,
        intervalMs: timingConfig.detectionInterval,
        initDelayMs: timingConfig.cameraInitDelay,
        validatePosition: true,
        onDetectionComplete: handleDetectionComplete,
    });

    useEffect(() => {
        if (!hasPermission && !isLoading) {
            requestPermission();
        }
    }, [hasPermission, isLoading, requestPermission]);

    const scannerDimensions = calculateScannerPosition(width, height);

    // Show loading while organization data is being fetched
    if (!isOrganizationDataLoaded) {
        return (
            <View style={styles.blockedContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.permissionText}>
                    Cargando información de organización...
                </Text>
            </View>
        );
    }

    // Check for organization after data is loaded
    if (!hasOrganization) {
        return (
            <View style={styles.blockedContainer}>
                <Text style={styles.permissionText}>
                    Necesitas una organización activa para registrar asistencia.
                </Text>
                <Button onPress={() => router.replace('/(protected)/(tabs)')}>Volver al inicio</Button>
            </View>
        );
    }

    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>
                    Se necesitan permisos de cámara
                </Text>
            </View>
        );
    }

    if (isLocationLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.permissionText}>
                    Obteniendo ubicación...
                </Text>
            </View>
        );
    }

    if (!hasLocationPermission || locationError) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>
                    Se necesitan permisos de ubicación para registrar asistencia
                </Text>
                {locationError && (
                    <Text style={styles.errorText}>
                        {locationError}
                    </Text>
                )}
            </View>
        );
    }

    return <>
        <DebugMenu screenName="Biometrics Scanner" />

        <CameraView
            ref={cameraRef}
            facing="front"
            style={styles.container}
        />

        <FaceScannerOverlay
            width={width}
            height={height}
            scannerWidth={scannerDimensions.width}
            scannerHeight={scannerDimensions.height}
            scannerTop={scannerDimensions.top}
            scannerLeft={scannerDimensions.left}
        />

        {isSubmitting && (
            <View style={styles.submittingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.submittingText}>
                    Registrando asistencia...
                </Text>
            </View>
        )}
    </>
}

const styles = StyleSheet.create({
    container: {
        height: '100%',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    blockedContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        gap: 16,
    },
    permissionText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
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
    successOverlay: {
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 200, 0, 0.9)',
        padding: 20,
        alignItems: 'center',
    },
    successText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    successSubtext: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        textAlign: 'center',
    },
});
