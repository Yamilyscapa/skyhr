import qrcode from "qrcode";
import type { Context } from "hono";
import { errorResponse, successResponse, ErrorCodes } from "../core/http";
import { obfuscateJsonPayload, deobfuscateJsonPayload } from "../utils/obfuscation";
import { createMulterAdapter } from "../modules/storage/adapters/multer-adapter";
import { createStorageService } from "../modules/storage/storage.service";
import { db } from "../db";
import { geofence } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { createS3Adapter } from "../modules/storage/adapters/s3-adapter";

export interface Payload {
  organization_id: string;
  location_id: string;
}

export interface CreateObfuscatedQrCodeRequest {
  organization_id: string;
  location_id: string;
}

export interface DeobfuscateObfuscatedQrCodeRequest {
  obfuscated_data: string;
}

const QR_SECRET = process.env.QR_SECRET
  ? Buffer.from(process.env.QR_SECRET, 'base64').toString('utf8')
  : "skyhr-secret-2024";

const storageAdapter = process.env.NODE_ENV === "development" || !process.env.NODE_ENV ? createMulterAdapter() : createS3Adapter();
const storageService = createStorageService(storageAdapter);

const validateCreateObfuscatedQrCodeRequest = (data: any): data is CreateObfuscatedQrCodeRequest => {
  if (!data || !data.organization_id || !data.location_id) {
    return false;
  }

  return true;
};

const validateDeobfuscateObfuscatedQrCodeRequest = (data: any): data is DeobfuscateObfuscatedQrCodeRequest => {
  if (!data || !data.obfuscated_data) {
    return false;
  }

  return true;
};

export const generateQrCode = async (signedPayload: string): Promise<Buffer> => {
  return qrcode.toBuffer(signedPayload, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8
  });
};

export const createFileFromBuffer = (buffer: Buffer, fileName: string, mimeType: string): File => {
  return new File([buffer], fileName, { type: mimeType });
};

export const createObfuscatedQrCode = async (organization_id: string, location_id: string): Promise<String | null> => {
  try {
    if (!organization_id || !location_id) {
      throw new Error("Organization ID and location ID are required");
    }

    const gf = await db
      .select()
      .from(geofence)
      .where(and(eq(geofence.id, location_id), eq(geofence.organization_id, organization_id), eq(geofence.active, true)))
      .limit(1);

    if (!gf || gf.length === 0) {
      throw new Error("Invalid location for organization or inactive geofence");
    }

    const payload: Payload = {
      organization_id: organization_id,
      location_id: location_id
    };

    // Sign the payload with HMAC-SHA256
    const signed = obfuscateJsonPayload(payload, QR_SECRET);

    const qrBuffer = await generateQrCode(signed);
    const qrFile = createFileFromBuffer(qrBuffer, "qr.png", "image/png");

    const result = await storageService.uploadQr(qrFile, "location", location_id);

    return result.url;
  } catch (error) {
    console.error(`Failed to create signed QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const deobfuscateObfuscatedQrCode = async (c: Context): Promise<Response> => {
  try {
    const data = await c.req.parseBody();

    if (!validateDeobfuscateObfuscatedQrCodeRequest(data)) {
      return errorResponse(c, "Signed data is required", ErrorCodes.BAD_REQUEST);
    }

    try {
      const payload = deobfuscateJsonPayload<Payload>(data.obfuscated_data, QR_SECRET);
      return successResponse(c, {
        message: "QR code verified successfully",
        data: payload
      });
    } catch (verifyError) {
      return errorResponse(
        c,
        `Failed to verify QR code signature: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
        ErrorCodes.BAD_REQUEST
      );
    }
  } catch (error) {
    return errorResponse(
      c,
      `Failed to process verification request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCodes.INTERNAL_SERVER_ERROR
    );
  }
};
