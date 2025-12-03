/**
 * HMAC-based signing utilities for QR code payloads
 * Provides cryptographically secure signing and verification using HMAC-SHA256
 */

import crypto from "crypto";

/**
 * Signs a payload using HMAC-SHA256
 * @param payload - The data to sign
 * @param secret - The secret key for signing
 * @returns Base64-encoded string containing payload and signature
 */
export const obfuscatePayload = (payload: string, secret: string): string => {
  if (!secret) {
    throw new Error("Secret is required");
  }

  // Create HMAC signature
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Combine payload and signature
  const combined = `${payload}.${signature}`;
  
  // Encode to base64 for compact representation
  return Buffer.from(combined).toString("base64");
};

/**
 * Verifies and extracts a signed payload using HMAC-SHA256
 * @param signedPayload - The base64-encoded signed data
 * @param secret - The secret key used for signing
 * @returns The original payload string if signature is valid
 */
export const deobfuscatePayload = (signedPayload: string, secret: string): string => {
  if (!secret) {
    throw new Error("Secret is required");
  }

  try {
    // Decode from base64
    const decoded = Buffer.from(signedPayload, "base64").toString("utf8");
    
    // Split payload and signature
    const lastDotIndex = decoded.lastIndexOf(".");
    if (lastDotIndex === -1) {
      throw new Error("Invalid signed payload format: missing signature");
    }

    const payload = decoded.substring(0, lastDotIndex);
    const providedSignature = decoded.substring(lastDotIndex + 1);

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (providedSignature !== expectedSignature) {
      throw new Error("Invalid signature: payload has been tampered with");
    }

    return payload;
  } catch (error) {
    throw new Error(`Failed to verify signed payload: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Signs a JSON payload using HMAC-SHA256
 * @param payload - The object to sign
 * @param secret - The secret key for signing
 * @returns Base64-encoded signed JSON string
 */
export const obfuscateJsonPayload = <T>(payload: T, secret: string): string => {
  if (!secret) {
    throw new Error("Secret is required");
  }

  const jsonString = JSON.stringify(payload);
  return obfuscatePayload(jsonString, secret);
};

/**
 * Verifies and parses a signed JSON payload
 * @param signedPayload - The base64-encoded signed JSON data
 * @param secret - The secret key used for signing
 * @returns The parsed JSON object if signature is valid
 */
export const deobfuscateJsonPayload = <T>(signedPayload: string, secret: string): T => {
  if (!secret) {
    throw new Error("Secret is required");
  }

  const jsonString = deobfuscatePayload(signedPayload, secret);

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    throw new Error(`Failed to parse signed JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
