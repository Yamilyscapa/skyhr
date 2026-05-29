import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

const baseURL =
  (import.meta.env?.VITE_API_URL as string | undefined) ?? "http://localhost:8080";

export const authClient = createAuthClient({
  baseURL,
  basePath: "/auth",
  fetchOptions: { credentials: "include" },
  plugins: [organizationClient()],
});

export const {
  useSession,
  useListOrganizations,
  useActiveOrganization,
  signIn,
  signUp,
  signOut,
  organization,
} = authClient;

export type Session = ReturnType<typeof useSession>;
