"use client";

import { useState } from "react";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopUtilityStrip } from "@/components/layout/top-utility-strip";
import type { OperatorProfile } from "@/lib/user/types";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: React.ReactNode;
  orgName: string;
  progressPercent?: number;
  onboardingMode?: boolean;
  approvalAlertCount?: number;
  operatorProfile?: OperatorProfile | null;
};

export function DashboardShell({
  children,
  orgName,
  progressPercent = 0,
  onboardingMode = false,
  approvalAlertCount = 0,
  operatorProfile = null,
}: DashboardShellProps) {
  const { isOnboardingComplete } = useOnboardingContext();
  const showModuleNav = isOnboardingComplete && !onboardingMode;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isOnboardingLayout = onboardingMode || !isOnboardingComplete;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopUtilityStrip
        orgName={orgName}
        progressPercent={progressPercent}
        showProgress={isOnboardingLayout}
        approvalAlertCount={showModuleNav ? approvalAlertCount : 0}
        onMobileMenuOpen={showModuleNav ? () => setMobileNavOpen(true) : undefined}
        operatorProfile={operatorProfile}
      />
      <div className="flex min-h-0 flex-1">
        {showModuleNav && <SidebarNav />}
        <main
          data-dashboard-scroll-root
          className={cn(
            "relative min-w-0 flex-1 overflow-y-auto",
            isOnboardingLayout ? "mx-auto w-full max-w-5xl hub-canvas" : "hub-canvas"
          )}
        >
          {showModuleNav && (
            <div className="pointer-events-none absolute inset-0 hub-grid opacity-60" aria-hidden />
          )}
          <div
            className={cn(
              "relative min-h-full",
              isOnboardingLayout
                ? "px-4 py-4 pb-10 md:px-6 md:py-10"
                : "canvas-workspace-pad"
            )}
          >
            {children}
          </div>
        </main>
      </div>
      {showModuleNav && (
        <>
          <MobileNavDrawer
            open={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
            orgName={orgName}
          />
          <MobileBottomNav />
        </>
      )}
    </div>
  );
}
