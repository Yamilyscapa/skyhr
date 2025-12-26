import { S3Client } from "@aws-sdk/client-s3";

export type BucketType = "qr" | "biometrics" | "documents";

const RAILWAY_ENDPOINT = "https://storage.railway.app";
const RAILWAY_REGION = "auto";

interface BucketConfig {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const getBucketConfig = (type: BucketType): BucketConfig => {
  const configs: Record<BucketType, { bucketEnv: string; accessKeyEnv: string; secretKeyEnv: string }> = {
    qr: {
      bucketEnv: "RAILWAY_QR_BUCKET",
      accessKeyEnv: "RAILWAY_QR_ACCESS_KEY_ID",
      secretKeyEnv: "RAILWAY_QR_SECRET_ACCESS_KEY",
    },
    biometrics: {
      bucketEnv: "RAILWAY_BIOMETRICS_BUCKET",
      accessKeyEnv: "RAILWAY_BIOMETRICS_ACCESS_KEY_ID",
      secretKeyEnv: "RAILWAY_BIOMETRICS_SECRET_ACCESS_KEY",
    },
    documents: {
      bucketEnv: "RAILWAY_DOCUMENTS_BUCKET",
      accessKeyEnv: "RAILWAY_DOCUMENTS_ACCESS_KEY_ID",
      secretKeyEnv: "RAILWAY_DOCUMENTS_SECRET_ACCESS_KEY",
    },
  };

  const config = configs[type];
  const bucket = process.env[config.bucketEnv];
  const accessKeyId = process.env[config.accessKeyEnv];
  const secretAccessKey = process.env[config.secretKeyEnv];

  if (!bucket) {
    throw new Error(`${config.bucketEnv} environment variable is required`);
  }
  if (!accessKeyId) {
    throw new Error(`${config.accessKeyEnv} environment variable is required`);
  }
  if (!secretAccessKey) {
    throw new Error(`${config.secretKeyEnv} environment variable is required`);
  }

  return { bucket, accessKeyId, secretAccessKey };
};

const createS3ClientForBucket = (type: BucketType): S3Client => {
  const config = getBucketConfig(type);

  return new S3Client({
    region: RAILWAY_REGION,
    endpoint: RAILWAY_ENDPOINT,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: false, // Railway uses virtual-hosted-style URLs
  });
};

// Lazy initialization to avoid errors when env vars are not set (e.g., in development)
let qrClient: S3Client | null = null;
let biometricsClient: S3Client | null = null;
let documentsClient: S3Client | null = null;

export const getRailwayClient = (type: BucketType): S3Client => {
  switch (type) {
    case "qr":
      if (!qrClient) {
        qrClient = createS3ClientForBucket("qr");
      }
      return qrClient;
    case "biometrics":
      if (!biometricsClient) {
        biometricsClient = createS3ClientForBucket("biometrics");
      }
      return biometricsClient;
    case "documents":
      if (!documentsClient) {
        documentsClient = createS3ClientForBucket("documents");
      }
      return documentsClient;
  }
};

export const getRailwayBucketName = (type: BucketType): string => {
  const config = getBucketConfig(type);
  return config.bucket;
};

export const RAILWAY_STORAGE_ENDPOINT = RAILWAY_ENDPOINT;
export const RAILWAY_STORAGE_REGION = RAILWAY_REGION;



