import { build, context } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");

const requestedOrchestrator = process.env.VITE_ORCHESTRATOR_URL?.trim();
const orchestratorUrl =
  requestedOrchestrator && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(requestedOrchestrator)
    ? requestedOrchestrator.replace(/\/+$/, "")
    : "http://127.0.0.1:8080";

const shared = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  jsx: "automatic",
  jsxImportSource: "react",
  minify: !watch,
  sourcemap: watch,
  logLevel: "info",
  loader: { ".css": "text" },
  define: {
    "process.env.NODE_ENV": watch ? '"development"' : '"production"',
    __DEFAULT_ORCHESTRATOR_URL__: JSON.stringify(orchestratorUrl),
  },
};

const entries = [
  { entryPoints: ["src/content/index.tsx"], outfile: "dist/content.js" },
  { entryPoints: ["src/background.ts"], outfile: "dist/background.js" },
  { entryPoints: ["src/options/index.tsx"], outfile: "dist/options.js" },
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await copyFile("manifest.json", "dist/manifest.json");
await copyFile("options.html", "dist/options.html");
await copyFile("src/options/options.css", "dist/options.css");

if (watch) {
  for (const entry of entries) {
    const bundle = await context({ ...shared, ...entry });
    await bundle.watch();
  }
  console.log("watching the extension sources; reload the extension in chrome://extensions");
} else {
  await Promise.all(entries.map((entry) => build({ ...shared, ...entry })));
  console.log("built dist/");
}
