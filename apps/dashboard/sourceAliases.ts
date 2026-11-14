import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

export const dashboardSrc = fileURLToPath(new URL("./src", import.meta.url));
export const settingsSrc = fileURLToPath(new URL("../settings/src", import.meta.url));

// apps/settings uses the same "~/" alias for its own src; resolve it by the importing file.
export function sourceAliases(): Plugin {
  return {
    name: "infrared-source-aliases",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!source.startsWith("~/")) return null;
      const fromSettings = importer !== undefined && inside(importer, settingsSrc);
      const target = path.join(fromSettings ? settingsSrc : dashboardSrc, source.slice(2));
      return this.resolve(target, importer, { ...options, skipSelf: true });
    },
  };
}

function inside(file: string, directory: string): boolean {
  const relative = path.relative(directory.toLowerCase(), path.resolve(file).toLowerCase());
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
