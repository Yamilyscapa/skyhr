import { Hono } from "hono";

const healthRouter = new Hono();

healthRouter.get("/", (c) => {
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
});

export default healthRouter;
