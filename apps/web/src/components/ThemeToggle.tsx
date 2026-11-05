import { useState } from "react";
import { applyTheme, readStoredTheme, type ThemeName } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>(readStoredTheme);
  const next: ThemeName = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-pressed={theme === "light"}
      aria-label={`Switch to ${next} theme`}
      className="rounded-full border border-border bg-surface/80 px-3 py-1.5 text-sm font-semibold text-foreground backdrop-blur-sm hover:border-accent"
    >
      {next === "light" ? "Light" : "Dark"}
    </button>
  );
}
