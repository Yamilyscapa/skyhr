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
} from "./biometrics.controller";
import {
  requireAuth,
  requireOrganization,
} from "../../middleware/auth-middleware";
import { biometricRateLimit } from "../../middleware/biometrics-rate-limit";

const biometricsRouter = new Hono();

// Public biometric utility endpoints (no auth required)
biometricsRouter.post(
  "/compare-faces",
  biometricRateLimit("biometrics.compareFacesPublic"),
  compareFaces,
);
biometricsRouter.post(
  "/detect-faces",
  biometricRateLimit("biometrics.detectFacesPublic"),
  detectFaces,
);
biometricsRouter.get("/test-connection", testConnection);

// Admin/system level endpoints (require auth but no specific organization)
biometricsRouter.post(
  "/index-face",
  requireAuth,
  biometricRateLimit("biometrics.indexFaceAdmin"),
  indexFace,
);
biometricsRouter.post(
  "/search-faces",
  requireAuth,
  biometricRateLimit("biometrics.searchFacesAdmin"),
  searchFaces,
);

// Organization-specific biometric endpoints (admin level - require manual org ID)
biometricsRouter.post(
  "/organization/index-face",
  requireAuth,
  biometricRateLimit("biometrics.organizationIndexFaceAdmin"),
  indexFaceForOrganization,
);
biometricsRouter.post(
  "/organization/search-faces",
  requireAuth,
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

export default biometricsRouter;
