import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { imageProcessingConfig } from "../config";

export interface ProcessedPhoto {
    uri: string;
    width: number;
    height: number;
}

export async function processImageForDetection(imageUri: string): Promise<ProcessedPhoto> {
    try {
        const resizedImage = await manipulateAsync(
            imageUri,
            [{ resize: { width: imageProcessingConfig.resizeWidth } }],
            {
                compress: imageProcessingConfig.compressionQuality,
                format: SaveFormat.JPEG
            }
        );

        return {
            uri: resizedImage.uri,
            width: resizedImage.width,
            height: resizedImage.height,
        };
    } catch (error) {
        console.error('Error processing image for detection:', error);
        throw new Error('No se pudo procesar la imagen. Intenta nuevamente.');
    }
}

export function normalizeImageUri(uri: string): string {
    const normalizedUri = uri.startsWith('file://')
        ? uri
        : `file://${uri}`;

    return normalizedUri;
}

export async function captureAndProcessPhoto(
    cameraRef: any,
    options: { quality?: number; base64?: boolean } = {}
): Promise<ProcessedPhoto | null> {
    if (!cameraRef) {
        console.warn('⚠️ No hay referencia a la cámara');
        return null;
    }

    try {
        const photo = await cameraRef.takePictureAsync({
            quality: options.quality ?? 0.7,
            base64: options.base64 ?? false,
        });

        if (!photo?.uri) {
            console.warn('⚠️ No se obtuvo URI de la foto');
            return null;
        }

        const processedImage = await processImageForDetection(photo.uri);

        return {
            uri: normalizeImageUri(processedImage.uri),
            width: processedImage.width,
            height: processedImage.height,
        };
    } catch (error) {
        console.error('Error capturing and processing photo:', error);
        return null;
    }
}

