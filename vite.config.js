import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Centex Walkaround",
        short_name: "Walkaround",
        description: "Departure and return photo inspection for RV rental fleets",
        theme_color: "#16232E",
        background_color: "#EEF2F5",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        // The API is never cached; photos live in IndexedDB, not the HTTP cache.
        runtimeCaching: [{ urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i, handler: "CacheFirst", options: { cacheName: "fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } } }],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}"],
  },
});
