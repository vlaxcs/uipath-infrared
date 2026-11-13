import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";

export default defineConfig(async ({ mode }) => ({
  plugins: [react(), tailwindcss(), mode === "shell" ? await electron({ main: { entry: "electron/main.ts" } }) : []],
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
  },
}));
