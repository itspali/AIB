"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { blurActiveElement } from "@/lib/dom/focus";
import { Maximize2, X } from "lucide-react";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { APP_HEADER_HEIGHT_CLASS, APP_HEADER_PADDING_X_CLASS } from "@/lib/layout/app-chrome";
import { itemDrawerClassName } from "@/lib/layout/overlay-z-index";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aib-right-drawer-width";
export const RIGHT_DRAWER_PRESET_WIDTHS = [40, 60, 80] as const;
const PRESET_WIDTHS = RIGHT_DRAWER_PRESET_WIDTHS;
const DEFAULT_WIDTH_VW = 40;
const MIN_WIDTH_VW = 28;
const MAX_WIDTH_VW = 92;

/** Below this width the drawer uses full viewport (phone). Tablet+ uses partial panel. */
const PARTIAL_DRAWER_MEDIA = "(min-width: 768px)";

export type RightDrawerLayoutValue = {
  widthVw: number;
  isPartialDrawer: boolean;
};

const RightDrawerLayoutContext = createContext<RightDrawerLayoutValue | null>(null);

export function useRightDrawerLayout() {
  return useContext(RightDrawerLayoutContext);
}

/** True when the partial drawer is at the 40vw peek preset (or narrower). */
export function isNarrowRightDrawer(layout: RightDrawerLayoutValue | null): boolean {
  return (
    layout?.isPartialDrawer === true &&
    layout.widthVw <= RIGHT_DRAWER_PRESET_WIDTHS[0] + 0.5
  );
}

function RightDrawerLayoutProvider({
  widthVw,
  isPartialDrawer,
  children,
}: {
  widthVw: number;
  isPartialDrawer: boolean;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ widthVw, isPartialDrawer }),
    [widthVw, isPartialDrawer]
  );
  return (
    <RightDrawerLayoutContext.Provider value={value}>{children}</RightDrawerLayoutContext.Provider>
  );
}

type RightDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Shown beside the title (e.g. item thumbnail). */
  titleLeading?: React.ReactNode;
  /** Replaces the default title text (e.g. inline editable title). */
  titleContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
  bodyRef?: RefObject<HTMLDivElement | null>;
  headerActions?: React.ReactNode;
  allowBackgroundInteraction?: boolean;
  showCloseButton?: boolean;
  onRequestClose?: () => void;
  /** When false, Escape does not dismiss the drawer (e.g. create forms). Default true. */
  closeOnEscape?: boolean;
  /** On open, bump stored width up to this minimum when still at the default 40vw peek size. */
  preferredWidthVw?: number;
  /** Classes applied to the scrollable body region below the header. */
  bodyClassName?: string;
  /** Sticky action bar below the scrollable body (e.g. Save / Cancel). */
  footer?: React.ReactNode;
  /** Pin footer inside the scroll body with a floating backdrop (forms with long content). */
  footerFloating?: boolean;
};

function readStoredWidthVw(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH_VW;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const parsed = stored ? parseFloat(stored) : DEFAULT_WIDTH_VW;
    if (Number.isFinite(parsed)) {
      return Math.min(MAX_WIDTH_VW, Math.max(MIN_WIDTH_VW, parsed));
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDTH_VW;
}

function persistWidthVw(width: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Math.round(width * 10) / 10));
  } catch {
    /* ignore */
  }
}

