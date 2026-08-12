export type Theme = "light" | "dark";

export const themeStorageKey = "kampus-theme";

export function resolveTheme(saved: string | null | undefined, prefersDark: boolean): Theme {
  if (saved === "light" || saved === "dark") return saved;
  return prefersDark ? "dark" : "light";
}
