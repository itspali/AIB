"use client";

import { useState } from "react";
import { AlertTriangle, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { OmnibarCommandDialog } from "@/components/search/omnibar-command-dialog";
import { OmnibarFilterChipBar } from "@/components/search/omnibar-filter-chip-bar";
import { OmnibarSearchTrigger } from "@/components/search/omnibar-search-trigger";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OperatorProfile } from "@/lib/user/types";

type TopUtilityStripProps = {
  orgName: string;
  progressPercent?: number;
  showProgress?: boolean;
  approvalAlertCount?: number;
  onMobileMenuOpen?: () => void;
  operatorProfile?: OperatorProfile | null;
};

export function TopUtilityStrip({
  orgName,
  progressPercent = 0,
  showProgress = false,
  approvalAlertCount = 0,
  onMobileMenuOpen,
  operatorProfile = null,
}: TopUtilityStripProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const omnibar = useOptionalOmnibarContext();

  return (
    <>
      <div className="relative z-20 shrink-0 border-b border-border bg-background/80 backdrop-blur-xl">
        <header className="grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 md:grid-cols-[1fr_minmax(0,28rem)_1fr] md:gap-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            {onMobileMenuOpen && (
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={onMobileMenuOpen}
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-xs font-bold text-primary sm:flex">
                A
              </span>
              <span className="truncate text-sm font-semibold md:max-w-[160px]">
                {orgName}
              </span>
            </div>
            {showProgress && (
              <span className="hidden shrink-0 rounded-full border border-white/10 bg-secondary/80 px-2.5 py-0.5 text-xs text-muted-foreground sm:inline">
                Setup {progressPercent}%
              </span>
            )}
          </div>

          <div className="hidden min-w-0 md:block">
            {omnibar ? <OmnibarSearchTrigger /> : null}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5 justify-self-end">
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
        </header>

        {omnibar ? <OmnibarFilterChipBar /> : null}
      </div>

      {omnibar && !profileOpen ? <OmnibarCommandDialog /> : null}
    </>
  );
}
