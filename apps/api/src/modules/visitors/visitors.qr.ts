import { obfuscateJsonPayload, deobfuscateJsonPayload } from "../../utils/obfuscation";
import { generateQrCode, createFileFromBuffer } from "../../utils/qr-generation";
import { createStorageService } from "../storage/storage.service";
import { createMulterAdapter } from "../storage/adapters/multer-adapter";
import { createS3Adapter } from "../storage/adapters/s3-adapter";

const QR_SECRET = process.env.QR_SECRET
    ? Buffer.from(process.env.QR_SECRET, 'base64').toString('utf8')
    : "skyhr-secret-2024";

const storageAdapter = process.env.NODE_ENV === "development" || !process.env.NODE_ENV ? createMulterAdapter() : createS3Adapter();
const storageService = createStorageService(storageAdapter);

export interface VisitorQrPayload {
    id: string;
    organizationId: string;
    name: string;
    entryDate: Date;
    exitDate: Date;
    accessAreas: string[];
}

export const generateVisitorQrPayload = (visitor: VisitorQrPayload): string => {
    return obfuscateJsonPayload(visitor, QR_SECRET);
};

export const validateVisitorQrPayload = (qrData: string): VisitorQrPayload => {
    return deobfuscateJsonPayload<VisitorQrPayload>(qrData, QR_SECRET);
};

export const storeVisitorQr = async (organizationId: string, visitorId: string, qrBuffer: Buffer): Promise<string> => {
    const qrFile = createFileFromBuffer(qrBuffer, "qr.png", "image/png");
    // Using visitorId as the relationId for storage
    const result = await storageService.uploadQr(qrFile, "visitor", visitorId);
    return result.url;
};

export const generateAndStoreVisitorQr = async (visitor: VisitorQrPayload): Promise<string | null> => {
    try {
        const payload = generateVisitorQrPayload(visitor);
        const qrBuffer = await generateQrCode(payload);
        const url = await storeVisitorQr(visitor.organizationId, visitor.id, qrBuffer);
        return url;
    } catch (error) {
        console.error(`Failed to generate/store visitor QR: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
};
