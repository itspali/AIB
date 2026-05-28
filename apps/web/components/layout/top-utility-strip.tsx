"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Command, Menu, Search, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OperatorProfile } from "@/lib/user/types";
import { cn } from "@/lib/utils";

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
  const [commandOpen, setCommandOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const commandRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (profileOpen) return;
        setCommandOpen(false);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        commandRef.current?.focus();
      }
    },
    [profileOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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

        <div className="absolute left-1/2 hidden w-full max-w-lg -translate-x-1/2 px-20 md:block">
          <button
            ref={commandRef}
            type="button"
            onClick={() => setCommandOpen(true)}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-4 text-sm text-muted-foreground shadow-sm backdrop-blur-md transition-all duration-200 hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:shadow-glow-sm",
              commandOpen && "border-primary/40 ring-2 ring-primary/20"
            )}
            aria-label="Search commands"
          >
            <Search className="h-4 w-4 shrink-0 text-primary/70" />
            <span className="flex-1 text-left">Search modules, actions, records…</span>
            <kbd className="hidden items-center gap-0.5 rounded-md border border-white/10 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium lg:inline-flex">
              <Command className="h-3 w-3" />K
            </kbd>
          </button>
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5 overflow-visible">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setCommandOpen(true)}
            aria-label="Search commands"
          >
            <Search className="h-4 w-4" />
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

      {commandOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[12vh]"
          onClick={() => setCommandOpen(false)}
          role="presentation"
        >
          <div
            className="mx-4 w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Command search"
          >
            <div className="border-b border-white/10 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Command Palette</span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-background/60 px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  placeholder="Jump to Procurement, Inventory, Sales…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded border border-white/10 bg-muted px-1.5 py-0.5 text-[10px]">
                  Esc
                </kbd>
              </div>
              <div className="mt-4 space-y-1">
                {["Dashboard", "Procurement", "Inventory", "Sales", "Financials"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-foreground"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Full navigation wiring ships in the next release — layout and shortcuts are ready.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
