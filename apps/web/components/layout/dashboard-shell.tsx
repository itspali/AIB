"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApprovalAlertCountAction } from "@/lib/layout/shell-actions";
import { APPROVAL_ALERT_CHANGED_EVENT } from "@/lib/layout/approval-alert-events";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopUtilityStrip } from "@/components/layout/top-utility-strip";
import { OmnibarProviderLazy } from "@/components/search/omnibar-provider-lazy";
import type { OperatorProfile } from "@/lib/user/types";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: React.ReactNode;
  orgName: string;
  progressPercent?: number;
  onboardingMode?: boolean;
  approvalAlertCount?: number;
  operatorProfile?: OperatorProfile | null;
  tenantId?: string | null;
};

export function DashboardShell({
  children,
  orgName,
  progressPercent = 0,
  onboardingMode = false,
  approvalAlertCount = 0,
  operatorProfile = null,
  tenantId = null,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveApprovalAlertCount, setLiveApprovalAlertCount] = useState(approvalAlertCount);

  const refreshApprovalAlertCount = useCallback(() => {
    void fetchApprovalAlertCountAction().then(setLiveApprovalAlertCount);
  }, []);

  // Only the locked first-run onboarding canvas hides module navigation.
  const isOnboardingLayout = onboardingMode;
  const showModuleNav = !onboardingMode;

  useEffect(() => {
    setLiveApprovalAlertCount(approvalAlertCount);
  }, [approvalAlertCount]);

  useEffect(() => {
    if (!showModuleNav) return;
    const onApprovalAlertChanged = () => refreshApprovalAlertCount();
    window.addEventListener(APPROVAL_ALERT_CHANGED_EVENT, onApprovalAlertChanged);
    return () => window.removeEventListener(APPROVAL_ALERT_CHANGED_EVENT, onApprovalAlertChanged);
  }, [refreshApprovalAlertCount, showModuleNav]);

  return (
    <OmnibarProviderLazy operatorProfile={operatorProfile} tenantId={tenantId}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <div className="relative z-20 w-full shrink-0 border-b border-border bg-background/80 backdrop-blur-xl">
          <TopUtilityStrip
            orgName={orgName}
            progressPercent={progressPercent}
            showProgress={isOnboardingLayout}
            hideWorkspaceTools={isOnboardingLayout}
            approvalAlertCount={showModuleNav ? liveApprovalAlertCount : 0}
            operatorProfile={operatorProfile}
            embedded
            showSidebarToggle={showModuleNav}
            onOpenMobileNav={showModuleNav ? () => setMobileNavOpen(true) : undefined}
          />
        </div>
        <div className="flex min-h-0 flex-1">
          {showModuleNav && <SidebarNav />}
          <main
            data-dashboard-scroll-root
            className={cn(
              "relative min-h-0 min-w-0 flex-1 overflow-y-auto",
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
        {showModuleNav && <MobileBottomNav onOpenMore={() => setMobileNavOpen(true)} />}
        {showModuleNav ? (
          <MobileNavDrawer
            open={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
            orgName={orgName}
          />
        ) : null}
      </div>
    </OmnibarProviderLazy>
  );
}
