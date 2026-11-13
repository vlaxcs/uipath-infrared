import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "../index.css";
import "./pitch.css";
import { Pitch } from "./Pitch.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Pitch />
  </StrictMode>,
);
