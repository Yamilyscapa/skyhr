import { Face } from "@react-native-ml-kit/face-detection";
import { useEffect, useRef, useState } from "react";
import {
    CapturedImage,
    cleanupDetection,
    createDetectionContext,
    startDetection,
} from "./use-cases/continuous-detection";

interface UseFaceDetectionOptions {
    enabled?: boolean;
    intervalMs?: number;
    initDelayMs?: number;
    onDetectionComplete?: (image: CapturedImage) => void;
    validatePosition?: boolean;
}

export function useFaceDetection(
    cameraRef: React.RefObject<any>,
    options: UseFaceDetectionOptions = {}
) {
    const {
        enabled = true,
        intervalMs = 2000,
        initDelayMs = 2000,
        onDetectionComplete,
        validatePosition = false,
    } = options;

    const [faces, setFaces] = useState<Face[]>([]);
    const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null);
    const detectionContextRef = useRef(createDetectionContext());

    function handleDetectionComplete(image: CapturedImage) {
        setCapturedImage(image);

        if (onDetectionComplete) {
            onDetectionComplete(image);
        }
    }
    
    useEffect(() => {
        if (!enabled || !cameraRef.current) {
            return;
        }

        const timeout = setTimeout(() => {
            detectionContextRef.current = startDetection(
                detectionContextRef.current,
                cameraRef.current,
                setFaces,
                intervalMs,
                handleDetectionComplete,
                validatePosition
            );
        }, initDelayMs);

        return () => {
            clearTimeout(timeout);
            detectionContextRef.current = cleanupDetection(
                detectionContextRef.current
            );
        };
    }, [enabled, cameraRef, intervalMs, initDelayMs, handleDetectionComplete, validatePosition]);

    return { faces, capturedImage };
}
