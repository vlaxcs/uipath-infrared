import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "~/App";
import { hostedSlackUrl } from "~/slack/host";
import "~/index.css";

const slackUrl = hostedSlackUrl(window.location.search);
document.documentElement.classList.toggle("hosted", slackUrl !== null);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App slackUrl={slackUrl} />
  </StrictMode>,
);
