import { describe, expect, it } from "vitest";
import {
  buildLocationThemeMetaPatch,
  parseLocationThemeOverride,
  parseTenantThemeSettings,
  resolveThemePolicy,
} from "@/lib/theme/governance";

describe("parseTenantThemeSettings", () => {
  it("returns defaults for empty input", () => {
    expect(parseTenantThemeSettings(null)).toEqual({
      default_theme: "dark",
      primary_hue: null,
      accent_hue: null,
      allow_location_theme_override: false,
      allow_user_theme_override: true,
    });
  });

  it("parses stored workspace theme settings", () => {
    expect(
      parseTenantThemeSettings({
        default_theme: "light",
        primary_hue: 221,
        accent_hue: 262,
        allow_location_theme_override: true,
        allow_user_theme_override: false,
      })
    ).toEqual({
      default_theme: "light",
      primary_hue: 221,
      accent_hue: 262,
      allow_location_theme_override: true,
      allow_user_theme_override: false,
    });
  });
});

describe("resolveThemePolicy", () => {
  it("enforces tenant theme when user overrides are disabled", () => {
    const policy = resolveThemePolicy({
      tenantSettings: {
        default_theme: "light",
        primary_hue: 221,
        accent_hue: 40,
        allow_location_theme_override: false,
        allow_user_theme_override: false,
      },
    });

    expect(policy.canChangeTheme).toBe(false);
    expect(policy.enforcedTheme).toBe("light");
    expect(policy.primaryHue).toBe(221);
    expect(policy.accentHue).toBe(40);
  });

  it("applies location override when enabled", () => {
    const policy = resolveThemePolicy({
      tenantSettings: {
        default_theme: "dark",
        primary_hue: null,
        accent_hue: null,
        allow_location_theme_override: true,
        allow_user_theme_override: false,
      },
      locationOverride: {
        theme: "light",
        primary_hue: 160,
      },
    });

    expect(policy.enforcedTheme).toBe("light");
    expect(policy.primaryHue).toBe(160);
    expect(policy.accentHue).toBeNull();
  });

  it("ignores location override when location customization is disabled", () => {
    const policy = resolveThemePolicy({
      tenantSettings: {
        default_theme: "dark",
        primary_hue: null,
        accent_hue: null,
        allow_location_theme_override: false,
        allow_user_theme_override: true,
      },
      locationOverride: {
        theme: "light",
      },
    });

    expect(policy.enforcedTheme).toBe("dark");
    expect(policy.locationOverride).toBeNull();
  });
});

describe("parseLocationThemeOverride", () => {
  it("returns null when no override fields are present", () => {
    expect(parseLocationThemeOverride({})).toBeNull();
  });
});

describe("buildLocationThemeMetaPatch", () => {
  it("writes theme override into location meta", () => {
    expect(
      buildLocationThemeMetaPatch({}, {
        enabled: true,
        theme: "light",
        primary_hue: 221,
        accent_hue: 40,
      })
    ).toEqual({
      theme: {
        theme: "light",
        primary_hue: 221,
        accent_hue: 40,
      },
    });
  });

  it("removes theme override when customization is disabled", () => {
    expect(
      buildLocationThemeMetaPatch(
        { theme: { theme: "light" }, code_generation: { sequence: 1 } },
        { enabled: false }
      )
    ).toEqual({ code_generation: { sequence: 1 } });
  });
});
