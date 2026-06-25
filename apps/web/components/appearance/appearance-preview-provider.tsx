"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_APPEARANCE_PREVIEW,
  type AppearancePreviewState,
  type UiDensity,
  type UiGeneration,
  type UiHeaderChrome,
  type UiVisualStyle,
} from "@/lib/appearance/types";
import {
  persistAppearancePreviewState,
  readAppearancePreviewState,
} from "@/lib/appearance/storage";

type AppearancePreviewContextValue = {
  state: AppearancePreviewState;
  setGeneration: (generation: UiGeneration) => void;
  setVisual: (visual: UiVisualStyle) => void;
  setDensity: (density: UiDensity) => void;
  setHeaderChrome: (headerChrome: UiHeaderChrome) => void;
  reset: () => void;
  isPreview: boolean;
  isMatrix: boolean;
};

const AppearancePreviewContext = createContext<AppearancePreviewContextValue | null>(null);

type AppearancePreviewProviderProps = {
  children: React.ReactNode;
};

export function AppearancePreviewProvider({ children }: AppearancePreviewProviderProps) {
  const [state, setState] = useState<AppearancePreviewState>(DEFAULT_APPEARANCE_PREVIEW);

  useEffect(() => {
    setState(readAppearancePreviewState());
  }, []);

  const setGeneration = useCallback((generation: UiGeneration) => {
    setState((prev) => {
      const next = { ...prev, generation };
      persistAppearancePreviewState(next);
      return next;
    });
  }, []);

  const setVisual = useCallback((visual: UiVisualStyle) => {
    setState((prev) => {
      const next = { ...prev, visual };
      persistAppearancePreviewState(next);
      return next;
    });
  }, []);

  const setDensity = useCallback((density: UiDensity) => {
    setState((prev) => {
      const next = { ...prev, density };
      persistAppearancePreviewState(next);
      return next;
    });
  }, []);

  const setHeaderChrome = useCallback((headerChrome: UiHeaderChrome) => {
    setState((prev) => {
      const next = { ...prev, headerChrome };
      persistAppearancePreviewState(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_APPEARANCE_PREVIEW);
    persistAppearancePreviewState(DEFAULT_APPEARANCE_PREVIEW);
  }, []);

  const value = useMemo(
    () => ({
      state,
      setGeneration,
      setVisual,
      setDensity,
      setHeaderChrome,
      reset,
      isPreview: state.generation !== "classic",
      isMatrix: state.generation === "matrix",
    }),
    [state, setGeneration, setVisual, setDensity, setHeaderChrome, reset]
  );

  return (
    <AppearancePreviewContext.Provider value={value}>{children}</AppearancePreviewContext.Provider>
  );
}

export function useAppearancePreview() {
  const context = useContext(AppearancePreviewContext);
  if (!context) {
    throw new Error("useAppearancePreview must be used within AppearancePreviewProvider");
  }
  return context;
}

/** Safe outside preview routes — catalog/list modules use this to opt into revamp chrome. */
export function useOptionalAppearancePreview() {
  return useContext(AppearancePreviewContext);
}
