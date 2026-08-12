import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      // Bind mounts (especially on Windows) don't always emit native fs events reliably —
      // polling trades a little CPU for hot reload actually firing.
      usePolling: true,
    },
  },
});
