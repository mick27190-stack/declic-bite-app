import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Sets Cache-Control headers on icon / brand asset responses.
 *
 * - Versioned assets (URL contains ?v=…): cached 1 year, immutable. The version
 *   string changes whenever the file content changes, so a new deployment with a
 *   new ?v= always fetches fresh bytes — no retention between deploys.
 * - Bare, unversioned requests (e.g. the browser's automatic /favicon.ico
 *   probe): `no-cache, must-revalidate` so they are never retained across
 *   deployments.
 */
function iconCacheHeaders(): Plugin {
  const ICON_EXT = /\.(ico|png|svg|webmanifest|webp)$/;
  return {
    name: "icon-cache-headers",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const pathOnly = url.split("?")[0];
        if (ICON_EXT.test(pathOnly)) {
          const versioned = /[?&]v=[a-z0-9]+/i.test(url);
          res.setHeader(
            "Cache-Control",
            versioned
              ? "public, max-age=31536000, immutable"
              : "no-cache, must-revalidate",
          );
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    iconCacheHeaders(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
