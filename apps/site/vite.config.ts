import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vitest/config";

const PAGES = ["/pitch", "/pitch2"];

const addTrailingSlash: Connect.NextHandleFunction = (request, response, next) => {
  const [path, query] = (request.url ?? "").split("?");
  if (!PAGES.includes(path)) return next();
  response.writeHead(301, { Location: `${path}/${query ? `?${query}` : ""}` });
  response.end();
};

function pageRedirects(): Plugin {
  return {
    name: "page-redirects",
    configureServer: (server) => void server.middlewares.use(addTrailingSlash),
    configurePreviewServer: (server) => void server.middlewares.use(addTrailingSlash),
  };
}

export default defineConfig({
  plugins: [pageRedirects(), react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        pitch: resolve(import.meta.dirname, "pitch/index.html"),
        pitch2: resolve(import.meta.dirname, "pitch2/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    css: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
