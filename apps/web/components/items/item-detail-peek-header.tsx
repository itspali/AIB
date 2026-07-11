"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { DrawerPopOutButton } from "@/components/layout/drawer-pop-out-button";
import { ItemLifecycleStatusDot } from "@/components/products/item-lifecycle-status-dot";
import { Button } from "@/components/ui/button";
import {
  buildItemDetailHeaderLines,
  type ItemDetailHeaderLines,
} from "@/lib/products/item-detail-header";
import {
  resolveItemDetailLifecycleStatus,
  type ItemLifecycleStatusTone,
} from "@/lib/products/item-lifecycle-status";
import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type LifecycleStatus = {
  tone: ItemLifecycleStatusTone;
  label: string;
};

type IdentityProps = {
  headerLines: ItemDetailHeaderLines;
  lifecycleStatus: LifecycleStatus;
  className?: string;
};

/** Title + subtitle block shared by split header and matrix drawer peek. */
export function ItemDetailPeekHeaderIdentity({
  headerLines,
  lifecycleStatus,
  className,
}: IdentityProps) {
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <h2 className="spatial-detail-id truncate">{headerLines.title}</h2>
      <p className="spatial-detail-name flex min-w-0 items-center gap-1.5 truncate">
        <ItemLifecycleStatusDot tone={lifecycleStatus.tone} label={lifecycleStatus.label} />
        {headerLines.subtitle ? (
          <span className="truncate">{headerLines.subtitle}</span>
        ) : (
          <span className="truncate">{lifecycleStatus.label}</span>
        )}
      </p>
    </div>
  );
}

type HeaderProps = {
  detail: ProductDetailSnapshot | null;
  selectedRow: ProductListRow | null;
  popOutHref?: string;
  trailingActions?: ReactNode;
  showMobileBack?: boolean;
  onBack?: () => void;
  className?: string;
};

/** Full spatial-detail-header for split inline peek. */
export function ItemDetailPeekHeader({
  detail,
  selectedRow,
  popOutHref,
  trailingActions,
  showMobileBack = false,
  onBack,
  className,
}: HeaderProps) {
  const headerLines = buildItemDetailHeaderLines(detail, selectedRow);
  const lifecycleStatus = resolveItemDetailLifecycleStatus(detail, selectedRow);

  return (
    <header className={cn("spatial-detail-header", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2">
        {popOutHref ? (
          <DrawerPopOutButton href={popOutHref} label="Open item outside panel" />
        ) : null}
        <ItemDetailPeekHeaderIdentity
          headerLines={headerLines}
          lifecycleStatus={lifecycleStatus}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {showMobileBack && onBack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="spatial-mobile-back h-8 lg:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
            Back
          </Button>
        ) : null}
        {trailingActions}
      </div>
    </header>
  );
}

export function resolveItemDetailPeekHeaderLines(
  detail: ProductDetailSnapshot | null,
  selectedRow: ProductListRow | null
) {
  return buildItemDetailHeaderLines(detail, selectedRow);
}
