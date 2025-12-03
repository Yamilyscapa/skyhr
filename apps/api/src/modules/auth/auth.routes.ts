import { Hono } from "hono";
import { auth } from "../../core/auth";

const authRouter = new Hono();

// Mount Better Auth handler following Hono integration best practices
// Handle all methods including OPTIONS for CORS preflight
authRouter.all("/*", async (c) => {
  const response = await auth.handler(c.req.raw);
  
  // Ensure the response is properly formatted
  // Better Auth handler returns a Response object, which Hono can handle directly
  return response;
});

export default authRouter;