import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      "@skinai/shared-types": path.resolve(
        __dirname,
        "../../packages/shared-types/src"
      ),
      "@skinai/utils": path.resolve(__dirname, "../../packages/utils/src"),
    },
  },
});
