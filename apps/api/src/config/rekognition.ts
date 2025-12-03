import { RekognitionClient, ListCollectionsCommand } from "@aws-sdk/client-rekognition";

// Environment variables
const REGION = process.env.AWS_REGION ?? "us-east-1";
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? "";
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? "";

export const rekognitionConfig = {
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  // Optional: Configure max retries and timeout
  maxAttempts: 3,
  requestTimeout: 30000, // 30 seconds
};

const rekognitionClient = new RekognitionClient(rekognitionConfig);

export default rekognitionClient;

export const rekognitionSettings = {
  // Face comparison threshold (0-100, higher = more strict)
  similarityThreshold: 90,
  
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
  
  // Liveness detection thresholds
  livenessThreshold: 50, // Minimum liveness score (0-100)
  sharpnessThreshold: 50, // Minimum sharpness for live face detection
  brightnessRange: {
    min: 20, // Minimum acceptable brightness
    max: 80, // Maximum acceptable brightness
  },
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
