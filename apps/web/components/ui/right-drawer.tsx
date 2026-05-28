"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { Maximize2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aib-right-drawer-width";
const WIDTHS = [40, 60, 80] as const;
type DrawerWidth = (typeof WIDTHS)[number];

/** Tailwind `lg` — below this, drawer is full-width (mobile/tablet). */
const DESKTOP_DRAWER_MEDIA = "(min-width: 1024px)";

type RightDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** When false, children manage their own scroll regions (e.g. sticky nav + footer). */
  scrollable?: boolean;
  bodyRef?: RefObject<HTMLDivElement | null>;
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

function useDesktopDrawerLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_DRAWER_MEDIA);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

export function RightDrawer({
  open,
  onOpenChange,
  title,
  children,
  className,
  scrollable = true,
  bodyRef,
}: RightDrawerProps) {
  const [widthPct, setWidthPct] = useState<DrawerWidth>(40);
  const isDesktopDrawer = useDesktopDrawerLayout();

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

  const panelStyle = isDesktopDrawer
    ? { width: `${widthPct}vw`, maxWidth: `${widthPct}vw` }
    : { width: "100vw", maxWidth: "100vw" };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full flex-col border-l border-border/80 p-0 dark:border-white/10 [&>button:last-of-type]:hidden",
          !isDesktopDrawer && "w-full max-w-full sm:max-w-full",
          className
        )}
        style={panelStyle}
      >
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/80 px-4 py-4 dark:border-white/10 sm:px-6">
          <SheetTitle className="min-w-0 flex-1 truncate text-left text-lg font-semibold sm:text-xl">
            {title}
          </SheetTitle>
          <div className="flex shrink-0 items-center gap-1">
            {isDesktopDrawer && (
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
            )}
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
        <div
          ref={bodyRef}
          className={cn(
            "flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6",
            scrollable ? "overflow-y-auto" : "overflow-hidden"
          )}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
