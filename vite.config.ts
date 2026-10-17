import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, Express runs separately on port 3000 (server/dev.ts).
    proxy: { "/api": "http://localhost:3000" },
  },
  build: {
    rollupOptions: {
      // Two pages: the app, and the components demo at /components.html.
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        components: fileURLToPath(new URL("./components.html", import.meta.url)),
      },
    },
  },
});
