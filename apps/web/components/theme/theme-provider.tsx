"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchThemePolicyAction } from "@/lib/layout/shell-actions";
import { applyBrandColorsToDocument } from "@/lib/theme/brand-colors";
import type { ResolvedThemePolicy } from "@/lib/theme/governance";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  normalizeStoredTheme,
  STORAGE_KEY,
  type Theme,
} from "@/lib/theme/themes";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  canChangeTheme: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return normalizeStoredTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

function applyResolvedTheme(theme: Theme, policy: ResolvedThemePolicy) {
  applyThemeToDocument(theme);
  applyBrandColorsToDocument(theme, {
    primaryHue: policy.primaryHue,
    accentHue: policy.accentHue,
  });
}

type ThemeProviderProps = {
  children: React.ReactNode;
  policy?: ResolvedThemePolicy | null;
  /** When false, skip client hydration (login/signup and other public routes). */
  hydratePolicy?: boolean;
};

export function ThemeProvider({
  children,
  policy = null,
  hydratePolicy = false,
}: ThemeProviderProps) {
  const [resolvedPolicy, setResolvedPolicy] = useState<ResolvedThemePolicy | null>(policy);

  useEffect(() => {
    setResolvedPolicy(policy);
  }, [policy]);

  useEffect(() => {
    if (policy || !hydratePolicy) return;
    let cancelled = false;
    void fetchThemePolicyAction().then((next) => {
      if (!cancelled && next) setResolvedPolicy(next);
    });
    return () => {
      cancelled = true;
    };
  }, [hydratePolicy, policy]);

  const canChangeTheme = resolvedPolicy?.canChangeTheme ?? true;
  const enforcedTheme = resolvedPolicy?.enforcedTheme ?? DEFAULT_THEME;
  const policyKey = resolvedPolicy
    ? [
        resolvedPolicy.canChangeTheme,
        resolvedPolicy.enforcedTheme,
        resolvedPolicy.primaryHue,
        resolvedPolicy.accentHue,
      ].join(":")
    : "default";

  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = canChangeTheme ? readStoredTheme() : enforcedTheme;
    setThemeState(initialTheme);
    if (resolvedPolicy) {
      applyResolvedTheme(initialTheme, resolvedPolicy);
    } else {
      applyThemeToDocument(initialTheme);
    }
    if (canChangeTheme) {
      persistTheme(initialTheme);
    }
    setMounted(true);
  }, [canChangeTheme, enforcedTheme, policyKey, resolvedPolicy]);

  const setTheme = useCallback(
    (next: Theme) => {
      if (!canChangeTheme) return;
      setThemeState(next);
      if (resolvedPolicy) {
        applyResolvedTheme(next, resolvedPolicy);
      } else {
        applyThemeToDocument(next);
      }
      persistTheme(next);
    },
    [canChangeTheme, resolvedPolicy]
  );

  const toggleTheme = useCallback(() => {
    if (!canChangeTheme) return;
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      if (resolvedPolicy) {
        applyResolvedTheme(next, resolvedPolicy);
      } else {
        applyThemeToDocument(next);
      }
      persistTheme(next);
      return next;
    });
  }, [canChangeTheme, resolvedPolicy]);

  const value = useMemo(
    () => ({
      theme: mounted ? theme : enforcedTheme,
      setTheme,
      toggleTheme,
      canChangeTheme,
    }),
    [mounted, theme, enforcedTheme, setTheme, toggleTheme, canChangeTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
