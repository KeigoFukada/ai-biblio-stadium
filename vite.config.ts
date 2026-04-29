import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/trpc": "http://localhost:3000",
    },
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-trpc": ["@trpc/client", "@trpc/react-query", "@tanstack/react-query"],
        },
      },
    },
  },
});
