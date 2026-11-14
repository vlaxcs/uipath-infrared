import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "~/App";
import "@fontsource/schibsted-grotesk/latin-400.css";
import "@fontsource/schibsted-grotesk/latin-ext-400.css";
import "@fontsource/schibsted-grotesk/latin-500.css";
import "@fontsource/schibsted-grotesk/latin-ext-500.css";
import "@fontsource/schibsted-grotesk/latin-600.css";
import "@fontsource/schibsted-grotesk/latin-ext-600.css";
import "@fontsource/schibsted-grotesk/latin-700.css";
import "@fontsource/schibsted-grotesk/latin-ext-700.css";
import "@fontsource/schibsted-grotesk/latin-800.css";
import "@fontsource/schibsted-grotesk/latin-ext-800.css";
import "@fontsource/martian-mono/latin-400.css";
import "@fontsource/martian-mono/latin-ext-400.css";
import "~/index.css";
import { sameHostUrl } from "~/navigation/sameHost";
import { settings } from "~/runs/settings";

const moved = sameHostUrl(window.location.href, settings.orchestratorUrl);
if (moved) window.location.replace(moved);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
