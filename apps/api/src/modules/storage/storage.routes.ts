import { Hono } from "hono";
import { 
  registerBiometric, 
  uploadQr,
  getQrPresignedUrl,
  getDocumentPresignedUrl,
  getPresignedUrl
} from "./storage.controller";
import { requireAuth } from "../../middleware/auth-middleware";

const storageRouter = new Hono();

// Upload endpoints
storageRouter.post("/register-biometric", requireAuth, registerBiometric);
storageRouter.post("/upload-qr", uploadQr);

// Presigned URL endpoints (authenticated)
storageRouter.get("/presign/qr/:key", requireAuth, getQrPresignedUrl);
storageRouter.get("/presign/document/:key", requireAuth, getDocumentPresignedUrl);
storageRouter.get("/presign/:key", requireAuth, getPresignedUrl);

export default storageRouter;
