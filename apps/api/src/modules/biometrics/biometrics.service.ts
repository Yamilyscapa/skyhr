import {
  CompareFacesCommand,
  DetectFacesCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  ListCollectionsCommand,
  type CompareFacesCommandInput,
  type DetectFacesCommandInput,
  type IndexFacesCommandInput,
  type SearchFacesByImageCommandInput,
} from "@aws-sdk/client-rekognition";

import rekognitionClient, { 
  rekognitionSettings, 
  validateRekognitionConfig,
  testRekognitionConnection 
} from "../../config/rekognition";

export interface FaceComparisonResult {
  isMatch: boolean;
  similarity: number;
  confidence: number;
}

export interface FaceDetectionResult {
  faceCount: number;
  faces: Array<{
    confidence: number;
    boundingBox: {
      width: number;
      height: number;
      left: number;
      top: number;
    };
    quality?: {
      brightness?: number;
      sharpness?: number;
    };
    landmarks?: any[];
    attributes?: any;
  }>;
}

export interface LivenessResult {
  isLive: boolean;
  livenessScore: number; // 0-100
  spoofFlag: boolean;
  quality: {
    brightness?: number;
    sharpness?: number;
  };
  reasons?: string[]; // Reasons for spoof detection
}

export interface FaceIndexResult {
  faceId: string;
  faceRecords: any[];
  success: boolean;
}

// Initialize configuration validation
validateRekognitionConfig();

/**
 * Compare two face images to determine if they are the same person
 */
