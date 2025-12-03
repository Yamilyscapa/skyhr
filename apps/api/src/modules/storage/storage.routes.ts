import { Hono } from "hono";
import { registerBiometric } from "./storage.controller";
import { uploadQr } from "./storage.controller";
import { requireAuth } from "../../middleware/auth-middleware";

const storageRouter = new Hono();

storageRouter.post("/register-biometric", requireAuth, registerBiometric);

storageRouter.post("/upload-qr", uploadQr);

export default storageRouter;
