"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type OnboardingContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  isOnboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  children,
  initialComplete,
}: {
  children: React.ReactNode;
  initialComplete: boolean;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnboardingComplete, setOnboardingComplete] = useState(initialComplete);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    if (mq.matches) setSidebarCollapsed(true);
  }, []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      isOnboardingComplete,
      setOnboardingComplete,
    }),
    [sidebarCollapsed, isOnboardingComplete]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingContext() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingContext must be used within OnboardingProvider");
  return ctx;
}
