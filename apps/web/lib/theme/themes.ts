export type Theme = "dark" | "light";

export const THEMES: Theme[] = ["dark", "light"];

export const DEFAULT_THEME: Theme = "dark";

export const STORAGE_KEY = "aib-theme";

export const THEME_CLASS_MAP: Record<Theme, string> = {
  dark: "dark",
  light: "theme-light-warm",
};

export const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
};

const ALL_THEME_CLASSES = Object.values(THEME_CLASS_MAP);

const LEGACY_LIGHT_IDS = ["light-cyan", "light-blue", "light-warm"] as const;

export function isTheme(value: string | null | undefined): value is Theme {
  return THEMES.includes(value as Theme);
}

/** Map legacy light variant ids to the warm light palette. */
export function normalizeStoredTheme(value: string | null | undefined): Theme {
  if (
    value === "light" ||
    LEGACY_LIGHT_IDS.includes(value as (typeof LEGACY_LIGHT_IDS)[number])
  ) {
    return "light";
  }
  if (isTheme(value)) return value;
  return DEFAULT_THEME;
}

export function themeToHtmlClass(theme: Theme): string {
  return THEME_CLASS_MAP[theme];
}

export function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove(...ALL_THEME_CLASSES);
  root.classList.add(THEME_CLASS_MAP[theme]);
}

export function buildThemeInitScript(): string {
  const valid = THEMES.map((t) => `'${t}'`).join(",");
  const legacyLight = LEGACY_LIGHT_IDS.map((t) => `'${t}'`).join(",");
  const map = THEMES.map((t) => `'${t}':'${THEME_CLASS_MAP[t]}'`).join(",");
  return `(function(){try{var raw=localStorage.getItem('${STORAGE_KEY}');var t=raw;var legacy=[${legacyLight},'light'];if(legacy.indexOf(t)>=0){t='light'}var valid=[${valid}];if(valid.indexOf(t)<0){t='${DEFAULT_THEME}'}var map={${map}};var root=document.documentElement;Object.keys(map).forEach(function(k){root.classList.remove(map[k])});root.classList.add(map[t]);document.cookie='${STORAGE_KEY}='+t+'; path=/; max-age=31536000; SameSite=Lax'}catch(e){document.documentElement.classList.add('${THEME_CLASS_MAP[DEFAULT_THEME]}')}})();`;
}
