import { Hono } from "hono";
import { requireAuth, requireOrganization, requireRole } from "../../middleware/auth-middleware";
import { list, getOne, create, update, approve, reject, cancel, validateQr } from "./visitors.controller";

const visitorsRouter = new Hono();

// All visitor endpoints require auth + organization context
visitorsRouter.use("*", requireAuth, requireOrganization);

// QR Validation
visitorsRouter.post("/qr/validate", validateQr);

// CRUD
visitorsRouter.get("/", list);
visitorsRouter.get("/:id", getOne);
visitorsRouter.post("/", create);
visitorsRouter.put("/:id", update);

// State changes
visitorsRouter.post("/:id/approve", requireRole(["owner", "admin"]), approve);
visitorsRouter.post("/:id/reject", requireRole(["owner", "admin"]), reject);
visitorsRouter.post("/:id/cancel", cancel);

export default visitorsRouter;
