"use client";

import { ArrowLeft, Folder } from "lucide-react";
import { CategoryDetailViewport } from "@/components/categories/category-detail-viewport";
import { Button } from "@/components/ui/button";
import type { CategoryRow } from "@/lib/categories/types";
import { cn } from "@/lib/utils";

type Props = {
  category: CategoryRow | null;
  allRows: CategoryRow[];
  onEdit: (category: CategoryRow) => void;
  onDelete: (category: CategoryRow) => void;
  onBack?: () => void;
  showMobileBack?: boolean;
  className?: string;
};

export function CategoryDetailCanvas({
  category,
  allRows,
  onEdit,
  onDelete,
  onBack,
  showMobileBack = false,
  className,
}: Props) {
  if (!category) {
    return (
      <section className={cn("spatial-detail-pane spatial-detail-pane--empty", className)}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Folder className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <p className="text-sm font-medium">Select a category</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Choose a category from the list to inspect hierarchy and attribute templates here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("spatial-detail-pane", className)}>
      <header className="spatial-detail-header">
        <div className="min-w-0 flex-1">
          <h2 className="spatial-detail-id truncate">{category.name}</h2>
          <p className="spatial-detail-name truncate">
            {category.is_active ? "Active category" : "Inactive category"}
          </p>
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
        </div>
      </header>
      <div className="spatial-detail-body">
        <CategoryDetailViewport
          category={category}
          allRows={allRows}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </section>
  );
}
