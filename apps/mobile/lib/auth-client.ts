import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

/**
 * Better Auth client configured for Expo
 * Handles authentication with secure token storage and organization support
 */
export const authClient = createAuthClient({
    // Include the full path since the backend uses /auth instead of /api/auth
    baseURL: `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080'}/auth`,
    plugins: [
        expoClient({
            scheme: "mobile", // Must match scheme in app.json
            storagePrefix: "skyhr",
            storage: SecureStore,
        }),
        organizationClient() // Add organization support to match backend
    ],
    // Ensure session is fetched from storage on mount
    fetchOptions: {
        credentials: "include",
    },
});

