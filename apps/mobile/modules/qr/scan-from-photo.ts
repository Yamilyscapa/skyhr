import { scanFromURLAsync } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

interface ScannerFrame {
  left: number;
  top: number;
  size: number;
}

interface ExtractQrPayloadFromPhotoOptions {
  photoUri: string;
  photoWidth: number;
  photoHeight: number;
  previewWidth: number;
  previewHeight: number;
  scannerFrame: ScannerFrame;
}

function normalizeQrPayload(payload: unknown): string | null {
  if (typeof payload !== "string") {
    return null;
  }

  const normalized = payload.trim();
  return normalized.length > 0 ? normalized : null;
}

function getCropRectFromScannerFrame(
  options: ExtractQrPayloadFromPhotoOptions,
) {
  const {
    previewWidth,
    previewHeight,
    photoWidth,
    photoHeight,
    scannerFrame: { left, top, size },
  } = options;

  const mappedX = Math.round((left / previewWidth) * photoWidth);
  const mappedY = Math.round((top / previewHeight) * photoHeight);
  const mappedWidth = Math.round((size / previewWidth) * photoWidth);
  const mappedHeight = Math.round((size / previewHeight) * photoHeight);

  const originX = Math.max(0, Math.min(photoWidth - 1, mappedX));
  const originY = Math.max(0, Math.min(photoHeight - 1, mappedY));
  const width = Math.max(40, Math.min(mappedWidth, photoWidth - originX));
  const height = Math.max(40, Math.min(mappedHeight, photoHeight - originY));

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    originX,
    originY,
    width,
    height,
  };
}

async function readQrPayloadFromImage(
  imageUri: string,
): Promise<string | null> {
  const results = await scanFromURLAsync(imageUri, ["qr"]);

  for (const result of results) {
    const payload = normalizeQrPayload(result.data);
    if (payload) {
      return payload;
    }
  }

  return null;
}

export async function extractQrPayloadFromPhoto(
  options: ExtractQrPayloadFromPhotoOptions,
): Promise<string | null> {
  const cropRect = getCropRectFromScannerFrame(options);

  if (cropRect) {
    try {
      const croppedImage = await manipulateAsync(
        options.photoUri,
        [{ crop: cropRect }],
        { compress: 1, format: SaveFormat.JPEG },
      );

      const croppedPayload = await readQrPayloadFromImage(croppedImage.uri);
      if (croppedPayload) {
        return croppedPayload;
      }
    } catch {
      // Fallback to full image scanning below.
    }
  }

  return readQrPayloadFromImage(options.photoUri);
}
