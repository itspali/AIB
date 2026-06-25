"use client";

import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopUtilityStrip } from "@/components/layout/top-utility-strip";
import { OmnibarProviderLazy } from "@/components/search/omnibar-provider-lazy";
import { ImpersonationBanner } from "@/components/console/impersonation-banner";
import { WorkspaceDeletionBanner } from "@/components/settings/workspace-deletion-banner";
import type { ImpersonationBannerContext } from "@/lib/layout/module-page";
import {
  useApprovalAlertInvalidation,
  useShellApprovalAlertCount,
  useShellOperatorProfile,
} from "@/lib/layout/shell-queries";
import type { WorkspaceDeletionStatus } from "@/lib/organization/deletion";
import type { OperatorProfile } from "@/lib/user/types";
import { GLASS_V2_APP_SHELL_ROOT } from "@/lib/layout/list-module-chrome";
import { cn } from "@/lib/utils";
import { useState } from "react";

type DashboardShellProps = {
  children: React.ReactNode;
  orgName: string;
  progressPercent?: number;
  onboardingMode?: boolean;
  approvalAlertCount?: number;
  operatorProfile?: OperatorProfile | null;
  tenantId?: string | null;
  impersonation?: ImpersonationBannerContext | null;
  workspaceDeletion?: WorkspaceDeletionStatus | null;
};

export function DashboardShell({
  children,
  orgName,
  progressPercent = 0,
  onboardingMode = false,
  approvalAlertCount = 0,
  operatorProfile = null,
  tenantId = null,
  impersonation = null,
  workspaceDeletion = null,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isOnboardingLayout = onboardingMode;
  const showModuleNav = !onboardingMode;

  const { data: liveOperatorProfile = operatorProfile } = useShellOperatorProfile(
    tenantId,
    Boolean(impersonation),
    operatorProfile
  );
  const { data: liveApprovalAlertCount = approvalAlertCount } = useShellApprovalAlertCount(
    showModuleNav,
    approvalAlertCount
  );
  useApprovalAlertInvalidation(showModuleNav);

  return (
    <OmnibarProviderLazy operatorProfile={liveOperatorProfile} tenantId={tenantId}>
      <div className={cn("flex h-screen flex-col overflow-hidden", GLASS_V2_APP_SHELL_ROOT)}>
        {impersonation ? (
          <ImpersonationBanner
            tenantName={impersonation.tenantName}
            organizationCode={impersonation.organizationCode}
            mode={impersonation.mode}
          />
        ) : null}
        {workspaceDeletion ? <WorkspaceDeletionBanner deletion={workspaceDeletion} /> : null}
        <div className="glass-v2-app-top-strip relative z-20 w-full shrink-0 border-b backdrop-blur-xl">
          <TopUtilityStrip
            orgName={orgName}
            progressPercent={progressPercent}
            showProgress={isOnboardingLayout}
            hideWorkspaceTools={isOnboardingLayout}
            approvalAlertCount={showModuleNav ? liveApprovalAlertCount : 0}
            operatorProfile={liveOperatorProfile}
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
