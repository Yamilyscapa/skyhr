import { Face } from "@react-native-ml-kit/face-detection";
import { defaultPhotoCaptureOptions } from "../config";
import { captureAndDetectFaces } from "./detect-faces";
import { showFaceDetectionAlert } from "./show-alerts";
import { filterValidFaces } from "./validate-face-position";

export interface DetectionContext {
    intervalRef: ReturnType<typeof setInterval> | null;
    isDetecting: boolean;
    isMounted: boolean;
}

export interface CapturedImage {
    uri: string;
    width: number;
    height: number;
    base64?: string;
}

export function createDetectionContext(): DetectionContext {
    return {
        intervalRef: null,
        isDetecting: false,
        isMounted: true,
    };
}

export function startDetection(
    context: DetectionContext,
    cameraRef: any,
    onFacesDetected: (faces: Face[]) => void,
    intervalMs: number = 2000,
    onDetectionComplete?: (image: CapturedImage) => void,
    validatePosition: boolean = false
): DetectionContext {
    const activeContext = stopDetection(context);
    
    activeContext.isMounted = true;
    activeContext.intervalRef = setInterval(async () => {
        await detectFaces(activeContext, cameraRef, onFacesDetected, onDetectionComplete, validatePosition);
    }, intervalMs);
    
    return activeContext;
}

export function stopDetection(context: DetectionContext): DetectionContext {
    if (context.intervalRef) {
        clearInterval(context.intervalRef);
    }
    
    context.intervalRef = null;
    return context;
}

async function detectFaces(
    context: DetectionContext,
    cameraRef: any,
    onFacesDetected: (faces: Face[]) => void,
    onDetectionComplete?: (image: CapturedImage) => void,
    validatePosition: boolean = false
): Promise<void> {
    if (!context.isMounted || !cameraRef || context.isDetecting) {
        return;
    }

    try {
        context.isDetecting = true;
        
        if (!cameraRef || !context.isMounted) {
            return;
        }

        const result = await captureAndDetectFaces(cameraRef);
        
        if (!context.isMounted || !result) {
            return;
        }

        let validFaces = result.faces;

        if (validatePosition && result.imageWidth && result.imageHeight) {
            validFaces = filterValidFaces(result.faces, result.imageWidth, result.imageHeight);
            
            if (result.faces.length > 0 && validFaces.length === 0) {
                console.log('⚠️ Rostro detectado fuera del óvalo del scanner');
            }
        }

        
        onFacesDetected(validFaces);
        
        if (validFaces.length > 0) {
            showFaceDetectionAlert(validFaces.length);
            
            // Capture a high-quality final image when valid face is detected
            if (onDetectionComplete) {
                const finalPhoto = await captureFinalPhoto(cameraRef, validFaces[0], result);
                
                if (finalPhoto) {
                    onDetectionComplete(finalPhoto);
                }
            }
        }
    } catch (error) {
        if (context.isMounted) {
            console.error('Error detecting faces:', error);
        }
    } finally {
        if (context.isMounted) {
            context.isDetecting = false;
        }
    }
}

async function captureFinalPhoto(
    cameraRef: any,
    validFace: Face,
    detectionResult: any
): Promise<CapturedImage | null> {
    try {
        // Check if the face has good quality indicators
        const hasGoodQuality = checkImageQuality(validFace);
        
        if (!hasGoodQuality) {
            console.log('⚠️ La imagen no cumple con los estándares de calidad (posible movimiento o desenfoque)');
            return null;
        }
        
        // Capture a high-quality final photo with base64
        const photo = await cameraRef.takePictureAsync({
            quality: defaultPhotoCaptureOptions.quality,
            base64: true,
        });
        
        if (!photo?.uri) {
            console.warn('⚠️ No se pudo capturar la foto final');
            return null;
        }
        
        console.log('✅ Foto final capturada con éxito (con base64)');
        
        return {
            uri: photo.uri,
            width: photo.width,
            height: photo.height,
            base64: photo.base64,
        };
    } catch (error) {
        console.error('Error capturando foto final:', error);
        return null;
    }
}

function checkImageQuality(face: Face): boolean {
    // Check various quality indicators from ML Kit
    // Face rotation angles - face should be relatively straight
    const maxHeadAngle = 15; // degrees
    
    // Use type assertion to access rotation properties
    const faceWithRotation = face as any;
    const rotationY = Math.abs(faceWithRotation.rotationY ?? 0); // Yaw (left/right turn)
    const rotationZ = Math.abs(faceWithRotation.rotationZ ?? 0); // Roll (tilt)
    const rotationX = Math.abs(faceWithRotation.rotationX ?? 0); // Pitch (up/down)
    
    const isHeadStraight = rotationY < maxHeadAngle && 
                          rotationZ < maxHeadAngle && 
                          rotationX < maxHeadAngle;
    
    // Check if eyes are open (if classification is available)
    const leftEyeOpen = (face.leftEyeOpenProbability ?? 1) > 0.3;
    const rightEyeOpen = (face.rightEyeOpenProbability ?? 1) > 0.3;
    const eyesOpen = leftEyeOpen && rightEyeOpen;
    
    const isGoodQuality = isHeadStraight && eyesOpen;
    
    if (!isGoodQuality) {
        console.log('📊 Análisis de calidad de imagen:', {
            rotationY: rotationY.toFixed(1) + '° (yaw)',
            rotationZ: rotationZ.toFixed(1) + '° (roll)',
            rotationX: rotationX.toFixed(1) + '° (pitch)',
            isHeadStraight,
            leftEyeOpen: (face.leftEyeOpenProbability ?? 1).toFixed(2),
            rightEyeOpen: (face.rightEyeOpenProbability ?? 1).toFixed(2),
            eyesOpen,
        });
    }
    
    return isGoodQuality;
}

export function cleanupDetection(context: DetectionContext): DetectionContext {
    const cleanContext = stopDetection(context);
    cleanContext.isMounted = false;
    cleanContext.isDetecting = false;
    
    return cleanContext;
}
