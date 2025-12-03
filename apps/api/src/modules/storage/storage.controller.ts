import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { errorResponse, successResponse, ErrorCodes } from "../../core/http";
import { createStorageService } from "./storage.service";
import { createMulterAdapter } from "./adapters/multer-adapter";
import { createS3Adapter } from "./adapters/s3-adapter";
import { storagePolicies } from "./storage.policies";
import { db } from "../../db";
import { users } from "../../db/schema";

// Use multer or s3 adapter, depending on the environment
const storageAdapter = process.env.NODE_ENV === "development" || !process.env.NODE_ENV ? createMulterAdapter() : createS3Adapter();
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
  const policies = storagePolicies();

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
