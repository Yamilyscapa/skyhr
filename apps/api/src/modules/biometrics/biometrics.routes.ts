import { Hono } from "hono";
import {
  compareFaces,
  detectFaces,
  indexFace,
  indexFaceForOrganization,
  searchFaces,
  searchFacesForOrganization,
  testConnection,
  registerUserBiometrics,
  searchUserBiometrics,
  createLivenessSession,
  getLivenessSessionResults,
} from "./biometrics.controller";
import {
  requireAuth,
  requireOrganization,
} from "../../middleware/auth-middleware";
import { biometricRateLimit } from "../../middleware/biometrics-rate-limit";

const biometricsRouter = new Hono();

// Biometric utility endpoints — auth required to prevent AWS bill abuse from anonymous calls.
biometricsRouter.post(
  "/compare-faces",
  requireAuth,
  biometricRateLimit("biometrics.compareFacesPublic"),
  compareFaces,
);
biometricsRouter.post(
  "/detect-faces",
  requireAuth,
  biometricRateLimit("biometrics.detectFacesPublic"),
  detectFaces,
);
biometricsRouter.get("/test-connection", requireAuth, testConnection);

// Admin/system endpoints — also require organization membership for tenant isolation.
biometricsRouter.post(
  "/index-face",
  requireAuth,
  requireOrganization,
  biometricRateLimit("biometrics.indexFaceAdmin"),
  indexFace,
);
biometricsRouter.post(
  "/search-faces",
  requireAuth,
  requireOrganization,
  biometricRateLimit("biometrics.searchFacesAdmin"),
  searchFaces,
);

// Organization-specific biometric endpoints — controller verifies body org matches session org.
biometricsRouter.post(
  "/organization/index-face",
  requireAuth,
  requireOrganization,
  biometricRateLimit("biometrics.organizationIndexFaceAdmin"),
  indexFaceForOrganization,
);
biometricsRouter.post(
  "/organization/search-faces",
  requireAuth,
  requireOrganization,
  biometricRateLimit("biometrics.organizationSearchFacesAdmin"),
  searchFacesForOrganization,
);

// User-level endpoints (automatically use user's organization)
biometricsRouter.post(
  "/register",
  requireAuth,
  requireOrganization,
  biometricRateLimit("biometrics.register"),
  registerUserBiometrics,
);
biometricsRouter.post(
  "/search",
  requireAuth,
  requireOrganization,
  biometricRateLimit("biometrics.search"),
  searchUserBiometrics,
);

// Rekognition Face Liveness — challenge-response anti-spoof.
// Session created by backend, executed by client SDK against AWS, verified by backend.
biometricsRouter.post(
  "/liveness/session",
  requireAuth,
  requireOrganization,
  biometricRateLimit("biometrics.livenessSessionCreate"),
  createLivenessSession,
);
biometricsRouter.get(
  "/liveness/session/:sessionId",
  requireAuth,
  requireOrganization,
  biometricRateLimit("biometrics.livenessSessionResults"),
  getLivenessSessionResults,
);

export default biometricsRouter;
