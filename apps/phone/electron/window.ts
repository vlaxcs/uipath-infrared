import { BrowserWindow, screen } from "electron";

const FRAME_WIDTH = 418;
const FRAME_HEIGHT = 900;

export function openPhoneWindow(pageUrl: string, slackUrl: string) {
  const page = new URL(pageUrl);
  page.searchParams.set("slack", slackUrl);
  const window = new BrowserWindow({
    width: FRAME_WIDTH,
    height: Math.min(FRAME_HEIGHT, screen.getPrimaryDisplay().workAreaSize.height),
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: { webviewTag: true },
  });
  void window.loadURL(page.toString());
  return window;
}
