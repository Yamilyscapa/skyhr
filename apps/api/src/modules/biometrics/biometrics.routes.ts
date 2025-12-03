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
  searchUserBiometrics
} from "./biometrics.controller";
import { requireAuth, requireOrganization } from "../../middleware/auth-middleware";

const biometricsRouter = new Hono();

// Public biometric utility endpoints (no auth required)
biometricsRouter.post("/compare-faces", compareFaces);
biometricsRouter.post("/detect-faces", detectFaces);
biometricsRouter.get("/test-connection", testConnection);

// Admin/system level endpoints (require auth but no specific organization)
biometricsRouter.post("/index-face", requireAuth, indexFace);
biometricsRouter.post("/search-faces", requireAuth, searchFaces);

// Organization-specific biometric endpoints (admin level - require manual org ID)
biometricsRouter.post("/organization/index-face", requireAuth, indexFaceForOrganization);
biometricsRouter.post("/organization/search-faces", requireAuth, searchFacesForOrganization);

// User-level endpoints (automatically use user's organization)
biometricsRouter.post("/register", requireAuth, requireOrganization, registerUserBiometrics);
biometricsRouter.post("/search", requireAuth, requireOrganization, searchUserBiometrics);

export default biometricsRouter;