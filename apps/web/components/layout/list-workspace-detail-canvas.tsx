"use client";

import { ArrowLeft, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  loading?: boolean;
  onEdit?: () => void;
  onBack?: () => void;
  showMobileBack?: boolean;
  editLabel?: string;
  children?: ReactNode;
  className?: string;
};

export function ListWorkspaceDetailCanvas({
  title,
  subtitle,
  emptyTitle = "Select a record",
  emptyMessage = "Choose a row from the list to inspect details here.",
  loading = false,
  onEdit,
  onBack,
  showMobileBack = false,
  editLabel = "Edit",
  children,
  className,
}: Props) {
  const hasSelection = Boolean(title || children);

  if (!hasSelection) {
    return (
      <section className={cn("spatial-detail-pane spatial-detail-pane--empty", className)}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="max-w-xs text-xs text-muted-foreground">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("spatial-detail-pane flex min-h-0 flex-1 flex-col", className)}>
      <header className="spatial-detail-header shrink-0">
        <div className="min-w-0 flex-1">
          {title ? <h2 className="spatial-detail-id truncate">{title}</h2> : null}
          {subtitle ? <p className="spatial-detail-name truncate">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="spatial-detail-action h-8 gap-1.5"
              onClick={onEdit}
              disabled={loading}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{editLabel}</span>
            </Button>
          ) : null}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading record…</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
