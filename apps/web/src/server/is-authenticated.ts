import { authClient } from "@/lib/auth-client";
import { createServerFn } from "@tanstack/react-start";

type ServerFnRequestContext = {
  request?: Request;
};

export const checkIsAuthenticated = createServerFn({
  method: "GET",
}).handler(async (ctx) => {
  const request = (ctx as ServerFnRequestContext).request;
  const headers = request?.headers ?? new Headers();
  const session = await authClient.getSession({ fetchOptions: { headers } });

  return Boolean(session?.data?.user);
});
