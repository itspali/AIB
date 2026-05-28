"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getProductDetail } from "@/app/items/actions";
import { ProductDetailViewport } from "@/components/products/product-detail-viewport";
import { ProductEmptyState } from "@/components/products/product-empty-state";
import { ProductFormSkeleton } from "@/components/products/product-form-skeleton";
import { ProductMasterForm } from "@/components/products/product-master-form";
import { ProductStreamPanel } from "@/components/products/product-stream-panel";
import { Button } from "@/components/ui/button";
import type { CategoryRow } from "@/lib/categories/types";
import { detailToFormValues } from "@/lib/products/types";
import type { ProductCatalogContext, ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  tenantId: string;
  initialProducts: ProductListRow[];
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
};

type CanvasMode = "empty" | "detail" | "create" | "edit";

export function ProductCatalogTerminal({
  tenantId,
  initialProducts,
  categories,
  catalogContext,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CanvasMode>("empty");
  const [detail, setDetail] = useState<ProductDetailSnapshot | null>(null);
  const [isLoadingDetail, startDetailTransition] = useTransition();

  const loadDetail = (itemId: string, nextMode: CanvasMode = "detail") => {
    startDetailTransition(async () => {
      const result = await getProductDetail(itemId);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load product profile.");
        return;
      }
      setDetail(result.detail);
      setMode(nextMode);
    });
  };

  const openCreate = () => {
    setSelectedId(null);
    setDetail(null);
    setMode("create");
  };

  const handleSelect = (productId: string) => {
    setSelectedId(productId);
    setDetail(null);
    setMode("detail");
    loadDetail(productId, "detail");
  };

  const handleCancel = () => {
    if (selectedId && detail) {
      setMode("detail");
      return;
    }
    setMode("empty");
    setSelectedId(null);
    setDetail(null);
  };

  const categoryTemplates = detail?.category_id
    ? categories.find((category) => category.id === detail.category_id)?.attribute_templates ?? []
    : [];

  const refreshDetail = () => {
    if (!selectedId) return;
    loadDetail(selectedId, mode === "edit" ? "edit" : "detail");
  };

  const handleSaved = (itemId: string) => {
    setSelectedId(itemId);
    loadDetail(itemId, "detail");
  };

  return (
    <div className={mode === "create" || mode === "edit" ? undefined : "canvas-scroll-endpad"}>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Master Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage product identities, master SKUs, and statutory logistics parameters.
          </p>
          <nav className="mt-3 flex gap-2 text-sm" aria-label="Catalog sub-navigation">
            <Link
              href="/items"
              className="rounded-md bg-primary/10 px-2.5 py-1 font-medium text-primary"
              aria-current="page"
            >
              Products
            </Link>
            <Link
              href="/items/categories"
              className="rounded-md px-2.5 py-1 text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
            >
              Categories
            </Link>
          </nav>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create New Item Profile
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-0">
        <aside
          className={cn(
            "col-span-1 lg:col-span-4",
            "border-border lg:border-r lg:pr-4",
            "h-auto lg:h-[calc(100vh-theme(spacing.16)-4rem)]",
            "overflow-y-auto scrollbar-none"
          )}
        >
          <ProductStreamPanel
            products={initialProducts}
            categories={categories}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </aside>

        <section className="col-span-1 min-h-[420px] w-full p-4 sm:p-6 lg:col-span-8">
          {mode === "create" && (
            <ProductMasterForm
              tenantId={tenantId}
              categories={categories}
              catalogContext={catalogContext}
              onCancel={handleCancel}
              onSaved={handleSaved}
            />
          )}

          {mode === "edit" && detail && (
            <ProductMasterForm
              tenantId={tenantId}
              categories={categories}
              catalogContext={catalogContext}
              valuations={detail.valuations}
              variants={detail.variants}
              media={detail.media}
              initialValues={detailToFormValues(detail)}
              onCancel={handleCancel}
              onSaved={handleSaved}
              onExtensionsChanged={refreshDetail}
            />
          )}

          {mode === "detail" && isLoadingDetail && <ProductFormSkeleton />}

          {mode === "detail" && detail && !isLoadingDetail && (
            <ProductDetailViewport
              tenantId={tenantId}
              product={detail}
              catalogContext={catalogContext}
              categoryTemplates={categoryTemplates}
              onEdit={() => {
                setMode("edit");
              }}
              onExtensionsChanged={refreshDetail}
            />
          )}

          {mode === "empty" && (
            <ProductEmptyState
              onCreate={openCreate}
              hasExistingProducts={initialProducts.length > 0}
            />
          )}
        </section>
      </div>
    </div>
  );
}
