import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { guardWebContents } from "./guard";
import { readSettings, type Settings } from "./settings";
import { openPhoneWindow } from "./window";

function loadSettings(): Settings {
  const envFile = join(app.getAppPath(), "../../.env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  try {
    return readSettings(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    app.exit(1);
    throw error;
  }
}

function pageUrl(): string {
  const url = process.env.VITE_DEV_SERVER_URL;
  if (!url) throw new Error("The phone window runs from the dev server: npm run phone");
  return url;
}

const settings = loadSettings();
app.userAgentFallback = app.userAgentFallback.replace(/ Electron\/\S+/, "").replace(` ${app.getName()}/${app.getVersion()}`, "");
guardWebContents(app);
app.on("window-all-closed", () => app.quit());
void app.whenReady().then(() => openPhoneWindow(pageUrl(), settings.slackWorkspaceUrl));
