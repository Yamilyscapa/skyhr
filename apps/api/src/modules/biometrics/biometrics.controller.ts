import type { Context } from "hono";
import { successResponse, errorResponse } from "../../core/http";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { createMulterAdapter } from "../storage/adapters/multer-adapter";
import { createS3Adapter } from "../storage/adapters/s3-adapter";
import { createStorageService } from "../storage/storage.service";
import { storagePolicies } from "../storage/storage.policies";
import { 
  compareFaces as compareFacesService,
  detectFaces as detectFacesService,
  indexFace as indexFaceService,
  indexFaceForOrganization as indexFaceForOrganizationService,
  indexFaceForOrganizationWithEnsure as indexFaceForOrganizationWithEnsureService,
  searchFacesByImage as searchFacesByImageService,
  searchFacesByImageForOrganization as searchFacesByImageForOrganizationService,
  testConnection as testConnectionService
} from "./biometrics.service";

const storageAdapter = process.env.NODE_ENV === "development" || !process.env.NODE_ENV ? createMulterAdapter() : createS3Adapter();
const storageService = createStorageService(storageAdapter);

export async function compareFaces(c: Context) {
  try {
    const formData = await c.req.formData();
    const sourceImage = formData.get('sourceImage') as File;
    const targetImage = formData.get('targetImage') as File;

    if (!sourceImage || !targetImage) {
      return errorResponse(c, "Both source and target images are required", 400);
    }

    const sourceBuffer = Buffer.from(await sourceImage.arrayBuffer());
    const targetBuffer = Buffer.from(await targetImage.arrayBuffer());

    const result = await compareFacesService(sourceBuffer, targetBuffer);

    return successResponse(c, {
      message: "Face comparison completed",
      data: result,
    });
  } catch (error) {
    console.error("Face comparison error:", error);
    return errorResponse(c, "Face comparison failed", 500);
  }
}

export async function detectFaces(c: Context) {
  try {
    const formData = await c.req.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return errorResponse(c, "Image is required", 400);
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const result = await detectFacesService(imageBuffer);

    return successResponse(c, {
      message: "Face detection completed",
      data: result,
    });
  } catch (error) {
    console.error("Face detection error:", error);
    return errorResponse(c, "Face detection failed", 500);
  }
}

export async function indexFace(c: Context) {
  try {
    const formData = await c.req.formData();
    const image = formData.get('image') as File;
    const externalImageId = formData.get('externalImageId') as string;
    
    if (!image || !externalImageId) {
      return errorResponse(c, "Image and external image ID are required", 400);
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const result = await indexFaceService(imageBuffer, externalImageId);

    return successResponse(c, {
      message: "Face indexing completed",
      data: result,
    });
  } catch (error) {
    console.error("Face indexing error:", error);
    return errorResponse(c, "Face indexing failed", 500);
  }
}

export async function searchFaces(c: Context) {
  try {
    const formData = await c.req.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return errorResponse(c, "Image is required", 400);
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const result = await searchFacesByImageService(imageBuffer);

    return successResponse(c, {
      message: "Face search completed",
      data: result,
    });
  } catch (error) {
    console.error("Face search error:", error);
    return errorResponse(c, "Face search failed", 500);
  }
}

export async function testConnection(c: Context) {
  try {
    const isConnected = await testConnectionService();
    
    return successResponse(c, {
      message: "Rekognition connection test completed",
      data: { connected: isConnected },
    });
  } catch (error) {
    console.error("Connection test error:", error);
    return errorResponse(c, "Connection test failed", 500);
  }
}

export async function indexFaceForOrganization(c: Context) {
  try {
    const formData = await c.req.formData();
    const image = formData.get('image') as File;
    const externalImageId = formData.get('externalImageId') as string;
    const organizationId = formData.get('organizationId') as string;

    if (!image || !externalImageId || !organizationId) {
      return errorResponse(c, "Image, external image ID, and organization ID are required", 400);
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const result = await indexFaceForOrganizationService(imageBuffer, externalImageId, organizationId);

    return successResponse(c, {
      message: "Face indexing for organization completed",
      data: result,
    });
  } catch (error) {
    console.error("Organization face indexing error:", error);
    return errorResponse(c, "Organization face indexing failed", 500);
  }
}

export async function searchFacesForOrganization(c: Context) {
  try {
    const formData = await c.req.formData();
    const image = formData.get('image') as File;
    const organizationId = formData.get('organizationId') as string;

    if (!image || !organizationId) {
      return errorResponse(c, "Image and organization ID are required", 400);
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const result = await searchFacesByImageForOrganizationService(imageBuffer, organizationId);

    return successResponse(c, {
      message: "Face search for organization completed",
      data: result,
    });
  } catch (error) {
    console.error("Organization face search error:", error);
    return errorResponse(c, "Organization face search failed", 500);
  }
}

export async function registerUserBiometrics(c: Context) {
  try {
    const formData = await c.req.formData();
    const image = formData.get('image') as File;
    
    if (!image) {
      return errorResponse(c, "Image is required", 400);
    }

    const policies = storagePolicies();

    if (image.size > policies.userFace.maxSize) {
      return errorResponse(c, "File exceeds maximum size", 400);
    }

    if (image.type && !policies.userFace.allowedTypes.includes(image.type)) {
      return errorResponse(c, "File type not supported", 400);
    }

    // Get user information from context (set by auth middleware)
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user || !organization) {
      return errorResponse(c, "User and organization information not available", 401);
    }

    const currentFaceUrls = user.user_face_url ?? [];

    if (policies.imagesLimit(currentFaceUrls)) {
      return errorResponse(c, "Maximum number of images exceeded", 400);
    }

    // Use user ID as external image ID for biometric registration
    const externalImageId = user.id;
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    
    // Register biometrics for the user's organization (with automatic collection creation)
    const result = await indexFaceForOrganizationWithEnsureService(imageBuffer, externalImageId, organization.id);

    let updatedFaceUrls = currentFaceUrls;

    if (result.success) {
      const uploadResult = await storageService.uploadUserFace(
        image,
        user.id,
        currentFaceUrls.length,
        "user-face"
      );

      updatedFaceUrls = [...currentFaceUrls, uploadResult.url];

      await db
        .update(users)
        .set({ user_face_url: updatedFaceUrls })
        .where(eq(users.id, user.id));

      user.user_face_url = updatedFaceUrls;
    }

    return successResponse(c, {
      message: "User biometrics registered successfully for organization",
      data: {
        ...result,
        userId: user.id,
        organizationId: organization.id,
        organizationName: organization.name,
        user_face_url: updatedFaceUrls,
      },
    });
  } catch (error) {
    console.error("User biometric registration error:", error);
    return errorResponse(c, "User biometric registration failed", 500);
  }
}

export async function searchUserBiometrics(c: Context) {
  try {
    const formData = await c.req.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return errorResponse(c, "Image is required", 400);
    }

    // Get organization information from context (set by auth middleware)
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization information not available", 401);
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    
    // Search biometrics within the user's organization only
    const result = await searchFacesByImageForOrganizationService(imageBuffer, organization.id);

    return successResponse(c, {
      message: "User biometric search completed within organization",
      data: {
        matches: result,
        organizationId: organization.id,
        organizationName: organization.name,
      },
    });
  } catch (error) {
    console.error("User biometric search error:", error);
    return errorResponse(c, "User biometric search failed", 500);
  }
}
