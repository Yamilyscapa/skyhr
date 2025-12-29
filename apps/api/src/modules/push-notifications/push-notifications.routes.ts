import { Hono } from "hono";
import { requireAuth, requireOrganization } from "../../middleware/auth-middleware";
import { registerToken, unregisterToken } from "./push-notifications.controller";

const pushNotificationsRouter = new Hono();

pushNotificationsRouter.post("/", requireAuth, requireOrganization, registerToken);
pushNotificationsRouter.delete("/", requireAuth, unregisterToken);

export default pushNotificationsRouter;



