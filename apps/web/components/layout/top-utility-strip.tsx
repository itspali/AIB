"use client";

import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { GlobalCreateMenu } from "@/components/layout/global-create-menu";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { OmnibarCommandDialog } from "@/components/search/omnibar-command-dialog";
import { OmnibarSearchTrigger } from "@/components/search/omnibar-search-trigger";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OperatorProfile } from "@/lib/user/types";
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

  const orgLogo = (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-xs font-bold text-primary">
      A
    </span>
  );

  const orgBranding = (
    <div className="flex min-w-0 items-center gap-2 md:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {orgLogo}
        <span className="truncate text-sm font-semibold">{orgName}</span>
      </div>
      {showProgress && (
        <span className="hidden shrink-0 rounded-full border border-white/10 bg-secondary/80 px-2.5 py-0.5 text-xs text-muted-foreground sm:inline">
          Setup {progressPercent}%
        </span>
      )}
    </div>
  );

  const headerActions = (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 md:col-start-3 md:justify-self-end",
        embedded ? "justify-self-end" : "justify-end justify-self-end"
      )}
    >
      {omnibar ? (
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={omnibar.openCommandPalette}
          aria-label="Open search"
        >
          <Search className="h-4 w-4" />
        </Button>
      ) : null}

      {!hideWorkspaceTools ? <GlobalCreateMenu /> : null}

      {approvalAlertCount > 0 && !hideWorkspaceTools ? (
        <Badge
          variant="action_required"
          className="gap-1.5 border border-amber-500/20 shadow-sm transition-colors duration-200"
          title={`${approvalAlertCount} items need managerial approval`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span className="hidden md:inline">Approvals</span>
          <span className="tabular-nums">{approvalAlertCount}</span>
        </Badge>
      ) : hideWorkspaceTools ? null : (
        <Badge variant="locked" className="hidden md:inline-flex">
          All clear
        </Badge>
      )}

      <ThemeToggle />

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
          className="rounded-full border border-transparent hover:border-white/10"
          aria-label="Account"
          disabled
        >
          <span className="h-4 w-4 rounded-full bg-muted" />
        </Button>
      )}
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
        "h-16 w-full min-w-0",
        embedded
          ? "grid grid-cols-[1fr_auto] items-center gap-2 px-3 md:grid-cols-[1fr_minmax(0,20rem)_1fr] md:gap-4 md:px-4"
          : cn(
              "grid items-center gap-2 px-4 md:gap-4 md:px-6",
              "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:grid-cols-[1fr_minmax(0,20rem)_1fr]"
            )
      )}
    >
      {embedded ? (
        <>
          <div className="flex min-w-0 items-center md:col-start-1">
            {showSidebarToggle && onOpenMobileNav ? (
              <button
                type="button"
                onClick={onOpenMobileNav}
                aria-label="Open navigation menu"
                className="flex items-center rounded-lg p-1 transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              >
                {orgLogo}
              </button>
            ) : (
              <span className="md:hidden">{orgLogo}</span>
            )}

            <div className="hidden min-w-0 md:flex">{orgBranding}</div>
          </div>

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