export const compareFaces = async (
  sourceImageBuffer: Buffer,
  targetImageBuffer: Buffer,
  similarityThreshold?: number
): Promise<FaceComparisonResult> => {
  try {
    const threshold = similarityThreshold ?? rekognitionSettings.similarityThreshold;

    const params: CompareFacesCommandInput = {
      SourceImage: {
        Bytes: sourceImageBuffer,
      },
      TargetImage: {
        Bytes: targetImageBuffer,
      },
      SimilarityThreshold: threshold,
    };

    const command = new CompareFacesCommand(params);
    const response = await rekognitionClient.send(command);

    if (response.FaceMatches && response.FaceMatches.length > 0) {
      const bestMatch = response.FaceMatches[0];
      if (bestMatch) {
        return {
          isMatch: true,
          similarity: bestMatch.Similarity ?? 0,
          confidence: bestMatch.Face?.Confidence ?? 0,
        };
      }
    }

    return {
      isMatch: false,
      similarity: 0,
      confidence: 0,
    };
  } catch (error) {
    console.error("Face comparison failed:", error);
    throw new Error(`Face comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Detect faces in an image
 */
export const detectFaces = async (imageBuffer: Buffer): Promise<FaceDetectionResult> => {
  try {
    const params: DetectFacesCommandInput = {
      Image: {
        Bytes: imageBuffer,
      },
      Attributes: ["ALL"],
    };

    const command = new DetectFacesCommand(params);
    const response = await rekognitionClient.send(command);

    const faces = (response.FaceDetails ?? []).map(face => ({
      confidence: face.Confidence ?? 0,
      boundingBox: {
        width: face.BoundingBox?.Width ?? 0,
        height: face.BoundingBox?.Height ?? 0,
        left: face.BoundingBox?.Left ?? 0,
        top: face.BoundingBox?.Top ?? 0,
      },
      quality: {
        brightness: face.Quality?.Brightness,
        sharpness: face.Quality?.Sharpness,
      },
      landmarks: face.Landmarks,
      attributes: {
        ageRange: face.AgeRange,
        gender: face.Gender,
        emotions: face.Emotions,
        eyeglasses: face.Eyeglasses,
        sunglasses: face.Sunglasses,
        beard: face.Beard,
        mustache: face.Mustache,
        smile: face.Smile,
      },
    }));

    return {
      faceCount: faces.length,
      faces,
    };
  } catch (error) {
    console.error("Face detection failed:", error);
    throw new Error(`Face detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Detect liveness and potential spoofing using image quality metrics
 */
export const detectLiveness = async (imageBuffer: Buffer): Promise<LivenessResult> => {
  try {
    const detectionResult = await detectFaces(imageBuffer);
    
    // If no faces detected, cannot determine liveness
    if (detectionResult.faceCount === 0) {
      return {
        isLive: false,
        livenessScore: 0,
        spoofFlag: true,
        quality: {},
        reasons: ["No face detected in image"],
      };
    }

    // Use the first (primary) face for liveness detection
    const primaryFace = detectionResult.faces[0];
    const brightness = primaryFace.quality?.brightness ?? 0;
    const sharpness = primaryFace.quality?.sharpness ?? 0;
    
    const reasons: string[] = [];
    let livenessScore = 100;
    let spoofFlag = false;

    // Check sharpness - low sharpness indicates photo/print
    if (sharpness < rekognitionSettings.sharpnessThreshold) {
      const penalty = (rekognitionSettings.sharpnessThreshold - sharpness) * 2;
      livenessScore -= penalty;
      spoofFlag = true;
      reasons.push(`Low sharpness (${sharpness.toFixed(1)}), possible photo/print`);
    }

    // Check brightness - extreme values suggest photo/print
    if (brightness < rekognitionSettings.brightnessRange.min) {
      const penalty = (rekognitionSettings.brightnessRange.min - brightness) * 1.5;
      livenessScore -= penalty;
      spoofFlag = true;
      reasons.push(`Too dark (brightness: ${brightness.toFixed(1)}), possible photo/print`);
    } else if (brightness > rekognitionSettings.brightnessRange.max) {
      const penalty = (brightness - rekognitionSettings.brightnessRange.max) * 1.5;
      livenessScore -= penalty;
      spoofFlag = true;
      reasons.push(`Too bright (brightness: ${brightness.toFixed(1)}), possible photo/print`);
    }

    // Ensure liveness score is within 0-100 range
    livenessScore = Math.max(0, Math.min(100, livenessScore));

    // Determine if face is considered "live"
    const isLive = livenessScore >= rekognitionSettings.livenessThreshold && !spoofFlag;

    console.log(`[detectLiveness] Liveness check:`, {
      isLive,
      livenessScore: livenessScore.toFixed(1),
      spoofFlag,
      brightness: brightness.toFixed(1),
      sharpness: sharpness.toFixed(1),
      reasons: reasons.length > 0 ? reasons : ["Passed all quality checks"],
    });

    return {
      isLive,
      livenessScore,
      spoofFlag,
      quality: {
        brightness,
        sharpness,
      },
      reasons: reasons.length > 0 ? reasons : undefined,
    };
  } catch (error) {
    console.error("Liveness detection failed:", error);
    // On error, be conservative and flag as potential spoof
    return {
      isLive: false,
      livenessScore: 0,
      spoofFlag: true,
      quality: {},
      reasons: [`Liveness detection error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
};

/**
 * Index a face into a collection for future searching
 */
export const indexFace = async (
  imageBuffer: Buffer,
  externalImageId: string,
  collectionId?: string
): Promise<FaceIndexResult> => {
  try {
    const collection = collectionId ?? rekognitionSettings.collectionId;

    const params: IndexFacesCommandInput = {
      CollectionId: collection,
      Image: {
        Bytes: imageBuffer,
      },
      ExternalImageId: externalImageId,
      MaxFaces: 1,
      QualityFilter: rekognitionSettings.qualityFilter,
      DetectionAttributes: ["ALL"],
    };

    const command = new IndexFacesCommand(params);
    const response = await rekognitionClient.send(command);

    if (response.FaceRecords && response.FaceRecords.length > 0) {
      const faceRecord = response.FaceRecords[0];
      return {
        faceId: faceRecord?.Face?.FaceId ?? "",
        faceRecords: response.FaceRecords,
        success: true,
      };
    }

    return {
      faceId: "",
      faceRecords: [],
      success: false,
    };
  } catch (error) {
    console.error("Face indexing failed:", error);
    throw new Error(`Face indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Index a face for a specific organization
 */
export const indexFaceForOrganization = async (
  imageBuffer: Buffer,
  externalImageId: string,
  organizationId: string
): Promise<FaceIndexResult> => {
  const { getOrganizationCollectionId } = await import("../organizations/organizations.service");
  
  try {
    const collectionId = await getOrganizationCollectionId(organizationId);
    
    if (!collectionId) {
      throw new Error(`No Rekognition collection found for organization: ${organizationId}`);
    }
    
    return await indexFace(imageBuffer, externalImageId, collectionId);
  } catch (error) {
    console.error(`Face indexing failed for organization ${organizationId}:`, error);
    throw new Error(`Face indexing failed for organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Index a face for a specific organization with automatic collection creation
 */
export const indexFaceForOrganizationWithEnsure = async (
  imageBuffer: Buffer,
  externalImageId: string,
  organizationId: string
): Promise<FaceIndexResult> => {
  const { ensureOrganizationCollection } = await import("../organizations/organizations.service");
  
  try {
    // Ensure the organization has a collection (create if missing)
    const collectionId = await ensureOrganizationCollection(organizationId);
    
    if (!collectionId) {
      throw new Error(`Failed to create or find Rekognition collection for organization: ${organizationId}`);
    }
    
    return await indexFace(imageBuffer, externalImageId, collectionId);
  } catch (error) {
    console.error(`Face indexing failed for organization ${organizationId}:`, error);
    throw new Error(`Face indexing failed for organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Search for similar faces in a collection
 */
export const searchFacesByImage = async (
  imageBuffer: Buffer,
  collectionId?: string,
  maxFaces?: number
): Promise<any[]> => {
  try {
    const collection = collectionId ?? rekognitionSettings.collectionId;
    const max = maxFaces ?? rekognitionSettings.maxFaces;
    const threshold = rekognitionSettings.similarityThreshold;

    console.log(`[searchFacesByImage] Searching with:`, {
      collection,
      maxFaces: max,
      faceMatchThreshold: threshold
    });

    const params: SearchFacesByImageCommandInput = {
      CollectionId: collection,
      Image: {
        Bytes: imageBuffer,
      },
      MaxFaces: max,
      FaceMatchThreshold: threshold,
    };

    const command = new SearchFacesByImageCommand(params);
    const response = await rekognitionClient.send(command);

    const matches = response.FaceMatches ?? [];
    
    console.log(`[searchFacesByImage] AWS returned:`, {
      matchesCount: matches.length,
      matches: matches.map(m => ({
        externalImageId: m.Face?.ExternalImageId,
        similarity: m.Similarity,
        confidence: m.Face?.Confidence
      }))
    });

    return matches;
  } catch (error) {
    console.error("Face search failed:", error);
    throw new Error(`Face search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Search for similar faces in an organization's collection
 */
export const searchFacesByImageForOrganization = async (
  imageBuffer: Buffer,
  organizationId: string,
  maxFaces?: number
): Promise<any[]> => {
  const { getOrganizationCollectionId } = await import("../organizations/organizations.service");
  
  try {
    const collectionId = await getOrganizationCollectionId(organizationId);
    
    if (!collectionId) {
      throw new Error(`No Rekognition collection found for organization: ${organizationId}`);
    }
    
    return await searchFacesByImage(imageBuffer, collectionId, maxFaces);
  } catch (error) {
    console.error(`Face search failed for organization ${organizationId}:`, error);
    throw new Error(`Face search failed for organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Search for similar faces in an organization's collection with automatic collection creation
 */
export const searchFacesByImageForOrganizationWithEnsure = async (
  imageBuffer: Buffer,
  organizationId: string,
  maxFaces?: number
): Promise<any[]> => {
  const { ensureOrganizationCollection } = await import("../organizations/organizations.service");
  
  try {
    // Ensure the organization has a collection (create if missing)
    const collectionId = await ensureOrganizationCollection(organizationId);
    
    if (!collectionId) {
      throw new Error(`Failed to create or find Rekognition collection for organization: ${organizationId}`);
    }
    
    return await searchFacesByImage(imageBuffer, collectionId, maxFaces);
  } catch (error) {
    console.error(`Face search failed for organization ${organizationId}:`, error);
    throw new Error(`Face search failed for organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Create a face collection
 */
export const createCollection = async (collectionId?: string): Promise<boolean> => {
  try {
    // Validate AWS credentials before attempting to create collection
    try {
      validateRekognitionConfig();
    } catch (configError) {
      console.error(`[createCollection] AWS Rekognition configuration invalid:`, {
        error: configError instanceof Error ? configError.message : String(configError),
      });
      return false;
    }
    
    const collection = collectionId ?? rekognitionSettings.collectionId;
    
    console.log(`[createCollection] Attempting to create collection: ${collection}`);

    const command = new CreateCollectionCommand({
      CollectionId: collection,
    });

    await rekognitionClient.send(command);
    console.log(`[createCollection] Successfully created Rekognition collection: ${collection}`);
    return true;
  } catch (error: any) {
    // Handle ResourceAlreadyExistsException as success (idempotent behavior)
    if (error.name === "ResourceAlreadyExistsException" || error.name === "ResourceInUseException") {
      console.log(`[createCollection] Rekognition collection already exists: ${collectionId ?? rekognitionSettings.collectionId} (treating as success)`);
      return true;
    }
    
    // Log detailed error information
    const errorCode = error.name || error.$metadata?.httpStatusCode || "UNKNOWN";
    const errorMessage = error.message || String(error);
    const collectionName = collectionId ?? rekognitionSettings.collectionId;
    
    console.error(`[createCollection] Failed to create Rekognition collection: ${collectionName}`, {
      errorCode,
      errorMessage,
      errorName: error.name,
      awsRequestId: error.$metadata?.requestId,
      fullError: error,
    });
    
    return false;
  }
};

/**
 * Delete a face collection
 */
export const deleteCollection = async (collectionId?: string): Promise<boolean> => {
  try {
    const collection = collectionId ?? rekognitionSettings.collectionId;

    const command = new DeleteCollectionCommand({
      CollectionId: collection,
    });

    await rekognitionClient.send(command);
    console.log(`Successfully deleted Rekognition collection: ${collection}`);
    return true;
  } catch (error: any) {
    // Handle ResourceNotFoundException as success (idempotent behavior)
    if (error.name === "ResourceNotFoundException") {
      console.log(`Rekognition collection not found: ${collectionId ?? rekognitionSettings.collectionId} (treating as success)`);
      return true;
    }
    
    // Log detailed error information
    const errorCode = error.name || error.$metadata?.httpStatusCode || "UNKNOWN";
    const errorMessage = error.message || String(error);
    const collectionName = collectionId ?? rekognitionSettings.collectionId;
    
    console.error(`Failed to delete Rekognition collection: ${collectionName}`, {
      errorCode,
      errorMessage,
      errorName: error.name,
      awsRequestId: error.$metadata?.requestId,
    });
    
    return false;
  }
};

/**
 * List all face collections
 */
export const listCollections = async (): Promise<string[]> => {
  try {
    const command = new ListCollectionsCommand({});
    const response = await rekognitionClient.send(command);
    return response.CollectionIds ?? [];
  } catch (error) {
    console.error("Failed to list collections:", error);
    return [];
  }
};

/**
 * Test the Rekognition service connection
 */
export const testConnection = async (): Promise<boolean> => {
  return testRekognitionConnection();
};

// Functional service object for easier migration (optional - can be removed if preferred)
export const biometricsService = {
  compareFaces,
  detectFaces,
  detectLiveness,
  indexFace,
  indexFaceForOrganization,
  indexFaceForOrganizationWithEnsure,
  searchFacesByImage,
  searchFacesByImageForOrganization,
  searchFacesByImageForOrganizationWithEnsure,
  createCollection,
  deleteCollection,
  listCollections,
  testConnection,
};
