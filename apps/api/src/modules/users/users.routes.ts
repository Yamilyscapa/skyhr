import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth-middleware";
import { deleteAccount } from "./users.controller";

const usersRouter = new Hono();

usersRouter.delete("/me", requireAuth, deleteAccount);

export default usersRouter;
