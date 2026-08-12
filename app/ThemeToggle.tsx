"use client";

import { useState } from "react";
import { resolveTheme, themeStorageKey, type Theme } from "@/lib/theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const prefersDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return resolveTheme(window.localStorage.getItem(themeStorageKey), prefersDark);
  });

  function toggleTheme() {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  }

  const nextLabel = theme === "light" ? "dark" : "light";
  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${nextLabel} mode`} title={`Switch to ${nextLabel} mode`}>
      <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
      <span className="theme-toggle-label">{theme === "light" ? "Dark" : "Light"}</span>
    </button>
  );
}
