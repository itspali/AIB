"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAvailablePaneHeight } from "@/lib/layout/use-viewport-remaining-height";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aib-split-pane-detail-width";
const DEFAULT_WIDTH_PCT = 70;
const MIN_WIDTH_PCT = 40;
const MAX_WIDTH_PCT = 90;

const DESKTOP_SPLIT_MEDIA = "(min-width: 1024px)";

function clampWidthPct(value: number): number {
  return Math.round(Math.max(MIN_WIDTH_PCT, Math.min(value, MAX_WIDTH_PCT)) * 10) / 10;
}

function readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH_PCT;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const parsed = stored ? parseFloat(stored) : DEFAULT_WIDTH_PCT;
    if (Number.isFinite(parsed)) {
      if (parsed === 40 || parsed === 60 || parsed === 80) return DEFAULT_WIDTH_PCT;
      return clampWidthPct(parsed);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDTH_PCT;
}

function persistWidth(pct: number): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(clampWidthPct(pct)));
  } catch {
    /* ignore */
  }
}

function useDesktopSplitLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_SPLIT_MEDIA);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

type SplitPaneLayoutProps = {
  primary: ReactNode;
  detail?: ReactNode | null;
  detailOpen?: boolean;
  onDetailClose?: () => void;
  detailTitle?: string;
  detailDescription?: string;
  /** Avatar/thumbnail shown before the title block (e.g. item primary image). */
  detailLeading?: ReactNode;
  detailActions?: ReactNode;
  className?: string;
  primaryClassName?: string;
  detailClassName?: string;
  /** When true, adds inset padding around the primary pane (compact/card view). */
  insetPrimary?: boolean;
  /** When true, fill the parent flex slot instead of measuring viewport height. */
  fillParent?: boolean;
};

export function SplitPaneLayout({
  primary,
  detail = null,
  detailOpen = false,
  onDetailClose,
  detailTitle = "Detail",
  detailDescription,
  detailLeading,
  detailActions,
  className,
  primaryClassName,
  detailClassName,
  insetPrimary = false,
  fillParent = false,
}: SplitPaneLayoutProps) {
  const { ref: containerRef, height: paneHeight } = useAvailablePaneHeight(!fillParent);
  const widthPctRef = useRef(DEFAULT_WIDTH_PCT);
  const [widthPct, setWidthPct] = useState(DEFAULT_WIDTH_PCT);
  const [isResizing, setIsResizing] = useState(false);
  const isDesktopSplit = useDesktopSplitLayout();
  const showDetail = detailOpen && detail != null && isDesktopSplit;

  useEffect(() => {
    const stored = readStoredWidth();
    widthPctRef.current = stored;
    setWidthPct(stored);
  }, []);

  const updateWidthFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const widthPx = rect.right - clientX;
    const next = clampWidthPct((widthPx / rect.width) * 100);
    widthPctRef.current = next;
    setWidthPct(next);
  }, [containerRef]);

  const startResize = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      setIsResizing(true);

      const handleMove = (moveEvent: MouseEvent) => {
        updateWidthFromClientX(moveEvent.clientX);
      };

      const handleUp = () => {
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        setIsResizing(false);
        persistWidth(widthPctRef.current);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [updateWidthFromClientX]
  );

  const resetWidth = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    widthPctRef.current = DEFAULT_WIDTH_PCT;
    setWidthPct(DEFAULT_WIDTH_PCT);
    persistWidth(DEFAULT_WIDTH_PCT);
  }, []);

  const paneStyle =
    fillParent || paneHeight == null
      ? undefined
      : { height: paneHeight, maxHeight: paneHeight };

  const containerStyle = showDetail
    ? {
        ...(paneStyle ?? {}),
        gridTemplateColumns: `minmax(0, 1fr) ${widthPct}%`,
      }
    : paneStyle;

  const insetList = insetPrimary && showDetail;

  const listPaneClassName = cn(
    "min-h-0 min-w-0",
    insetList && "p-3 md:p-4",
    showDetail
      ? "h-full max-h-full overflow-hidden"
      : "h-full max-h-full flex-1 basis-0 overflow-hidden",
    insetList && "rounded-none border border-border/70 bg-background dark:border-white/10",
    primaryClassName
  );

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={cn(
        "relative flex min-h-0 w-full overflow-hidden border-0 bg-transparent shadow-none",
        fillParent && "h-full min-h-0 flex-1 basis-0",
        insetList && "p-1.5",
        showDetail ? "grid gap-1.5" : "flex flex-col",
        isResizing && "select-none",
        className
      )}
    >
      <div className={listPaneClassName}>{primary}</div>

      {showDetail ? (
        <aside
          className={cn(
            "relative flex h-full max-h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-none border border-border/70 bg-background dark:border-white/10",
            detailClassName
          )}
        >
          <button
            type="button"
            aria-label="Resize detail panel"
            title="Drag to resize. Double-click to reset."
            onMouseDown={startResize}
            onDoubleClick={resetWidth}
            className={cn(
              "absolute inset-y-0 -left-[calc(0.375rem+2px)] z-30 w-[calc(0.75rem+4px)] touch-none cursor-col-resize border-0 bg-transparent p-0",
              "after:absolute after:inset-y-3 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border/80",
              "hover:after:bg-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isResizing && "after:bg-primary"
            )}
          />

          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-4 py-3 dark:border-white/10">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {detailLeading}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">{detailTitle}</h2>
                {detailDescription ? (
                  <p className="truncate text-xs text-muted-foreground">{detailDescription}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {detailActions}
              {onDetailClose ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onDetailClose}
                  aria-label="Close detail panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto scroll-pt-5 scrollbar-none">
            <div className="px-4 pb-4 pt-3">{detail}</div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
