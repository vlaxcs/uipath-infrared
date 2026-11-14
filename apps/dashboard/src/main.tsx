import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "~/App";
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
