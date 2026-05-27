"use client";

import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopUtilityStrip } from "@/components/layout/top-utility-strip";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: React.ReactNode;
  orgName: string;
  progressPercent?: number;
  onboardingMode?: boolean;
};

export function DashboardShell({
  children,
  orgName,
  progressPercent = 0,
  onboardingMode = false,
}: DashboardShellProps) {
  const { isOnboardingComplete } = useOnboardingContext();
  const showModuleNav = isOnboardingComplete && !onboardingMode;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopUtilityStrip
        orgName={orgName}
        progressPercent={progressPercent}
        showProgress={onboardingMode || !isOnboardingComplete}
      />
      <div className="flex min-h-0 flex-1">
        {showModuleNav && <SidebarNav />}
        <main
          className={cn(
            "min-w-0 flex-1 overflow-y-auto",
            onboardingMode || !isOnboardingComplete
              ? "mx-auto w-full max-w-5xl px-4 py-4 md:px-6 md:py-10"
              : "px-4 py-4 pb-20 md:p-6 md:pb-6 lg:p-8"
          )}
        >
          {children}
        </main>
      </div>
      {showModuleNav && <MobileBottomNav />}
    </div>
  );
}
