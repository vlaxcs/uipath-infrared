import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const order: Theme[] = ["system", "light", "dark"];
const labels: Record<Theme, string> = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" };

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("settings-theme");
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("settings-theme", theme);
    } catch {
      return;
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length])}
      className="type-small rounded-item border border-line px-2.5 py-1 font-semibold text-fg-muted hover:bg-sunken hover:text-fg"
    >
      {labels[theme]}
    </button>
  );
}
