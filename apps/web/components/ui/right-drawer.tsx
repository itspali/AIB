"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aib-right-drawer-width";
const WIDTHS = [40, 60, 80] as const;
type DrawerWidth = (typeof WIDTHS)[number];

type RightDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
};

function readStoredWidth(): DrawerWidth {
  if (typeof window === "undefined") return 40;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const parsed = stored ? parseInt(stored, 10) : 40;
    if (WIDTHS.includes(parsed as DrawerWidth)) return parsed as DrawerWidth;
  } catch {
    /* ignore */
  }
  return 40;
}

export function RightDrawer({ open, onOpenChange, title, children, className }: RightDrawerProps) {
  const [widthPct, setWidthPct] = useState<DrawerWidth>(40);

  useEffect(() => {
    setWidthPct(readStoredWidth());
  }, []);

  const cycleWidth = useCallback(() => {
    setWidthPct((current) => {
      const idx = WIDTHS.indexOf(current);
      const next = WIDTHS[(idx + 1) % WIDTHS.length];
      try {
        sessionStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full flex-col border-l border-border/80 p-0 dark:border-white/10 [&>button:last-of-type]:hidden",
          className
        )}
        style={{ width: `${widthPct}vw`, maxWidth: `${widthPct}vw` }}
      >
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/80 px-6 py-4 dark:border-white/10">
          <SheetTitle className="text-xl font-semibold">{title}</SheetTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cycleWidth}
              title={`Panel width ${widthPct}% — click to resize`}
              aria-label={`Resize drawer, currently ${widthPct} percent width`}
            >
              <Maximize2 className="h-4 w-4" />
              <span className="text-xs tabular-nums">{widthPct}%</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
