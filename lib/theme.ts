export type ThemeMode = "light" | "dark" | "auto";

const STORAGE_KEY = "jena-theme";
export const OPEN_SEARCH_EVENT = "jena:open-search";

export function readThemeMode(): ThemeMode {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "auto";
}

export function isDarkMode(mode: ThemeMode): boolean {
  return mode === "auto" ? window.matchMedia("(prefers-color-scheme: dark)").matches : mode === "dark";
}

export function applyThemeMode(mode: ThemeMode): boolean {
  const dark = isDarkMode(mode);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  if (mode === "auto") window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, mode);
  return dark;
}

export function openGlobalSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
