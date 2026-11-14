import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

describe("the extension manifest", () => {
  it("is a MV3 extension with the narrow permissions it needs", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toEqual(["http://127.0.0.1/*", "http://localhost/*"]);
    expect(manifest.optional_host_permissions).toEqual(["https://*/*"]);
    expect(manifest.host_permissions).not.toContain("<all_urls>");
    expect(manifest).not.toHaveProperty("externally_connectable");
  });

  it("ships the Infrared icon", () => {
    expect(manifest.icons["128"]).toBe("icons/icon128.png");
    expect(manifest.action.default_icon["32"]).toBe("icons/icon32.png");
    for (const size of [16, 32, 48, 128]) {
      expect(existsSync(join(import.meta.dirname, "..", "icons", `icon${size}.png`))).toBe(true);
    }
  });

  it("injects a content script on GitHub and exposes the options page", () => {
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0].matches).toEqual(["https://github.com/*"]);
    expect(manifest.content_scripts[0].js).toEqual(["content.js"]);
    expect(manifest.content_scripts[0].run_at).toBe("document_idle");
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.options_page).toBe("options.html");
  });
});
