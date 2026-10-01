import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, Express runs separately on port 3000 (server/dev.ts).
    proxy: { "/api": "http://localhost:3000" },
  },
});
