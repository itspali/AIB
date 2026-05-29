"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CategoryDetailViewport } from "@/components/categories/category-detail-viewport";
import { CategoryDrawerForm } from "@/components/categories/category-drawer-form";
import { CategoryEmptyState } from "@/components/categories/category-empty-state";
import { CategoryTreePanel } from "@/components/categories/category-tree-panel";
import { CatalogSubNav } from "@/components/products/catalog-sub-nav";
import { ModuleViewSelect } from "@/components/search/module-view-select";
import { Button } from "@/components/ui/button";
import type { CategoryRow } from "@/lib/categories/types";
import { cn } from "@/lib/utils";

type Props = {
  initialRows: CategoryRow[];
};

export function CategoryManagementTerminal({ initialRows }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);

  const selectedCategory = initialRows.find((r) => r.id === selectedId) ?? null;

  const openCreate = () => {
    setEditingCategory(null);
    setSelectedId(null);
    setDrawerOpen(true);
  };

  const openEdit = (category: CategoryRow) => {
    setEditingCategory(category);
    setSelectedId(category.id);
    setDrawerOpen(true);
  };

  return (
    <>
      <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between md:mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground md:hidden">
            Configure hierarchical item categories and inherited attribute templates.
          </p>
          <CatalogSubNav active="categories" />
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="sm:hidden">New category</span>
          <span className="hidden sm:inline">Create Product Category</span>
        </Button>
      </header>

      <div className="mb-3">
        <ModuleViewSelect triggerClassName="w-full sm:w-[10rem]" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-0">
        <aside
          className={cn(
            "col-span-1 lg:col-span-4",
            "border-border/80 lg:border-r lg:pr-4",
            "h-auto lg:h-[calc(100vh-theme(spacing.16)-4rem)]",
            "overflow-y-auto scrollbar-none"
          )}
        >
          <CategoryTreePanel rows={initialRows} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>

        <section className="col-span-1 min-h-[420px] w-full p-4 sm:p-6 lg:col-span-8">
          {selectedCategory ? (
            <CategoryDetailViewport
              category={selectedCategory}
              allRows={initialRows}
              onEdit={openEdit}
            />
          ) : (
            <CategoryEmptyState
              onCreate={openCreate}
              hasExistingCategories={initialRows.length > 0}
            />
          )}
        </section>
      </div>

      <CategoryDrawerForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        rows={initialRows}
        editingCategory={editingCategory}
        onSaved={(id) => setSelectedId(id)}
      />
    </>
  );
}
