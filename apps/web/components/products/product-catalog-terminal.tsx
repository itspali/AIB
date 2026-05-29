"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getProductDetail } from "@/app/items/actions";
import { ProductDrawerForm } from "@/components/products/product-drawer-form";
import type { ProductFormMode } from "@/components/products/product-master-form";
import { CatalogSubNav } from "@/components/products/catalog-sub-nav";
import { ProductStreamPanel } from "@/components/products/product-stream-panel";
import { Button } from "@/components/ui/button";
import type { CategoryRow } from "@/lib/categories/types";
import {
  detailToListRow,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductListRow,
} from "@/lib/products/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { redactProductListRow } from "@/lib/products/field-permissions";
import type { ProductListPrefs } from "@/lib/products/list-prefs";

type Props = {
  tenantId: string;
  initialProducts: ProductListRow[];
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
  fieldPermissions: ProductFieldPermissions;
  initialListPrefs?: ProductListPrefs | null;
};

export function ProductCatalogTerminal({
  tenantId,
  initialProducts,
  categories,
  catalogContext,
  fieldPermissions,
  initialListPrefs,
}: Props) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDetailSnapshot | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<ProductFormMode>("create");
  const [isLoadingDetail, startDetailTransition] = useTransition();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const loadDetail = (itemId: string, onLoaded?: (snapshot: ProductDetailSnapshot) => void) => {
    startDetailTransition(async () => {
      const result = await getProductDetail(itemId);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load product profile.");
        return;
      }
      setDetail(result.detail);
      onLoaded?.(result.detail);
    });
  };

  const openCreate = () => {
    setSelectedId(null);
    setDetail(null);
    setDrawerMode("create");
    setDrawerOpen(true);
  };

  const handleSelect = (productId: string) => {
    setSelectedId(productId);
    setDetail(null);
    setDrawerMode("view");
    setDrawerOpen(true);
    loadDetail(productId);
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setDrawerMode("create");
      setDetail(null);
      setSelectedId(null);
    }
  };

  const refreshDetail = () => {
    if (!selectedId) return;
    loadDetail(selectedId);
  };

  const handleSaved = (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
    setSelectedId(itemId);
    setDrawerMode("view");

    if (savedDetail) {
      setDetail(savedDetail);
      setProducts((current) => {
        const nextRow = redactProductListRow(
          detailToListRow(savedDetail),
          fieldPermissions.allowedFields
        );
        const index = current.findIndex((row) => row.id === itemId);
        if (index < 0) return [...current, nextRow].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...current];
        next[index] = nextRow;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
    } else {
      loadDetail(itemId);
    }

    router.refresh();
  };

  return (
    <>
      <div className="canvas-scroll-endpad">
        <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between md:mb-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Product Master Catalog</h1>
            <p className="mt-1 text-sm text-muted-foreground md:hidden">
              Manage product identities, master SKUs, and statutory logistics parameters.
            </p>
            <CatalogSubNav active="products" />
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">New profile</span>
            <span className="hidden sm:inline">Create New Item Profile</span>
          </Button>
        </header>

        <ProductStreamPanel
          products={products}
          categories={categories}
          selectedId={drawerOpen ? selectedId : null}
          fieldPermissions={fieldPermissions}
          initialListPrefs={initialListPrefs}
          onSelect={handleSelect}
        />
      </div>

      <ProductDrawerForm
        open={drawerOpen}
        mode={drawerMode}
        onOpenChange={handleDrawerOpenChange}
        onModeChange={setDrawerMode}
        tenantId={tenantId}
        categories={categories}
        catalogContext={catalogContext}
        detail={detail}
        isLoading={isLoadingDetail && drawerMode !== "create"}
        onSaved={handleSaved}
        onExtensionsChanged={refreshDetail}
      />
    </>
  );
}
