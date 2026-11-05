/** Keep in sync with the blocking script in index.html. Default is dark; no system preference. */
const STORAGE_KEY = "nailsbychao-theme";

export const THEME_COLORS = {
  dark: "#0b0b0b",
  light: "#ffffff",
} as const;

export type ThemeName = keyof typeof THEME_COLORS;

export function readStoredTheme(): ThemeName {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked. The choice still applies until the tab closes.
  }
}
