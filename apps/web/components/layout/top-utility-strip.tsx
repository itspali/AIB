"use client";

import { Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type TopUtilityStripProps = {
  orgName: string;
  progressPercent?: number;
  showProgress?: boolean;
};

export function TopUtilityStrip({ orgName, progressPercent = 0, showProgress = false }: TopUtilityStripProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{orgName}</span>
        {showProgress && (
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
            Setup {progressPercent}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="hidden md:inline-flex">
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
        <Button variant="ghost" size="sm">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
