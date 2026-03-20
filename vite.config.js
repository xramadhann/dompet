import { defineConfig } from "vite";

export default defineConfig({
  // Root: index.html ada di sini
  root: ".",

  // Output build ke folder dist/
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  // Saat dev server: akses di http://localhost:5173
  server: {
    port: 5173,
    open: true,
  },
});
