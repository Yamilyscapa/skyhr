import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { errorResponse, successResponse, ErrorCodes } from "../../core/http";
import { createStorageService } from "./storage.service";
import { createMulterAdapter } from "./adapters/multer-adapter";
import { createRailwayAdapter } from "./adapters/railway-adapter";
import { storagePolicies } from "./storage.policies";
import { db } from "../../db";
import { users } from "../../db/schema";
import type { BucketType } from "./adapters/storage-interface";

// Use multer adapter in development, Railway adapter in production
const storageAdapter = process.env.NODE_ENV === "development" || !process.env.NODE_ENV 
  ? createMulterAdapter() 
  : createRailwayAdapter();
const storageService = createStorageService(storageAdapter);

export const registerBiometric = async (c: Context) => {
  const { file } = await c.req.parseBody();
  const policies = storagePolicies();

  const user = c.get("user");
  if (!user) {
    return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
  }

  const currentFaceUrls = user.user_face_url ?? [];

  if (policies.imagesLimit(currentFaceUrls)) {
    return errorResponse(c, "Maximum number of images exceeded", ErrorCodes.BAD_REQUEST);
  }

  if (!file) {
    return errorResponse(c, "No file provided", ErrorCodes.BAD_REQUEST);
  }

  try {
    const result = await storageService.uploadUserFace(
      file as File,
      user.id,
      currentFaceUrls.length,
      "user-face"
    );

    const updatedFaceUrls = [...currentFaceUrls, result.url];

    await db
      .update(users)
      .set({ user_face_url: updatedFaceUrls })
      .where(eq(users.id, user.id));

    return successResponse(c, {
      message: "File uploaded successfully",
      url: result.url,
      fileName: result.fileName,
      user_face_url: updatedFaceUrls,
    });
  } catch (error) {
    console.error('File upload failed:', error);
    return errorResponse(c, "File upload failed", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
};

export const uploadQr = async (c: Context) => {
  const { file, location_id } = await c.req.parseBody<{ file: File, location_id: string }>();

  if (!file || !location_id) {
    return errorResponse(c, "No file provided", ErrorCodes.BAD_REQUEST);
  }

  try {
    const result = await storageService.uploadQr(file, "qr-code", location_id);
    return successResponse(c, {
      message: "QR uploaded successfully",
      url: result.url,
      fileName: result.fileName,
    });
  } catch (error) {
    console.error('QR upload failed:', error);
    return errorResponse(c, "QR upload failed", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Generate a presigned URL for accessing a file from the QR bucket.
 * Used for displaying and downloading QR codes.
 */
export const getQrPresignedUrl = async (c: Context) => {
  const key = c.req.param("key");

  if (!key) {
    return errorResponse(c, "File key is required", ErrorCodes.BAD_REQUEST);
  }

  try {
    const presignedUrl = await storageService.getPresignedUrl(key, "qr");
    return successResponse(c, {
      url: presignedUrl,
      expiresIn: 3600, // 1 hour
    });
  } catch (error) {
    console.error("Failed to generate QR presigned URL:", error);
    return errorResponse(c, "Failed to generate presigned URL", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Generate a presigned URL for accessing a file from the documents bucket.
 * Used for viewing permission documents.
 */
export const getDocumentPresignedUrl = async (c: Context) => {
  const key = c.req.param("key");

  if (!key) {
    return errorResponse(c, "File key is required", ErrorCodes.BAD_REQUEST);
  }

  try {
    const presignedUrl = await storageService.getPresignedUrl(key, "documents");
    return successResponse(c, {
      url: presignedUrl,
      expiresIn: 900, // 15 minutes
    });
  } catch (error) {
    console.error("Failed to generate document presigned URL:", error);
    return errorResponse(c, "Failed to generate presigned URL", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Generate a presigned URL for accessing a file from any bucket.
 * Requires specifying the bucket type.
 */
export const getPresignedUrl = async (c: Context) => {
  const key = c.req.param("key");
  const bucketType = c.req.query("type") as BucketType | undefined;

  if (!key) {
    return errorResponse(c, "File key is required", ErrorCodes.BAD_REQUEST);
  }

  if (!bucketType || !["qr", "biometrics", "documents"].includes(bucketType)) {
    return errorResponse(c, "Valid bucket type is required (qr, biometrics, documents)", ErrorCodes.BAD_REQUEST);
  }

  try {
    const presignedUrl = await storageService.getPresignedUrl(key, bucketType);
    const expiresIn = bucketType === "documents" ? 900 : 3600;
    return successResponse(c, {
      url: presignedUrl,
      expiresIn,
    });
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    return errorResponse(c, "Failed to generate presigned URL", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
};

// Export storage service for use in other modules
export { storageService };
