"use client";

import { useState } from "react";
import { AlertTriangle, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { Omnibar } from "@/components/search/omnibar";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <>
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between overflow-visible border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
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
          <div className="flex items-center gap-2">
            <span className="hidden h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-xs font-bold text-primary sm:flex">
              A
            </span>
            <span className="max-w-[100px] truncate text-sm font-semibold sm:max-w-none md:max-w-[160px]">
              {orgName}
            </span>
          </div>
          {showProgress && (
            <span className="shrink-0 rounded-full border border-white/10 bg-secondary/80 px-2.5 py-0.5 text-xs text-muted-foreground">
              Setup {progressPercent}%
            </span>
          )}
        </div>

        <div className="absolute left-1/2 hidden w-full max-w-2xl -translate-x-1/2 px-16 md:block lg:px-20">
          <Omnibar />
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5 overflow-visible">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Open search"
          >
            <span className="text-xs font-medium">Search</span>
          </Button>

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

      {mobileSearchOpen && !profileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSearchOpen(false)}
          role="presentation"
        >
          <div
            className="border-b border-border bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Mobile search"
          >
            <Omnibar mobile />
          </div>
        </div>
      )}
    </>
  );
}
