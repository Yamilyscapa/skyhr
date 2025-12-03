import { Hono } from "hono";
import { updateUserPayroll, getUserPayroll, allowOvertime, getOvertime } from "./payroll.controller";

const payroleRouter = new Hono();

payroleRouter.put("/", updateUserPayroll);
payroleRouter.get("/:userId", getUserPayroll);
payroleRouter.put("/overtime/:userId", allowOvertime);
payroleRouter.get("/overtime/:userId", getOvertime);

export default payroleRouter;