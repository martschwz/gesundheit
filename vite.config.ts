import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Die App liegt auf GitHub Pages unter https://martschwz.github.io/gesundheit/
export default defineConfig({
  base: "/gesundheit/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Gesundheit",
        short_name: "Gesundheit",
        description: "Abnehmen und gesund leben – Essen per Foto, Gewicht mit Trend.",
        lang: "de",
        start_url: "/gesundheit/",
        scope: "/gesundheit/",
        display: "standalone",
        background_color: "#f3f6f4",
        theme_color: "#1f7a55",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/gesundheit/index.html",
        // Benachrichtigungen (Erinnerungen) – siehe public/push-sw.js
        importScripts: ["push-sw.js"],
      },
    }),
  ],
  test: { environment: "node" },
} as never);
