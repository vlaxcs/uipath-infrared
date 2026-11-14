import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { sourceAliases } from "./sourceAliases";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  server: { fs: { allow: [repoRoot] } },
  plugins: [sourceAliases()],
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 15000,
  },
});
