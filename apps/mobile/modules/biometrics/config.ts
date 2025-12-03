import { FaceDetectionOptions, OvalBounds, PhotoCaptureOptions, ScannerDimensions } from "./types";

export const defaultFaceDetectionOptions: FaceDetectionOptions = {
    performanceMode: 'accurate',
    landmarkMode: 'all',
    contourMode: 'all',
    classificationMode: 'all',
    minFaceSize: 0.05,
};

export const defaultPhotoCaptureOptions: PhotoCaptureOptions = {
    quality: 0.8,
    base64: true,
};

export const imageProcessingConfig = {
    resizeWidth: 900,
    compressionQuality: 0.8,
} as const;

export const timingConfig = {
    cameraInitDelay: 500,
    detectionInterval: 1000,
} as const;

export const scannerDimensions = {
    width: 280,
    height: 360,
    distanceFromTop: 0.35,
} as const;

export function calculateScannerPosition(
    screenWidth: number,
    screenHeight: number
): ScannerDimensions {
    const { width, height, distanceFromTop } = scannerDimensions;
    
    const top = screenHeight * distanceFromTop - height / 2;
    const left = (screenWidth - width) / 2;
    
    return {
        width,
        height,
        top,
        left,
    };
}

export function calculateOvalBounds(
    screenWidth: number,
    screenHeight: number
): OvalBounds {
    const scannerDimensions = calculateScannerPosition(screenWidth, screenHeight);
    
    const centerX = scannerDimensions.left + scannerDimensions.width / 2;
    const centerY = scannerDimensions.top + scannerDimensions.height / 2;
    const radiusX = scannerDimensions.width / 2;
    const radiusY = scannerDimensions.height / 2;
    
    return {
        centerX,
        centerY,
        radiusX,
        radiusY,
    };
}

