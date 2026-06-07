import type { Theme } from "@/lib/theme/themes";

export type BrandHuePreset = {
  id: string;
  label: string;
  hue: number;
  preview: string;
};

export const PRIMARY_HUE_PRESETS: BrandHuePreset[] = [
  { id: "cyan", label: "Cyan", hue: 187, preview: "hsl(187 85% 53%)" },
  { id: "blue", label: "Blue", hue: 221, preview: "hsl(221 83% 50%)" },
  { id: "indigo", label: "Indigo", hue: 239, preview: "hsl(239 84% 58%)" },
  { id: "violet", label: "Violet", hue: 262, preview: "hsl(262 70% 58%)" },
  { id: "emerald", label: "Emerald", hue: 160, preview: "hsl(160 72% 40%)" },
];

export const ACCENT_HUE_PRESETS: BrandHuePreset[] = [
  { id: "violet", label: "Violet", hue: 262, preview: "hsl(262 70% 58%)" },
  { id: "cyan", label: "Cyan", hue: 187, preview: "hsl(187 85% 53%)" },
  { id: "amber", label: "Amber", hue: 38, preview: "hsl(38 92% 50%)" },
  { id: "rose", label: "Rose", hue: 350, preview: "hsl(350 75% 55%)" },
  { id: "slate", label: "Slate", hue: 215, preview: "hsl(215 20% 65%)" },
];

const BRAND_TOKEN_DEFAULTS: Record<
  Theme,
  {
    primary: { sat: number; light: number };
    accent: { sat: number; light: number };
    primaryHue: number;
    accentHue: number;
  }
> = {
  dark: {
    primary: { sat: 85, light: 53 },
    accent: { sat: 70, light: 58 },
    primaryHue: 187,
    accentHue: 262,
  },
  light: {
    primary: { sat: 83, light: 50 },
    accent: { sat: 25, light: 92 },
    primaryHue: 221,
    accentHue: 40,
  },
};

const BRAND_STYLE_KEYS = [
  "--primary",
  "--ring",
  "--accent",
  "--glow-cyan",
  "--glow-violet",
] as const;

export function applyBrandColorsToDocument(
  theme: Theme,
  overrides?: { primaryHue?: number | null; accentHue?: number | null }
) {
  if (typeof document === "undefined") return;

  const defaults = BRAND_TOKEN_DEFAULTS[theme];
  const primaryHue = overrides?.primaryHue ?? defaults.primaryHue;
  const accentHue = overrides?.accentHue ?? defaults.accentHue;
  const root = document.documentElement;

  root.style.setProperty(
    "--primary",
    `${primaryHue} ${defaults.primary.sat}% ${defaults.primary.light}%`
  );
  root.style.setProperty(
    "--ring",
    `${primaryHue} ${defaults.primary.sat}% ${defaults.primary.light}%`
  );
  root.style.setProperty(
    "--accent",
    `${accentHue} ${defaults.accent.sat}% ${defaults.accent.light}%`
  );
  root.style.setProperty("--glow-cyan", `${primaryHue} 92% 44%`);
  root.style.setProperty("--glow-violet", `${accentHue} 83% 58%`);
}

export function clearBrandColorOverrides() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of BRAND_STYLE_KEYS) {
    root.style.removeProperty(key);
  }
}

export function findHuePreset(
  presets: BrandHuePreset[],
  hue: number | null | undefined
): string {
  if (hue === null || hue === undefined) return "default";
  const match = presets.find((preset) => preset.hue === hue);
  return match?.id ?? "custom";
}

export function hueFromPreset(
  presets: BrandHuePreset[],
  presetId: string
): number | null {
  if (presetId === "default") return null;
  const match = presets.find((preset) => preset.id === presetId);
  return match?.hue ?? null;
}
