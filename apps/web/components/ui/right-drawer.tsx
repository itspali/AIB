"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { blurActiveElement } from "@/lib/dom/focus";
import { X } from "lucide-react";
import { DrawerPopOutButton } from "@/components/layout/drawer-pop-out-button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { APP_HEADER_HEIGHT_CLASS, APP_HEADER_PADDING_X_CLASS } from "@/lib/layout/app-chrome";
import {
  DRAWER_WIDTH_MUTATE_VW,
  DRAWER_WIDTH_PEEK_VW,
  type DrawerWidthPolicy,
  resolveDrawerWidthVw,
} from "@/lib/layout/drawer-width-policy";
import { itemDrawerClassName } from "@/lib/layout/overlay-z-index";
import {
  resolveRightDrawerSurfaceVariant,
  rightDrawerGlassBodyClassName,
  rightDrawerGlassSurfaceClassName,
  type RightDrawerSurfaceVariant,
} from "@/lib/layout/right-drawer-surface";
import { useListWorkspaceSplitDetailHost } from "@/lib/layout/list-workspace-split-detail-context";
import {
  useRightDrawerPresentation,
  type RightDrawerPresentation,
} from "@/lib/layout/use-right-drawer-presentation";
import { cn } from "@/lib/utils";

/** @deprecated Fixed-width policy replaces preset cycling — kept for layout helpers. */
export const RIGHT_DRAWER_PRESET_WIDTHS = [
  DRAWER_WIDTH_PEEK_VW,
  DRAWER_WIDTH_MUTATE_VW,
  80,
  100,
] as const;

export const RIGHT_DRAWER_FULL_WIDTH_VW =
  RIGHT_DRAWER_PRESET_WIDTHS[RIGHT_DRAWER_PRESET_WIDTHS.length - 1];

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

/** True when the partial drawer uses the narrow peek width. */
export function isNarrowRightDrawer(layout: RightDrawerLayoutValue | null): boolean {
  return (
    layout?.isPartialDrawer === true &&
    layout.widthVw <= DRAWER_WIDTH_PEEK_VW + 0.5
  );
}

/** True when the drawer is at the 100% expansion preset (full workspace width). */
export function isFullWidthRightDrawer(layout: RightDrawerLayoutValue | null): boolean {
  return layout != null && layout.widthVw >= RIGHT_DRAWER_FULL_WIDTH_VW - 0.5;
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
  /**
   * Fixed partial-drawer width. Defaults to `"mutate"` (60vw).
   * Use `"peek"` for read-only peeks (42vw).
   */
  widthPolicy?: DrawerWidthPolicy;
  /**
   * @deprecated Use {@link widthPolicy}. Ignored when `widthPolicy` is set.
   */
  preferredWidthVw?: number;
  /** Open the same record in a new tab or pop-out window (replaces width cycle control). */
  popOutHref?: string;
  /** Classes applied to the scrollable body region below the header. */
  bodyClassName?: string;
  /** Sticky action bar below the scrollable body (e.g. Save / Cancel). */
  footer?: React.ReactNode;
  /** Pin footer inside the scroll body with a floating backdrop (forms with long content). */
  footerFloating?: boolean;
  /** When true, peek surfaces adapt to list workspace split/matrix layout. */
  peekMode?: boolean;
  /** Override workspace-driven peek presentation. */
  presentation?: RightDrawerPresentation;
  /** Frosted shell for mutate-width drawers only; peek and document drawers stay default. */
  surfaceVariant?: RightDrawerSurfaceVariant;
};

