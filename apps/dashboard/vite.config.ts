import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sourceAliases } from "./sourceAliases";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  base: "/app/",
  plugins: [sourceAliases(), react(), tailwindcss()],
  envDir: repoRoot,
  server: { fs: { allow: [repoRoot] } },
  resolve: { dedupe: ["react", "react-dom"] },
});
