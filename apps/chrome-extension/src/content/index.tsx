import { createRoot } from "react-dom/client";
import { ensureHost } from "~/content/host";
import { ExtensionPanel } from "~/content/ExtensionPanel";
import panelCss from "./panel.css";

function mount() {
  const shadow = ensureHost();
  if (!shadow) return;

  const style = document.createElement("style");
  style.textContent = panelCss;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "ir-root";
  shadow.appendChild(root);

  createRoot(root).render(<ExtensionPanel />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
