"use client";

import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SidebarHeaderToggleColumn } from "@/components/layout/sidebar-nav";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { OmnibarCommandDialog } from "@/components/search/omnibar-command-dialog";
import { OmnibarSearchTrigger } from "@/components/search/omnibar-search-trigger";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OperatorProfile } from "@/lib/user/types";
import { cn } from "@/lib/utils";

type TopUtilityStripProps = {
  orgName: string;
  progressPercent?: number;
  showProgress?: boolean;
  approvalAlertCount?: number;
  operatorProfile?: OperatorProfile | null;
  embedded?: boolean;
  showSidebarToggle?: boolean;
};

export function TopUtilityStrip({
  orgName,
  progressPercent = 0,
  showProgress = false,
  approvalAlertCount = 0,
  operatorProfile = null,
  embedded = false,
  showSidebarToggle = false,
}: TopUtilityStripProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const omnibar = useOptionalOmnibarContext();
  const { sidebarCollapsed } = useOnboardingContext();

  const orgInSidebarColumn = embedded && showSidebarToggle && !sidebarCollapsed;

  const orgBranding = (
    <div className="flex min-w-0 items-center gap-2 md:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-xs font-bold text-primary sm:flex">
          A
        </span>
        <span className="truncate text-sm font-semibold">
          {orgName}
        </span>
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
        "flex shrink-0 items-center gap-1.5",
        embedded ? "ml-auto" : "justify-end justify-self-end"
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

      {approvalAlertCount > 0 ? (
        <Badge
          variant="action_required"
          className="gap-1.5 border border-amber-500/20 shadow-sm transition-colors duration-200"
          title={`${approvalAlertCount} items need managerial approval`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span className="hidden md:inline">Approvals</span>
          <span className="tabular-nums">{approvalAlertCount}</span>
        </Badge>
      ) : (
        <Badge variant="locked" className="hidden md:inline-flex">
          All clear
        </Badge>
      )}

      <ThemeToggle />

      {operatorProfile ? (
        <UserProfileMenu
          key={`${operatorProfile.userId}-${operatorProfile.firstName}-${operatorProfile.lastName}-${operatorProfile.avatarUrl ?? ""}`}
          profile={operatorProfile}
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
      {!orgInSidebarColumn ? orgBranding : null}

      <div
        className={cn(
          "hidden min-w-0 md:block",
          embedded ? "min-w-0 flex-1" : undefined
        )}
      >
        {omnibar ? <OmnibarSearchTrigger /> : null}
      </div>

      {headerActions}
    </>
  );

  const header = (
    <header
      className={cn(
        "h-16 w-full min-w-0",
        embedded
          ? "flex items-center"
          : cn(
              "grid items-center gap-2 px-4 md:gap-4 md:px-6",
              "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:grid-cols-[1fr_minmax(0,28rem)_1fr]"
            )
      )}
    >
      {embedded && showSidebarToggle ? (
        <SidebarHeaderToggleColumn
          branding={orgInSidebarColumn ? orgBranding : undefined}
        />
      ) : null}

      {embedded ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2 pr-4 md:gap-4 md:pl-3 md:pr-6">
          {headerContent}
        </div>
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

      {omnibar && !profileOpen ? <OmnibarCommandDialog /> : null}
    </>
  );
}
