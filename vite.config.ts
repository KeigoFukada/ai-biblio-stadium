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
      "/api/tts": "http://localhost:3000",
      // ローカル開発: /api/trpc → /trpc (Vercel本番ではapi/trpc/[trpc].tsが処理)
      "/api/trpc": {
        target: "http://localhost:3000",
        rewrite: (path: string) => path.replace(/^\/api\/trpc/, "/trpc"),
      },
      "/trpc": "http://localhost:3000",
    },
  },
  build: {
    // Vercel は dist/ をデフォルト出力先として期待するため環境で切り替え
    // Render/ローカルビルド時は dist/public/ に出力（サーバーが静的配信するパス）
    outDir: process.env.VERCEL ? "../dist" : "../dist/public",
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
