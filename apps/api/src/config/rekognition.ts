import { RekognitionClient, ListCollectionsCommand } from "@aws-sdk/client-rekognition";

// Environment variables
const REGION = process.env.AWS_REGION ?? "us-east-1";
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  throw new Error(
    "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set for Rekognition. Refusing to start with empty credentials.",
  );
}

export const rekognitionConfig = {
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  maxAttempts: 3,
  requestTimeout: 30000,
};

const rekognitionClient = new RekognitionClient(rekognitionConfig);

export default rekognitionClient;

export const rekognitionSettings = {
  // Face comparison threshold (0-100, higher = more strict)
  // 95+ recommended for biometric attendance to minimize false positives (payroll fraud risk).
  similarityThreshold: 97,
  
  // Face detection confidence threshold (0-100)
  faceDetectionConfidence: 90,
  
  // Maximum number of faces to detect
  maxFaces: 10,
  
  // Face attributes to detect
  faceAttributes: [
    "DEFAULT", // Basic face attributes
    "ALL"      // All available attributes
  ] as const,
  
  // Image quality settings
  qualityFilter: "AUTO" as const,
  
  // Collection settings (if using face collections)
  collectionId: process.env.REKOGNITION_COLLECTION_ID ?? "skyhr-faces",

  // Rekognition Face Liveness confidence threshold (0-100).
  // 90 chosen for payroll/attendance — fewer spoofs through, accept moderate false-reject risk.
  livenessConfidenceThreshold: 90,
};

// Helper function to validate required environment variables
export function validateRekognitionConfig(): void {
  const requiredVars = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID', 
    'AWS_SECRET_ACCESS_KEY'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables for Rekognition: ${missingVars.join(', ')}`
    );
  }
}

// Helper function to check if Rekognition is properly configured
export async function testRekognitionConnection(): Promise<boolean> {
  try {
    validateRekognitionConfig();
    
    // Test connection by listing collections
    const command = new ListCollectionsCommand({});
    await rekognitionClient.send(command);
    
    return true;
  } catch (error) {
    console.error("Rekognition connection test failed:", error);
    return false;
  }
}