function usePartialDrawerLayout(): boolean {
  const [isPartial, setIsPartial] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(PARTIAL_DRAWER_MEDIA);
    const sync = () => setIsPartial(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isPartial;
}

type DrawerChromeProps = {
  title: string;
  description?: string;
  titleLeading?: ReactNode;
  titleContent?: ReactNode;
  headerActions?: ReactNode;
  showCloseButton: boolean;
  onClose: () => void;
  isPartialDrawer: boolean;
  widthVw: number;
  onCycleWidth: () => void;
  onNudgeWidth: (deltaVw: number) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  bodyRef?: RefObject<HTMLDivElement | null>;
  scrollable: boolean;
  panelClassName?: string;
  footer?: ReactNode;
  footerFloating?: boolean;
  /** When true, use Radix SheetTitle (mobile sheet only). */
  inSheet: boolean;
  children: ReactNode;
};

const drawerTitleClassName =
  "truncate text-sm font-semibold leading-5 text-foreground";
const drawerDescriptionClassName =
  "min-w-0 w-full truncate font-mono text-xs leading-4 text-muted-foreground";

function DrawerChrome({
  title,
  description,
  titleLeading,
  titleContent,
  headerActions,
  showCloseButton,
  onClose,
  inSheet,
  isPartialDrawer,
  widthVw,
  onCycleWidth,
  onNudgeWidth,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerEnd,
  bodyRef,
  scrollable,
  panelClassName,
  footer,
  footerFloating = false,
  children,
}: DrawerChromeProps) {
  return (
    <>
      {isPartialDrawer ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize drawer"
          aria-valuenow={Math.round(widthVw)}
          aria-valuemin={MIN_WIDTH_VW}
          aria-valuemax={MAX_WIDTH_VW}
          tabIndex={0}
          title="Drag to resize panel"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerEnd}
          onPointerCancel={onResizePointerEnd}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") onNudgeWidth(4);
            if (event.key === "ArrowRight") onNudgeWidth(-4);
          }}
          className={cn(
            "absolute inset-y-0 left-0 z-30 w-2 -translate-x-1/2 touch-none cursor-col-resize border-0 bg-transparent p-0",
            "after:pointer-events-none after:absolute after:inset-y-4 after:left-1/2 after:w-px after:-translate-x-1/2",
            "after:bg-border/50 after:transition-colors",
            "hover:after:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
            "active:after:bg-muted-foreground/35"
          )}
        />
      ) : null}

      <SheetHeader
        className={cn(
          "flex shrink-0 flex-row items-center justify-between gap-2 space-y-0 text-left border-b border-border/80 border-black/[0.06] dark:border-white/10",
          APP_HEADER_HEIGHT_CLASS,
          APP_HEADER_PADDING_X_CLASS
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2">
          {isPartialDrawer ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 shrink-0 p-0"
              onClick={onCycleWidth}
              title={`Panel width ${Math.round(widthVw)}% — click to cycle (40 / 60 / 80)`}
              aria-label={`Panel width ${Math.round(widthVw)}%, click to cycle presets`}
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
          {titleLeading ? <div className="shrink-0">{titleLeading}</div> : null}
          <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
            {titleContent ? (
              <div className="min-w-0 w-full">{titleContent}</div>
            ) : inSheet ? (
              <>
                <SheetTitle className={cn(drawerTitleClassName, "min-w-0 w-full text-left")}>
                  {title}
                </SheetTitle>
                {description ? (
                  <p className={drawerDescriptionClassName}>{description}</p>
                ) : (
                  <SheetDescription className="sr-only">{title}</SheetDescription>
                )}
              </>
            ) : (
              <>
                <h2 className={cn(drawerTitleClassName, "min-w-0 w-full truncate text-left")}>{title}</h2>
                {description ? (
                  <p className={drawerDescriptionClassName}>{description}</p>
                ) : (
                  <p className="sr-only">{title}</p>
                )}
              </>
            )}
            {titleContent && description ? (
              <p className={drawerDescriptionClassName}>{description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {headerActions}
          {showCloseButton ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 shrink-0 p-0"
              onClick={onClose}
              aria-label="Close drawer"
              title="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </SheetHeader>
      {footer && footerFloating ? (
        <div
          ref={bodyRef}
          className={cn(
            "flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6",
            scrollable ? "overflow-x-hidden overflow-y-auto" : "overflow-hidden",
            panelClassName
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
          <footer className="module-drawer-floating-footer sticky bottom-0 z-10 mt-4 shrink-0">
            {footer}
          </footer>
        </div>
      ) : (
        <>
          <div
            ref={bodyRef}
            className={cn(
              "flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6",
              scrollable ? "overflow-x-hidden overflow-y-auto" : "overflow-hidden",
              panelClassName
            )}
          >
            {children}
          </div>
          {footer ? (
            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border/80 border-black/[0.06] bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10 sm:px-6">
              {footer}
            </footer>
          ) : null}
        </>
      )}
    </>
  );
}

export function RightDrawer({
  open,
  onOpenChange,
  title,
  description,
  titleLeading,
  titleContent,
  children,
  className,
  scrollable = true,
  bodyRef,
  headerActions,
  allowBackgroundInteraction = true,
  showCloseButton = true,
  onRequestClose,
  closeOnEscape = true,
  preferredWidthVw,
  bodyClassName,
  footer,
  footerFloating,
}: RightDrawerProps) {
  const [widthVw, setWidthVw] = useState(DEFAULT_WIDTH_VW);
  const [portalReady, setPortalReady] = useState(false);
  const isPartialDrawer = usePartialDrawerLayout();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const stored = readStoredWidthVw();
    if (
      preferredWidthVw != null &&
      stored <= DEFAULT_WIDTH_VW + 0.5 &&
      preferredWidthVw > stored
    ) {
      setWidthVw(preferredWidthVw);
      persistWidthVw(preferredWidthVw);
      return;
    }
    setWidthVw(stored);
  }, [open, preferredWidthVw]);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const cycleWidth = useCallback(() => {
    setWidthVw((current) => {
      const idx = PRESET_WIDTHS.findIndex((w) => w >= current - 0.5);
      const next = PRESET_WIDTHS[(idx + 1) % PRESET_WIDTHS.length];
      persistWidthVw(next);
      return next;
    });
  }, []);

  const nudgeWidth = useCallback((deltaVw: number) => {
    setWidthVw((w) => {
      const next = Math.min(MAX_WIDTH_VW, Math.max(MIN_WIDTH_VW, w + deltaVw));
      persistWidthVw(next);
      return next;
    });
  }, []);

  const panelStyle = isPartialDrawer
    ? {
        width: `${widthVw}vw`,
        minWidth: `${widthVw}vw`,
        maxWidth: `${widthVw}vw`,
      }
    : { width: "100vw", minWidth: "100vw", maxWidth: "100vw" };

  const requestClose = useCallback(() => {
    blurActiveElement();
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    onOpenChange(false);
  }, [onOpenChange, onRequestClose]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOnEscape, open, requestClose]);

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPartialDrawer) return;
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startWidth: widthVw };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const deltaPx = drag.startX - event.clientX;
    const deltaVw = (deltaPx / window.innerWidth) * 100;
    const next = Math.min(MAX_WIDTH_VW, Math.max(MIN_WIDTH_VW, drag.startWidth + deltaVw));
    setWidthVw(next);
  };

  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setWidthVw((current) => {
      persistWidthVw(current);
      return current;
    });
  };

  const chromeProps: DrawerChromeProps = {
    title,
    description,
    titleLeading,
    titleContent,
    headerActions,
    showCloseButton,
    onClose: () => requestClose(),
    inSheet: false,
    isPartialDrawer,
    widthVw,
    onCycleWidth: cycleWidth,
    onNudgeWidth: nudgeWidth,
    onResizePointerDown: handleResizePointerDown,
    onResizePointerMove: handleResizePointerMove,
    onResizePointerEnd: endResize,
    bodyRef,
    scrollable,
    panelClassName: bodyClassName,
    footer,
    footerFloating,
    children,
  };

  if (!open) return null;

  const drawerLayout = (
    <RightDrawerLayoutProvider widthVw={widthVw} isPartialDrawer={isPartialDrawer}>
      <DrawerChrome {...chromeProps} />
    </RightDrawerLayoutProvider>
  );

  const panel = (
    <div
      role="dialog"
      aria-modal={!isPartialDrawer || !allowBackgroundInteraction}
      aria-label={title}
      data-drawer-root
      className={cn(
        "fixed inset-y-0 right-0 flex h-full max-h-[100dvh] flex-col gap-0 overflow-hidden border-l border-border/80 border-black/[0.06] bg-background shadow-2xl dark:border-white/10",
        itemDrawerClassName,
        open && "aib-right-drawer-enter",
        className
      )}
      style={panelStyle}
    >
      {drawerLayout}
    </div>
  );
  return portalReady ? createPortal(panel, document.body) : panel;
}
