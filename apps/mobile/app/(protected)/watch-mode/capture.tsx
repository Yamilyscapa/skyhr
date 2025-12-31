import api, { ApiError, NetworkError } from "@/api";
import FaceScannerOverlay from "@/components/face-scanner-overlay";
import ThemedText from "@/components/themed-text";
import Button from "@/components/ui/button";
import { useCameraPermission } from "@/hooks/use-camera-permission";
import { useLocation } from "@/hooks/use-location";
import { calculateScannerPosition, timingConfig } from "@/modules/biometrics/config";
import { CapturedImage } from "@/modules/biometrics/use-cases/continuous-detection";
import { useFaceDetection } from "@/modules/biometrics/use-face-detection";
import { addWatchModeEvent } from "@/modules/watch-mode/events-store";
import { StatusTone } from "@/modules/watch-mode/types";
import { CameraView } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WatchModeCaptureScreen() {
    const router = useRouter();
    const { location_id, organization_id, location_name } = useLocalSearchParams<{
        location_id?: string;
        organization_id?: string;
        location_name?: string;
    }>();

    const { hasPermission, isLoading: isCameraLoading, requestPermission } = useCameraPermission();
    const {
        latitude,
        longitude,
        hasPermission: hasLocationPermission,
        isLoading: isLocationLoading,
        error: locationError,
    } = useLocation();
    const { width, height } = useWindowDimensions();
    const cameraRef = useRef<CameraView | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{ text: string; tone: StatusTone }>({
        text: 'Buscando rostros frente a la cámara…',
        tone: 'idle',
    });

    const locationReady = Boolean(latitude && longitude);

    const statusStyles = useMemo(() => {
        const base = {
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#fff',
        };

        if (status.tone === 'success') {
            return { backgroundColor: 'rgba(15, 157, 88, 0.85)', color: '#fff' };
        }
        if (status.tone === 'warning') {
            return { backgroundColor: 'rgba(245, 158, 11, 0.85)', color: '#000' };
        }
        if (status.tone === 'error') {
            return { backgroundColor: 'rgba(220, 38, 38, 0.85)', color: '#fff' };
        }
        return base;
    }, [status.tone]);

    const handleExit = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(protected)/watch-mode');
        }
    }, [router]);

    const handleDetectionComplete = useCallback(async (image: CapturedImage | null) => {
        if (!image?.base64 || !organization_id || !location_id) {
            return;
        }

        if (!locationReady || !latitude || !longitude) {
            setStatus({ text: 'Esperando la ubicación del dispositivo...', tone: 'warning' });
            return;
        }

        setIsSubmitting(true);
        setStatus({ text: 'Procesando rostro detectado...', tone: 'warning' });

        try {
            const response = await api.watchModeCheckIn({
                organization_id,
                location_id,
                image: image.base64,
                latitude,
                longitude,
            });

            const { event, user } = response.data;
            const recordedAt = new Date(event.check_in ?? new Date().toISOString()).toLocaleTimeString();

            addWatchModeEvent({
                id: event.id,
                userName: user.name,
                status: event.status,
                recordedAt,
                message: response.message,
                distance: event.distance_to_geofence_m,
            });

            setStatus({ text: `Asistencia registrada para ${user.name}.`, tone: 'success' });
            await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
            let message = 'No pudimos registrar la asistencia. Intenta nuevamente.';
            if (error instanceof ApiError || error instanceof NetworkError) {
                message = error.message;
            } else if (error instanceof Error && error.message) {
                message = error.message;
            }
            setStatus({ text: message, tone: 'error' });
            await new Promise((resolve) => setTimeout(resolve, 3000));
        } finally {
            setIsSubmitting(false);
            setStatus({ text: 'Buscando rostros frente a la cámara…', tone: 'idle' });
        }
    }, [organization_id, location_id, latitude, longitude, locationReady]);

    useFaceDetection(cameraRef, {
        enabled: Boolean(
            hasPermission &&
                hasLocationPermission &&
                locationReady &&
                !isSubmitting &&
                organization_id &&
                location_id
        ),
        intervalMs: timingConfig.detectionInterval,
        initDelayMs: timingConfig.cameraInitDelay,
        validatePosition: true,
        onDetectionComplete: handleDetectionComplete,
    });

    useEffect(() => {
        if (!hasPermission && !isCameraLoading) {
            requestPermission();
        }
    }, [hasPermission, isCameraLoading, requestPermission]);

    useEffect(() => {
        if (!organization_id || !location_id) {
            Alert.alert('Modo vigilante', 'No se pudo determinar la ubicación seleccionada.', [
                { text: 'Volver', onPress: handleExit },
            ]);
        }
    }, [organization_id, location_id, handleExit]);

    const scannerDimensions = calculateScannerPosition(width, height);

    if (!organization_id || !location_id) {
        return (
            <SafeAreaView style={styles.blockedContainer}>
                <ThemedText style={styles.blockedText}>
                    Selecciona una ubicación válida para activar el modo vigilante.
                </ThemedText>
                <Button onPress={handleExit}>Volver</Button>
            </SafeAreaView>
        );
    }

    if (!hasPermission) {
        return (
            <SafeAreaView style={styles.blockedContainer}>
                <ThemedText style={styles.blockedText}>
                    Se necesitan permisos de cámara para continuar.
                </ThemedText>
                <Button onPress={requestPermission}>Otorgar permisos</Button>
                <Button type="secondary" onPress={handleExit}>
                    Cancelar
                </Button>
            </SafeAreaView>
        );
    }

    if (isLocationLoading) {
        return (
            <SafeAreaView style={styles.blockedContainer}>
                <ActivityIndicator size="large" color="#0F9D58" />
                <ThemedText style={styles.blockedText}>Obteniendo la ubicación del dispositivo…</ThemedText>
            </SafeAreaView>
        );
    }

    if (!hasLocationPermission || locationError) {
        return (
            <SafeAreaView style={styles.blockedContainer}>
                <ThemedText style={styles.blockedText}>
                    Se necesitan permisos de ubicación para registrar asistencia.
                </ThemedText>
                {locationError && <ThemedText style={styles.errorText}>{locationError}</ThemedText>}
                <Button onPress={handleExit}>Volver</Button>
            </SafeAreaView>
        );
    }

    if (!locationReady) {
        return (
            <SafeAreaView style={styles.blockedContainer}>
                <ActivityIndicator size="large" color="#0F9D58" />
                <ThemedText style={styles.blockedText}>Sin coordenadas disponibles todavía…</ThemedText>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView ref={cameraRef} facing="front" style={styles.camera} />

            <FaceScannerOverlay
                width={width}
                height={height}
                scannerWidth={scannerDimensions.width}
                scannerHeight={scannerDimensions.height}
                scannerTop={scannerDimensions.top}
                scannerLeft={scannerDimensions.left}
            />

            <SafeAreaView style={StyleSheet.absoluteFill}>
                <View style={styles.overlay}>
                    <View style={styles.topBar}>
                        <View style={styles.topBarText}>
                            <Text style={styles.modeTitle}>Modo vigilante activo</Text>
                            {location_name && <Text style={styles.locationText}>{location_name}</Text>}
                        </View>
                        <Pressable onPress={handleExit} style={styles.stopButton}>
                            <Text style={styles.stopButtonText}>Detener</Text>
                        </Pressable>
                    </View>

                    <View style={styles.statusContainer}>
                        <View style={[styles.statusBadge, { backgroundColor: statusStyles.backgroundColor }]}>
                            <Text style={[styles.statusText, { color: statusStyles.color }]}>{status.text}</Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            {isSubmitting && (
                <View style={styles.submittingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.submittingText}>Registrando asistencia...</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        flex: 1,
    },
    topBar: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    topBarText: {
        flex: 1,
        alignItems: 'flex-start',
        paddingRight: 12,
    },
    modeTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'left',
    },
    locationText: {
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
        fontSize: 14,
        textAlign: 'left',
    },
    stopButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    stopButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    statusContainer: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 24,
        alignItems: 'center',
    },
    statusBadge: {
        padding: 16,
        borderRadius: 16,
        maxWidth: '100%',
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    blockedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 16,
        backgroundColor: '#000',
    },
    blockedText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
    },
    errorText: {
        color: '#ff6b6b',
        textAlign: 'center',
    },
    submittingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submittingText: {
        color: '#fff',
        marginTop: 12,
        fontSize: 16,
    },
});
