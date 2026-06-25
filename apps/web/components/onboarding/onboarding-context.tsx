"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type OnboardingContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  isOnboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;
  hasWorkspaceAccess: boolean;
  setHasWorkspaceAccess: (v: boolean) => void;
  importsEnabled: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  children,
  initialComplete,
  initialWorkspaceAccess,
  initialImportsEnabled = false,
}: {
  children: React.ReactNode;
  initialComplete: boolean;
  initialWorkspaceAccess: boolean;
  initialImportsEnabled?: boolean;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnboardingComplete, setOnboardingComplete] = useState(initialComplete);
  const [hasWorkspaceAccess, setHasWorkspaceAccess] = useState(initialWorkspaceAccess);
  const [importsEnabled, setImportsEnabled] = useState(initialImportsEnabled);

  useEffect(() => {
    setOnboardingComplete(initialComplete);
  }, [initialComplete]);

  useEffect(() => {
    setHasWorkspaceAccess(initialWorkspaceAccess);
  }, [initialWorkspaceAccess]);

  useEffect(() => {
    setImportsEnabled(initialImportsEnabled);
  }, [initialImportsEnabled]);

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
      hasWorkspaceAccess,
      setHasWorkspaceAccess,
      importsEnabled,
    }),
    [sidebarCollapsed, isOnboardingComplete, hasWorkspaceAccess, importsEnabled]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingContext() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingContext must be used within OnboardingProvider");
  return ctx;
}
