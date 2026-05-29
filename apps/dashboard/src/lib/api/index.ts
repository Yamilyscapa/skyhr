import { createApiClient } from "./client";

const baseURL =
  (import.meta.env?.VITE_API_URL as string | undefined) ?? "http://localhost:8080";

export const api = createApiClient({ baseURL });

export type { ApiClient, ApiClientOptions } from "./client";
export { ApiError, createApiClient } from "./client";
export * from "./types";
