"use client";

import { Folder, X, Zap } from "lucide-react";
import { CategoryDetailViewport } from "@/components/categories/category-detail-viewport";
import type { CategoryRow } from "@/lib/categories/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  category: CategoryRow | null;
  allRows: CategoryRow[];
  onClose: () => void;
  onEdit: (category: CategoryRow) => void;
  onDelete: (category: CategoryRow) => void;
};

export function CategoryMatrixPeekDrawer({
  open,
  category,
  allRows,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  return (
    <>
      <div
        className={cn("matrix-drawer-backdrop", open && "matrix-drawer-backdrop--open")}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={cn("matrix-creation-drawer", open && "matrix-creation-drawer--open")}
        aria-hidden={!open}
        aria-label="Category record workspace"
      >
        <div className="matrix-form-scroll">
          <div className="matrix-drawer-head">
            <div className="min-w-0">
              <h3 className="matrix-drawer-title truncate">{category?.name ?? "Category"}</h3>
              <p className="matrix-drawer-sub truncate">
                {category?.is_active ? "Active category" : "Inactive category"}
              </p>
            </div>
            <button
              type="button"
              className="matrix-drawer-close"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {category ? (
            <CategoryDetailViewport
              category={category}
              allRows={allRows}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Select a category.</p>
          )}
        </div>

        <div className="matrix-drawer-toolbar">
          <button type="button" className="matrix-btn matrix-btn--secondary" onClick={onClose}>
            <span className="matrix-btn__label">Close</span>
          </button>
          <button
            type="button"
            className="matrix-btn matrix-btn--primary gap-1.5"
            onClick={() => category && onEdit(category)}
            disabled={!category}
          >
            <Zap className="h-3.5 w-3.5 shrink-0 md:hidden" aria-hidden />
            <span className="matrix-btn__label">Edit category</span>
          </button>
        </div>
      </aside>
    </>
  );
}
