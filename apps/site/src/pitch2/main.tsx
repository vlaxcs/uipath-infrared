import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "../index.css";
import "../pitch/pitch.css";
import { Pitch2 } from "./Pitch2.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Pitch2 />
  </StrictMode>,
);
