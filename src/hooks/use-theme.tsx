import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const themes = ["default", "high-contrast", "purple", "light", "springbok", "midnight", "ocean", "sunset", "aurora", "glassmorphism", "synthwave", "stardust"] as const;
export type Theme = (typeof themes)[number];

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const THEME_STORAGE_KEY = "karmel-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

const isTheme = (value: string | null): value is Theme =>
  value !== null && themes.includes(value as Theme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("default");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const resolvedTheme = storedTheme === "007" ? "midnight" : storedTheme;
    if (isTheme(resolvedTheme)) setThemeState(resolvedTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      "theme-high-contrast",
      "theme-purple",
      "theme-light",
      "theme-springbok",
      "theme-midnight",
      "theme-ocean",
      "theme-sunset",
      "theme-aurora",
      "theme-glassmorphism",
      "theme-synthwave",
      "theme-stardust",
    );
    if (theme !== "default") root.classList.add(`theme-${theme}`);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}
