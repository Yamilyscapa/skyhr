import { Face } from "@react-native-ml-kit/face-detection";

export interface FaceDetectionResult {
    faces: Face[];
    imageUri: string;
    imageWidth?: number;
    imageHeight?: number;
}

export interface FaceDetectionOptions {
    performanceMode?: 'fast' | 'accurate';
    landmarkMode?: 'none' | 'all';
    contourMode?: 'none' | 'all';
    classificationMode?: 'none' | 'all';
    minFaceSize?: number;
}

export interface ScannerDimensions {
    width: number;
    height: number;
    top: number;
    left: number;
}

export interface PhotoCaptureOptions {
    quality?: number;
    base64?: boolean;
}

export interface OvalBounds {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
}

