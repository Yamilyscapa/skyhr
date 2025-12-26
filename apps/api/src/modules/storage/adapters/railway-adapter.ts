import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getRailwayClient, getRailwayBucketName, type BucketType } from "../../../config/railway-storage";
import type { StorageAdapter, UploadResult, CreateStorageAdapter } from "./storage-interface";

// Default expiration times in seconds
const DEFAULT_EXPIRATION = {
  qr: 3600, // 1 hour for QR codes
  biometrics: 3600, // 1 hour for biometrics (mainly for internal use)
  documents: 900, // 15 minutes for documents
};

const uploadFileToRailway = async (
  file: File,
  fileName: string,
  contentType: string,
  bucketType: BucketType
): Promise<UploadResult> => {
  try {
    const client = getRailwayClient(bucketType);
    const bucket = getRailwayBucketName(bucketType);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const uploadParams = {
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    };

    await client.send(new PutObjectCommand(uploadParams));

    // Return the key, not a full URL (since Railway buckets are private)
    return {
      url: fileName, // Store key as "url" for backwards compatibility
      key: fileName,
      size: buffer.length,
    };
  } catch (error) {
    console.error("Railway bucket upload failed:", error);
    throw new Error(`Railway bucket upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

const getPresignedUrlFromRailway = async (
  key: string,
  bucketType: BucketType,
  expiresIn?: number
): Promise<string> => {
  try {
    const client = getRailwayClient(bucketType);
    const bucket = getRailwayBucketName(bucketType);
    const expiration = expiresIn ?? DEFAULT_EXPIRATION[bucketType];

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn: expiration,
    });

    return presignedUrl;
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

export const createRailwayAdapter: CreateStorageAdapter = (): StorageAdapter => {
  return {
    uploadFile: (file: File, fileName: string, contentType: string, bucketType: BucketType) =>
      uploadFileToRailway(file, fileName, contentType, bucketType),
    getPresignedUrl: (key: string, bucketType: BucketType, expiresIn?: number) =>
      getPresignedUrlFromRailway(key, bucketType, expiresIn),
  };
};



