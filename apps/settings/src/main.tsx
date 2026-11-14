import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/schibsted-grotesk/latin-400.css";
import "@fontsource/schibsted-grotesk/latin-ext-400.css";
import "@fontsource/schibsted-grotesk/latin-500.css";
import "@fontsource/schibsted-grotesk/latin-ext-500.css";
import "@fontsource/schibsted-grotesk/latin-600.css";
import "@fontsource/schibsted-grotesk/latin-ext-600.css";
import "@fontsource/martian-mono/latin-400.css";
import "@fontsource/martian-mono/latin-ext-400.css";
import { App } from "~/App";
import "~/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
