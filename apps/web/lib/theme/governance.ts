import type { Theme } from "@/lib/theme/themes";
import { DEFAULT_THEME, isTheme } from "@/lib/theme/themes";

export const THEME_SETTINGS_REGISTRY_KEY = "THEME_SETTINGS";

export type ThemeColorOverrides = {
  primary_hue: number | null;
  accent_hue: number | null;
};

export type TenantThemeSettings = ThemeColorOverrides & {
  default_theme: Theme;
  allow_location_theme_override: boolean;
  allow_user_theme_override: boolean;
};

export type LocationThemeOverride = Partial<ThemeColorOverrides> & {
  theme?: Theme;
};

export type ResolvedThemePolicy = {
  canChangeTheme: boolean;
  enforcedTheme: Theme;
  primaryHue: number | null;
  accentHue: number | null;
  tenantSettings: TenantThemeSettings;
  locationOverride: LocationThemeOverride | null;
};

export const DEFAULT_TENANT_THEME_SETTINGS: TenantThemeSettings = {
  default_theme: DEFAULT_THEME,
  primary_hue: null,
  accent_hue: null,
  allow_location_theme_override: false,
  allow_user_theme_override: true,
};

function clampHue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 360) return null;
  return rounded;
}

export function parseTenantThemeSettings(raw: unknown): TenantThemeSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const defaultTheme = isTheme(String(source.default_theme ?? ""))
    ? (source.default_theme as Theme)
    : DEFAULT_TENANT_THEME_SETTINGS.default_theme;

  return {
    default_theme: defaultTheme,
    primary_hue: clampHue(source.primary_hue),
    accent_hue: clampHue(source.accent_hue),
    allow_location_theme_override:
      typeof source.allow_location_theme_override === "boolean"
        ? source.allow_location_theme_override
        : DEFAULT_TENANT_THEME_SETTINGS.allow_location_theme_override,
    allow_user_theme_override:
      typeof source.allow_user_theme_override === "boolean"
        ? source.allow_user_theme_override
        : DEFAULT_TENANT_THEME_SETTINGS.allow_user_theme_override,
  };
}

export function parseLocationThemeOverride(raw: unknown): LocationThemeOverride | null {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const theme = isTheme(String(source.theme ?? "")) ? (source.theme as Theme) : undefined;
  const primaryHue = clampHue(source.primary_hue);
  const accentHue = clampHue(source.accent_hue);

  if (!theme && primaryHue === null && accentHue === null) return null;

  return {
    ...(theme ? { theme } : {}),
    ...(primaryHue !== null ? { primary_hue: primaryHue } : {}),
    ...(accentHue !== null ? { accent_hue: accentHue } : {}),
  };
}

export function readLocationThemeFromMeta(
  locationMeta: Record<string, unknown> | null | undefined
): LocationThemeOverride | null {
  if (!locationMeta || typeof locationMeta !== "object") return null;
  return parseLocationThemeOverride(locationMeta.theme);
}

export function locationThemeToFormValues(locationMeta: Record<string, unknown> | undefined) {
  const override = readLocationThemeFromMeta(locationMeta);
  return {
    location_theme_enabled: Boolean(override),
    location_theme: override?.theme ?? DEFAULT_TENANT_THEME_SETTINGS.default_theme,
    location_primary_hue: override?.primary_hue ?? null,
    location_accent_hue: override?.accent_hue ?? null,
  };
}

export function resolveThemePolicy(input: {
  tenantSettings?: TenantThemeSettings | null;
  locationOverride?: LocationThemeOverride | null;
}): ResolvedThemePolicy {
  const tenantSettings = input.tenantSettings ?? DEFAULT_TENANT_THEME_SETTINGS;
  const locationOverride =
    tenantSettings.allow_location_theme_override && input.locationOverride
      ? input.locationOverride
      : null;

  const enforcedTheme = locationOverride?.theme ?? tenantSettings.default_theme;
  const primaryHue = locationOverride?.primary_hue ?? tenantSettings.primary_hue;
  const accentHue = locationOverride?.accent_hue ?? tenantSettings.accent_hue;

  return {
    canChangeTheme: tenantSettings.allow_user_theme_override,
    enforcedTheme,
    primaryHue,
    accentHue,
    tenantSettings,
    locationOverride,
  };
}

export function buildTenantThemeSettingsPayload(
  settings: Pick<
    TenantThemeSettings,
    | "default_theme"
    | "primary_hue"
    | "accent_hue"
    | "allow_location_theme_override"
    | "allow_user_theme_override"
  >
): Record<string, unknown> {
  return {
    default_theme: settings.default_theme,
    primary_hue: settings.primary_hue,
    accent_hue: settings.accent_hue,
    allow_location_theme_override: settings.allow_location_theme_override,
    allow_user_theme_override: settings.allow_user_theme_override,
  };
}

export function buildLocationThemeMetaPatch(
  existingMeta: Record<string, unknown> | undefined,
  input: {
    enabled: boolean;
    theme?: Theme;
    primary_hue?: number | null;
    accent_hue?: number | null;
  }
): Record<string, unknown> {
  const merged = { ...(existingMeta ?? {}) };

  if (!input.enabled) {
    if ("theme" in merged) {
      const next = { ...merged };
      delete next.theme;
      return next;
    }
    return merged;
  }

  const themePatch: Record<string, unknown> = {};
  if (input.theme) themePatch.theme = input.theme;
  if (typeof input.primary_hue === "number") themePatch.primary_hue = input.primary_hue;
  if (typeof input.accent_hue === "number") themePatch.accent_hue = input.accent_hue;

  if (Object.keys(themePatch).length === 0) {
    const next = { ...merged };
    delete next.theme;
    return next;
  }

  return {
    ...merged,
    theme: themePatch,
  };
}
