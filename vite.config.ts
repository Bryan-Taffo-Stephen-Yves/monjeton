import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Le manifest est dans public/manifest.webmanifest (une seule source).
      manifest: false,
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Ajoute la gestion des notifications push au service worker /sw.js.
        importScripts: ["/push-sw.js"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/") ||
            id.includes("@tanstack/react-query")
          ) {
            return "vendor-react";
          }
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("jspdf") || id.includes("canvas-confetti")) return "vendor-heavy";
          if (id.includes("date-fns")) return "vendor-datefns";
          if (id.includes("embla-carousel")) return "vendor-carousel";
          if (id.includes("react-hook-form") || id.includes("zod") || id.includes("@hookform")) {
            return "vendor-forms";
          }
          if (id.includes("@radix-ui")) return "vendor-radix";
        },
      },
    },
    chunkSizeWarningLimit: 400,
    minify: "esbuild",
  },
}));
