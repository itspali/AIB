"use client";

import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
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
  const showSidebar = isOnboardingComplete && !onboardingMode;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopUtilityStrip
        orgName={orgName}
        progressPercent={progressPercent}
        showProgress={onboardingMode || !isOnboardingComplete}
      />
      <div className="flex min-h-0 flex-1">
        {showSidebar && <SidebarNav />}
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            onboardingMode || !isOnboardingComplete
              ? "max-w-4xl mx-auto w-full py-10 px-4 md:px-6"
              : "p-4 md:p-6 lg:p-8"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
