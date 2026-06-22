import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "logo-brasux.webp"],
      manifest: {
        name: "BrasUX Shopping",
        short_name: "BrasUX",
        description: "O Shopping Brasileiro de Soluções Tech",
        theme_color: "#16a34a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/logo-brasux.webp", sizes: "192x192", type: "image/webp", purpose: "any" },
          { src: "/logo-brasux.webp", sizes: "512x512", type: "image/webp", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,webp,woff2}"],
        importScripts: ["/push-sw.js"],
        runtimeCaching: [
          // Supabase REST API — NetworkFirst com cache de 5 min
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(stores|store_products|products)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 3,
            },
          },
          // Supabase Storage (imagens) — StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          // Fontes self-hosted — CacheFirst (nunca mudam)
          {
            urlPattern: /\.(woff2|woff|ttf|otf)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],

  build: {
    // Nunca gerar source maps em produção — expõe código-fonte original
    sourcemap: false,
    // Modernos browsers — output menor, sem polyfills desnecessários
    target: "esnext",

    modulePreload: {
      polyfill: false,
      // Remove supabase e gizApi dos preloads do HTML inicial.
      // Eles são carregados lazy via dynamic import em useEffect/ações do usuário.
      resolveDependencies: (_url, deps, { hostType }) => {
        if (hostType === "html") {
          return deps.filter(
            (d) => !d.includes("supabase") && !d.includes("gizApi")
          );
        }
        return deps;
      },
    },

    rollupOptions: {
      output: {
        // Separa bibliotecas pesadas em chunks próprios para melhor cache
        manualChunks(id) {
          // SignalR — só carrega em Orders e Chat (lazy pages)
          if (id.includes("@microsoft/signalr")) {
            return "signalr";
          }
          // Supabase — necessário para auth no AppLayout (sync)
          if (id.includes("@supabase")) {
            return "supabase";
          }
          // QRCode — só no checkout (lazy page)
          if (id.includes("qrcode")) {
            return "qrcode";
          }
          // React core — separado para melhor caching entre deploys
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "react";
          }
          // React Router
          if (id.includes("react-router")) {
            return "router";
          }
          // TanStack Query
          if (id.includes("@tanstack")) {
            return "query";
          }
          // Lucide icons — grande biblioteca, muda pouco
          if (id.includes("lucide-react")) {
            return "icons";
          }
          // Mapbox: deixar Rolldown decidir automaticamente (lazy via OrdersPage)
          // NOTA: não força manualChunks aqui pois mapbox só carrega via lazy import
        },
      },
    },

    // Aumenta threshold do warning (mapbox tem 1.8MB — é esperado e está isolado)
    chunkSizeWarningLimit: 2000,
  },
});
