import { shell, type App, type WebContents } from "electron";
import { opensInBrowser, staysInPhone } from "./navigation";

function guardSlackView(view: WebContents) {
  view.setWindowOpenHandler(({ url }) => {
    if (staysInPhone(url)) void view.loadURL(url);
    else if (opensInBrowser(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  view.on("will-navigate", (event, url) => {
    if (staysInPhone(url)) return;
    event.preventDefault();
    if (opensInBrowser(url)) void shell.openExternal(url);
  });
}

export function guardWebContents(app: App) {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (_attach, preferences) => {
      delete preferences.preload;
      preferences.nodeIntegration = false;
      preferences.contextIsolation = true;
    });
    if (contents.getType() === "webview") guardSlackView(contents);
  });
}