/** @deprecated Session width storage removed — returns default mutate width. */
export function readRightDrawerStoredWidthVw(): number {
  return DRAWER_WIDTH_MUTATE_VW;
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
  popOutHref?: string;
  bodyRef?: RefObject<HTMLDivElement | null>;
  scrollable: boolean;
  panelClassName?: string;
  footer?: ReactNode;
  footerFloating?: boolean;
  /** When true, use Radix SheetTitle (mobile sheet only). */
  inSheet: boolean;
  workspacePresentation?: RightDrawerPresentation;
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
  popOutHref,
  bodyRef,
  scrollable,
  panelClassName,
  footer,
  footerFloating = false,
  workspacePresentation = "overlay",
  children,
}: DrawerChromeProps) {
  const overlayChrome = workspacePresentation === "overlay";
  const splitInlineChrome = workspacePresentation === "inline-panel";
  const matrixPeekChrome = workspacePresentation === "matrix-panel";
  const catalogDetailChrome = splitInlineChrome || matrixPeekChrome;
  const showPopOut =
    Boolean(popOutHref?.trim()) &&
    (catalogDetailChrome || (overlayChrome && isPartialDrawer));

  const headerChrome = (
    <>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 gap-2",
          catalogDetailChrome ? "items-start" : "items-center"
        )}
      >
        {showPopOut && popOutHref ? (
          <DrawerPopOutButton href={popOutHref} />
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
              <h2
                className={cn(
                  catalogDetailChrome
                    ? "spatial-detail-id min-w-0 w-full truncate text-left"
                    : cn(drawerTitleClassName, "min-w-0 w-full truncate text-left")
                )}
              >
                {title}
              </h2>
              {description ? (
                <p
                  className={cn(
                    catalogDetailChrome
                      ? "spatial-detail-name truncate"
                      : drawerDescriptionClassName
                  )}
                >
                  {description}
                </p>
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
    </>
  );

  const catalogDetailBodyClass = catalogDetailChrome ? "spatial-detail-body" : "px-4 py-4 sm:px-6";

  return (
    <>
      {catalogDetailChrome ? (
        <header className="spatial-detail-header shrink-0">{headerChrome}</header>
      ) : (
        <SheetHeader
          className={cn(
            "flex shrink-0 flex-row items-center justify-between gap-2 space-y-0 text-left border-b border-border/80 border-black/[0.06] dark:border-white/10",
            APP_HEADER_HEIGHT_CLASS,
            APP_HEADER_PADDING_X_CLASS
          )}
        >
          {headerChrome}
        </SheetHeader>
      )}
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
              "flex min-h-0 flex-1 flex-col",
              catalogDetailBodyClass,
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
  widthPolicy = "mutate",
  preferredWidthVw: _preferredWidthVw,
  popOutHref,
  bodyClassName,
  footer,
  footerFloating,
  peekMode = false,
  presentation: presentationOverride,
  surfaceVariant = "default",
}: RightDrawerProps) {
  const widthVw = resolveDrawerWidthVw(widthPolicy);
  const glassSurface =
    resolveRightDrawerSurfaceVariant(widthPolicy, surfaceVariant) === "glass";
  const [portalReady, setPortalReady] = useState(false);
  const isPartialDrawer = usePartialDrawerLayout();
  const splitDetailHost = useListWorkspaceSplitDetailHost();
  const autoPresentation = useRightDrawerPresentation({ peekMode });
  const resolvedPresentation = presentationOverride ?? autoPresentation;
  const [inlineHostReady, setInlineHostReady] = useState(false);

  useEffect(() => {
    if (resolvedPresentation !== "inline-panel" || !open) {
      setInlineHostReady(false);
      return;
    }
    const sync = () => {
      if (splitDetailHost?.hostRef.current) {
        setInlineHostReady(true);
      }
    };
    sync();
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, [open, resolvedPresentation, splitDetailHost?.hostRef]);

  useEffect(() => {
    setPortalReady(true);
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

  const effectiveShowClose =
    showCloseButton &&
    (resolvedPresentation === "overlay" ||
      (resolvedPresentation === "matrix-panel" && allowBackgroundInteraction));

  const layoutProviderValue = useMemo(() => {
    if (resolvedPresentation === "inline-panel") {
      return { widthVw: DRAWER_WIDTH_PEEK_VW, isPartialDrawer: false };
    }
    if (resolvedPresentation === "matrix-panel") {
      return { widthVw: DRAWER_WIDTH_MUTATE_VW, isPartialDrawer: false };
    }
    return { widthVw, isPartialDrawer };
  }, [isPartialDrawer, resolvedPresentation, widthVw]);

  const chromeProps: DrawerChromeProps = {
    title,
    description,
    titleLeading,
    titleContent,
    headerActions,
    showCloseButton: effectiveShowClose,
    onClose: () => requestClose(),
    inSheet: false,
    isPartialDrawer: layoutProviderValue.isPartialDrawer,
    popOutHref,
    bodyRef,
    scrollable,
    panelClassName: rightDrawerGlassBodyClassName(glassSurface, bodyClassName),
    footer,
    footerFloating,
    workspacePresentation: resolvedPresentation,
    children,
  };

  if (!open) return null;

  const drawerLayout = (
    <RightDrawerLayoutProvider
      widthVw={layoutProviderValue.widthVw}
      isPartialDrawer={layoutProviderValue.isPartialDrawer}
    >
      <DrawerChrome {...chromeProps} />
    </RightDrawerLayoutProvider>
  );

  if (resolvedPresentation === "matrix-panel") {
    const matrixBackdropDismissible = !allowBackgroundInteraction;
    const matrixPanel = (
      <div
        className="list-workspace-root glass-v2-root pointer-events-none fixed inset-0 z-[190]"
        data-matrix-peek-portal=""
      >
        {matrixBackdropDismissible ? (
          <div
            className={cn("matrix-drawer-backdrop", "matrix-drawer-backdrop--open", "pointer-events-auto")}
            onClick={() => requestClose()}
            aria-hidden={false}
          />
        ) : null}
        <aside
          className={cn(
            "matrix-creation-drawer",
            "matrix-creation-drawer--open",
            "pointer-events-auto",
            rightDrawerGlassSurfaceClassName(glassSurface),
            className
          )}
          aria-hidden={false}
          aria-label={title}
          role="dialog"
        >
          <div className="matrix-form-scroll flex min-h-0 flex-1 flex-col">{drawerLayout}</div>
        </aside>
      </div>
    );
    return portalReady ? createPortal(matrixPanel, document.body) : matrixPanel;
  }

  if (resolvedPresentation === "inline-panel") {
    const inlineHost = splitDetailHost?.hostRef.current;
    const inlinePanel = (
      <div
        role="dialog"
        aria-modal={false}
        aria-label={title}
        data-drawer-root
        className={cn(
          "spatial-detail-pane flex h-full min-h-0 w-full flex-col overflow-hidden",
          className
        )}
      >
        {drawerLayout}
      </div>
    );
    if (inlineHost && portalReady && inlineHostReady) {
      return createPortal(inlinePanel, inlineHost);
    }
    if (!inlineHostReady) return null;
    return inlinePanel;
  }

  const panel = (
    <div
      role="dialog"
      aria-modal={!isPartialDrawer || !allowBackgroundInteraction}
      aria-label={title}
      data-drawer-root
      className={cn(
        "fixed inset-y-0 right-0 flex h-full max-h-[100dvh] flex-col gap-0 overflow-hidden border-l border-border/80 border-black/[0.06] bg-background shadow-2xl dark:border-white/10",
        rightDrawerGlassSurfaceClassName(glassSurface),
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
