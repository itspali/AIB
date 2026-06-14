"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { GlobalCreateMenu } from "@/components/layout/global-create-menu";
import { OrgNavMenuTrigger } from "@/components/layout/org-nav-menu-trigger";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { OmnibarCommandDialog } from "@/components/search/omnibar-command-dialog";
import { OmnibarSearchTrigger } from "@/components/search/omnibar-search-trigger";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OperatorProfile } from "@/lib/user/types";
import { poPendingApprovalListHref } from "@/lib/procurement/navigation";
import { APP_HEADER_HEIGHT_CLASS, APP_HEADER_PADDING_X_CLASS } from "@/lib/layout/app-chrome";
import { cn } from "@/lib/utils";

type TopUtilityStripProps = {
  orgName: string;
  progressPercent?: number;
  showProgress?: boolean;
  hideWorkspaceTools?: boolean;
  approvalAlertCount?: number;
  operatorProfile?: OperatorProfile | null;
  embedded?: boolean;
  showSidebarToggle?: boolean;
  onOpenMobileNav?: () => void;
};

export function TopUtilityStrip({
  orgName,
  progressPercent = 0,
  showProgress = false,
  hideWorkspaceTools = false,
  approvalAlertCount = 0,
  operatorProfile = null,
  embedded = false,
  showSidebarToggle = false,
  onOpenMobileNav,
}: TopUtilityStripProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const omnibar = useOptionalOmnibarContext();

  const orgBranding = (
    <div className="flex min-w-0 items-center gap-2 md:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <OrgNavMenuTrigger
          orgLabel={orgName}
          enableSidebarControl={showSidebarToggle}
          onOpenMobileDrawer={
            showSidebarToggle && onOpenMobileNav ? onOpenMobileNav : undefined
          }
        />
        <span className="truncate text-sm font-semibold">{orgName}</span>
      </div>
      {showProgress && (
        <span className="hidden shrink-0 rounded-full border border-white/10 bg-secondary/80 px-2.5 py-0.5 text-xs text-muted-foreground sm:inline">
          Setup {progressPercent}%
        </span>
      )}
    </div>
  );

  const headerActionSlotClass = "flex h-9 shrink-0 items-center justify-center";

  const headerActions = (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 md:col-start-3 md:justify-self-end",
        embedded ? "justify-self-end" : "justify-end justify-self-end"
      )}
    >
      {omnibar ? (
        <div className={headerActionSlotClass}>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 px-0 md:hidden"
            onClick={omnibar.openCommandPalette}
            aria-label="Open search"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {!hideWorkspaceTools ? (
        <div className={headerActionSlotClass}>
          <GlobalCreateMenu />
        </div>
      ) : null}

      {!hideWorkspaceTools ? (
        <div className={headerActionSlotClass}>
          {approvalAlertCount > 0 ? (
            <Link
              href={poPendingApprovalListHref()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/15 px-2.5 text-xs font-semibold text-amber-800 shadow-sm transition-colors duration-200 hover:bg-amber-500/25 dark:text-amber-300"
              title={`${approvalAlertCount} items need managerial approval`}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="hidden md:inline">Approvals</span>
              <span className="tabular-nums">{approvalAlertCount}</span>
            </Link>
          ) : (
            <Badge variant="locked" className="hidden h-9 rounded-md px-2.5 md:inline-flex">
              All clear
            </Badge>
          )}
        </div>
      ) : null}

      <div className={headerActionSlotClass}>
        <ThemeToggle className="h-9 w-9 px-0" />
      </div>

      <div className={headerActionSlotClass}>
        {operatorProfile ? (
          <UserProfileMenu
            key={`${operatorProfile.userId}-${operatorProfile.firstName}-${operatorProfile.lastName}-${operatorProfile.avatarUrl ?? ""}`}
            profile={operatorProfile}
            onboardingOnly={hideWorkspaceTools}
            onOpenChange={setProfileOpen}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-full border border-transparent px-0 hover:border-white/10"
            aria-label="Account"
            disabled
          >
            <span className="h-4 w-4 rounded-full bg-muted" />
          </Button>
        )}
      </div>
    </div>
  );

  const headerContent = (
    <>
      <div className="min-w-0 md:col-start-1">{orgBranding}</div>

      <div className="hidden min-w-0 md:col-start-2 md:block">
        {omnibar && !hideWorkspaceTools ? <OmnibarSearchTrigger /> : null}
      </div>

      {headerActions}
    </>
  );

  const header = (
    <header
      className={cn(
        APP_HEADER_HEIGHT_CLASS,
        "w-full min-w-0",
        embedded
          ? cn(
              "grid grid-cols-[1fr_auto] items-center gap-2 md:grid-cols-[1fr_minmax(0,20rem)_1fr] md:gap-4",
              APP_HEADER_PADDING_X_CLASS
            )
          : cn(
              "grid items-center gap-2 px-4 md:gap-4 md:px-6",
              "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:grid-cols-[1fr_minmax(0,20rem)_1fr]"
            )
      )}
    >
      {embedded ? (
        <>
          <div className="min-w-0 md:col-start-1">{orgBranding}</div>

          <div className="hidden min-w-0 md:col-start-2 md:block">
            {omnibar && !hideWorkspaceTools ? <OmnibarSearchTrigger /> : null}
          </div>

          {headerActions}
        </>
      ) : (
        headerContent
      )}
    </header>
  );

  return (
    <>
      {embedded ? (
        header
      ) : (
        <div className="relative z-20 shrink-0 border-b border-border bg-background/80 backdrop-blur-xl">
          {header}
        </div>
      )}

      {omnibar && !profileOpen && !hideWorkspaceTools ? <OmnibarCommandDialog /> : null}
    </>
  );
}
