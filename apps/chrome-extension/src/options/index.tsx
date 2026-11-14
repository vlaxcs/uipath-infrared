import { createRoot } from "react-dom/client";
import { OptionsApp } from "~/options/OptionsApp";

const root = document.getElementById("root");
if (root) createRoot(root).render(<OptionsApp />);
