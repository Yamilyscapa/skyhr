import {
  CompareFacesCommand,
  DetectFacesCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  ListCollectionsCommand,
  ListFacesCommand,
  DeleteFacesCommand,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
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

export interface LivenessSessionResult {
  sessionId: string;
  status: string; // CREATED | IN_PROGRESS | SUCCEEDED | FAILED | EXPIRED
  confidence: number; // 0-100
  isLive: boolean;
  referenceImageBytes: Buffer | null; // Best-frame still extracted by AWS, attested live
  auditImageCount: number;
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
 * Create a Rekognition Face Liveness session. Client uses returned sessionId with the
 * AWS Amplify FaceLivenessDetector SDK to run the oval/light challenge.
 */
export const createLivenessSession = async (): Promise<string> => {
  const command = new CreateFaceLivenessSessionCommand({});
  const response = await rekognitionClient.send(command);
  if (!response.SessionId) {
    throw new Error("Rekognition did not return a SessionId");
  }
  return response.SessionId;
};

/**
 * Fetch Rekognition Face Liveness session results. Returns confidence, status,
 * and the AWS-extracted reference image (best frame, attested live) for downstream face match.
 */
export const getLivenessSessionResults = async (
  sessionId: string,
): Promise<LivenessSessionResult> => {
  const command = new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId });
  const response = await rekognitionClient.send(command);

  const confidence = response.Confidence ?? 0;
  const status = response.Status ?? "UNKNOWN";
  const isLive = status === "SUCCEEDED" && confidence >= rekognitionSettings.livenessConfidenceThreshold;
  const referenceImageBytes = response.ReferenceImage?.Bytes
    ? Buffer.from(response.ReferenceImage.Bytes as Uint8Array)
    : null;

  console.log(`[getLivenessSessionResults] Session ${sessionId}:`, {
    status,
    confidence,
    isLive,
    threshold: rekognitionSettings.livenessConfidenceThreshold,
    hasReferenceImage: Boolean(referenceImageBytes),
    auditImages: response.AuditImages?.length ?? 0,
  });

  return {
    sessionId,
    status,
    confidence,
    isLive,
    referenceImageBytes,
    auditImageCount: response.AuditImages?.length ?? 0,
  };
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
 * Find all face IDs in a collection matching a given ExternalImageId.
 * Pages through ListFaces because the API returns ≤4096 per page and has no server-side filter.
 */
export const findFaceIdsByExternalImageId = async (
  collectionId: string,
  externalImageId: string,
): Promise<string[]> => {
  const matches: string[] = [];
  let nextToken: string | undefined;

  do {
    const response: any = await rekognitionClient.send(
      new ListFacesCommand({
        CollectionId: collectionId,
        MaxResults: 4096,
        NextToken: nextToken,
      }),
    );

    for (const face of response.Faces ?? []) {
      if (face.ExternalImageId === externalImageId && face.FaceId) {
        matches.push(face.FaceId);
      }
    }
    nextToken = response.NextToken;
  } while (nextToken);

  return matches;
};

/**
 * Delete all indexed faces for a given ExternalImageId (typically userId) from a collection.
 * Idempotent: returns 0 if no faces match or collection missing.
 */
export const deleteFacesByExternalImageId = async (
  collectionId: string,
  externalImageId: string,
): Promise<number> => {
  try {
    const faceIds = await findFaceIdsByExternalImageId(collectionId, externalImageId);
    if (faceIds.length === 0) return 0;

    // DeleteFaces accepts up to 4096 IDs per call.
    const CHUNK = 4096;
    let deleted = 0;
    for (let i = 0; i < faceIds.length; i += CHUNK) {
      const chunk = faceIds.slice(i, i + CHUNK);
      const response = await rekognitionClient.send(
        new DeleteFacesCommand({
          CollectionId: collectionId,
          FaceIds: chunk,
        }),
      );
      deleted += response.DeletedFaces?.length ?? 0;
    }
    return deleted;
  } catch (error: any) {
    if (error?.name === "ResourceNotFoundException") {
      console.warn(
        `[deleteFacesByExternalImageId] Collection ${collectionId} not found; treating as no-op`,
      );
      return 0;
    }
    console.error(
      `[deleteFacesByExternalImageId] Failed for collection=${collectionId} external=${externalImageId}:`,
      error,
    );
    throw error;
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
  createLivenessSession,
  getLivenessSessionResults,
  indexFace,
  indexFaceForOrganization,
  indexFaceForOrganizationWithEnsure,
  searchFacesByImage,
  searchFacesByImageForOrganization,
  searchFacesByImageForOrganizationWithEnsure,
  createCollection,
  deleteCollection,
  findFaceIdsByExternalImageId,
  deleteFacesByExternalImageId,
  listCollections,
  testConnection,
};
