"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import { cn } from "@/lib/utils";

type Props = {
  orgLabel: string;
  /** Enables md+ sidebar collapse via the org logo (footer control remains). */
  enableSidebarControl?: boolean;
  /** Opens the mobile nav drawer below md when module nav is available. */
  onOpenMobileDrawer?: () => void;
  className?: string;
};

export function OrgNavMenuTrigger({
  orgLabel,
  enableSidebarControl = false,
  onOpenMobileDrawer,
  className,
}: Props) {
  const { sidebarCollapsed, setSidebarCollapsed } = useOnboardingContext();
  const initial = orgLabel.trim().charAt(0).toUpperCase() || "A";
  const canToggleSidebar = enableSidebarControl;
  const canOpenDrawer = Boolean(onOpenMobileDrawer);
  const isInteractive = canToggleSidebar || canOpenDrawer;

  const handleClick = () => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      if (canToggleSidebar) {
        setSidebarCollapsed(!sidebarCollapsed);
      }
      return;
    }
    onOpenMobileDrawer?.();
  };

  const logoMark = (
    <span
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-xs font-bold text-primary",
        isInteractive && "transition-colors duration-200 group-hover:from-primary/40 group-hover:to-accent/40"
      )}
    >
      {initial}
      {isInteractive ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-border/80 bg-background text-muted-foreground shadow-sm"
          aria-hidden
        >
          {canOpenDrawer ? <Menu className="h-2 w-2 stroke-[2.5] md:hidden" /> : null}
          {canToggleSidebar ? (
            sidebarCollapsed ? (
              <PanelLeftOpen className="hidden h-2 w-2 stroke-[2.5] md:block" />
            ) : (
              <PanelLeftClose className="hidden h-2 w-2 stroke-[2.5] md:block" />
            )
          ) : null}
        </span>
      ) : null}
    </span>
  );

  if (!isInteractive) {
    return <span className={className}>{logoMark}</span>;
  }

  const ariaLabel =
    canToggleSidebar && canOpenDrawer
      ? sidebarCollapsed
        ? "Expand navigation sidebar. On small screens, opens the navigation menu."
        : "Collapse navigation sidebar. On small screens, opens the navigation menu."
      : canToggleSidebar
        ? sidebarCollapsed
          ? "Expand navigation sidebar"
          : "Collapse navigation sidebar"
        : "Open navigation menu";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-expanded={canToggleSidebar ? !sidebarCollapsed : undefined}
      className={cn(
        "group shrink-0 rounded-lg p-0.5 transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {logoMark}
    </button>
  );
}
