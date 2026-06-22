"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { ConsoleNav } from "@/components/console/console-nav";
import { ConsoleTopStrip } from "@/components/console/console-top-strip";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AppConsoleRole } from "@/lib/console/types";
import { cn } from "@/lib/utils";

type ConsoleShellProps = {
  children: React.ReactNode;
  operatorEmail: string;
  operatorRole: AppConsoleRole;
};

export function ConsoleShell({ children, operatorEmail, operatorRole }: ConsoleShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <ConsoleTopStrip operatorEmail={operatorEmail} operatorRole={operatorRole} />

      <div
        className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-center text-xs font-medium text-amber-900 dark:text-amber-200"
        role="status"
      >
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>App Console · Internal</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-card/40 md:block">
          <ConsoleNav />
        </aside>

        <main
          data-console-scroll-root
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto hub-canvas"
        >
          <div className="pointer-events-none absolute inset-0 hub-grid opacity-40" aria-hidden />
          <div className="relative min-h-full canvas-workspace-pad">
            <div className="mb-4 md:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMobileNavOpen(true)}
              >
                Console menu
              </Button>
            </div>
            {children}
          </div>
        </main>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className={cn("w-72 p-0")}>
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle>App Console</SheetTitle>
            <SheetDescription>Platform operations navigation</SheetDescription>
          </SheetHeader>
          <ConsoleNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
