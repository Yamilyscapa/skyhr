import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../../../config/s3";
import type { StorageAdapter, UploadResult, CreateStorageAdapter } from "./storage-interface";

const validateS3Config = () => {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  
  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is required");
  }
  if (!region) {
    throw new Error("AWS_REGION environment variable is required");
  }
  
  return { bucket, region };
};

const uploadFileToS3 = async (
  file: File, 
  fileName: string, 
  contentType: string,
  bucket: string,
  region: string
): Promise<UploadResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const uploadParams = {
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${fileName}`;
    
    return {
      url,
      key: fileName,
      size: buffer.length,
    };
  } catch (error) {
    console.error('S3 upload failed:', error);
    throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const createS3Adapter: CreateStorageAdapter = (): StorageAdapter => {
  const { bucket, region } = validateS3Config();
  
  return {
    uploadFile: (file: File, fileName: string, contentType: string) => 
      uploadFileToS3(file, fileName, contentType, bucket, region)
  };
};
