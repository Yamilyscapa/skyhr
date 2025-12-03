import { useCameraPermissions } from "expo-camera";
import { useEffect, useState } from "react";

export function useCameraPermission() {
    const [permission, requestPermission] = useCameraPermissions();
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (permission?.status === 'granted') {
            setHasPermission(true);
            setError(null);
        } else if (permission?.status === 'denied') {
            setHasPermission(false);
            setError(null);
        }
    }, [permission]);

    const requestCameraPermission = async () => {
        try {
            setError(null);
            const result = await requestPermission();
            return result.granted;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error al solicitar permisos de cámara';
            setError(errorMessage);
            console.error('Error requesting camera permission:', err);
            return false;
        }
    };

    return {
        hasPermission,
        isLoading: permission === null,
        isDenied: permission?.status === 'denied',
        error,
        requestPermission: requestCameraPermission,
    };
}

