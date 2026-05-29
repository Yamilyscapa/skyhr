import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  optimizeDeps: {
    include: [
      "use-sync-external-store/shim/with-selector.js",
      "use-sync-external-store/shim/index.js",
    ],
  },
  ssr: {
    noExternal: [
      "better-auth",
      "@better-auth/core",
      "@better-fetch/fetch",
    ],
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    nitro({
      config: { preset: "node-server" },
    }),
    viteReact(),
  ],
});
