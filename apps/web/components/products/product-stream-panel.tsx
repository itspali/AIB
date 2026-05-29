"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { saveProductListUserPrefs } from "@/app/items/actions";
import { ProductListCompact } from "@/components/products/product-list-compact";
import { ProductListTable } from "@/components/products/product-list-table";
import { ProductListToolbar } from "@/components/products/product-list-toolbar";
import { useDeviceClass } from "@/hooks/use-device-class";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { redactProductListRow } from "@/lib/products/field-permissions";
import {
  getDefaultProductListPrefs,
  loadProductListPrefs,
  mergeInitialProductListPrefs,
  saveProductListPrefs,
  resolveCardGridColumns,
  type ProductListPrefs,
} from "@/lib/products/list-prefs";
import { resolveVisibleColumns } from "@/lib/products/resolve-list-columns";
import { sortProductListRows } from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";
import { applyFallbackTextFilter } from "@/lib/search/executor/apply-fallback-text";

const PREFS_SAVE_DEBOUNCE_MS = 500;

type Props = {
  products: ProductListRow[];
  categories: CategoryRow[];
  selectedId: string | null;
  fieldPermissions: ProductFieldPermissions;
  initialListPrefs?: ProductListPrefs | null;
  onSelect: (productId: string) => void;
};

export function ProductStreamPanel({
  products,
  categories,
  selectedId,
  fieldPermissions,
  initialListPrefs,
  onSelect,
}: Props) {
  const omnibar = useOptionalOmnibarContext();
  const { deviceClass } = useDeviceClass();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [prefs, setPrefs] = useState<ProductListPrefs>(getDefaultProductListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPersistedRef = useRef(false);

  useEffect(() => {
    const localPrefs = loadProductListPrefs();
    setPrefs(mergeInitialProductListPrefs(initialListPrefs, localPrefs));
    setPrefsHydrated(true);
  }, [initialListPrefs]);

  const persistPrefs = useCallback(async (nextPrefs: ProductListPrefs) => {
    saveProductListPrefs(nextPrefs);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      const result = await saveProductListUserPrefs(nextPrefs);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save list layout preferences.");
        return;
      }
      hasPersistedRef.current = true;
    }, PREFS_SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    persistPrefs(prefs);
  }, [persistPrefs, prefs, prefsHydrated]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!prefsHydrated || hasPersistedRef.current || initialListPrefs) return;
    void saveProductListUserPrefs(prefs).then((result) => {
      if (!("error" in result)) {
        hasPersistedRef.current = true;
      }
    });
  }, [initialListPrefs, prefs, prefsHydrated]);

  useEffect(() => {
    if (omnibar?.scopePinnedToAll) {
      setCategoryFilter("all");
    }
  }, [omnibar?.scopePinnedToAll, omnibar?.moduleFilterRevision]);

  const categoryOptions = useMemo(() => {
    const tree = buildCategoryTree(categories);
    return flattenTree(tree).map((node) => ({
      id: node.id,
      label: `${"— ".repeat(node.depth)}${node.name}`,
    }));
  }, [categories]);

  const redactedProducts = useMemo(
    () => products.map((row) => redactProductListRow(row, fieldPermissions.allowedFields)),
    [fieldPermissions.allowedFields, products]
  );

  const filteredProducts = useMemo(() => {
    let rows = redactedProducts;

    if (categoryFilter !== "all") {
      rows = rows.filter((product) => product.category_id === categoryFilter);
    }

    if (!omnibar?.appliedQuery.trim()) {
      return rows;
    }

    const hasStructuralFilter = omnibar.activeAst.some((clause) => clause.kind !== "text");

    if (hasStructuralFilter && omnibar.filteredItemIds) {
      rows = rows.filter((product) => omnibar.filteredItemIds?.has(product.id));
    } else if (!hasStructuralFilter && omnibar.residualText) {
      rows = applyFallbackTextFilter(
        rows.map((row) => ({ ...row, description: null })),
        omnibar.residualText
      );
    }

    return rows;
  }, [
    redactedProducts,
    categoryFilter,
    omnibar?.appliedQuery,
    omnibar?.filteredItemIds,
    omnibar?.activeAst,
    omnibar?.residualText,
  ]);

  const displayedProducts = useMemo(
    () => sortProductListRows(filteredProducts, prefs.sortField, prefs.sortDirection),
    [filteredProducts, prefs.sortField, prefs.sortDirection]
  );

  const visibleColumns = useMemo(
    () =>
      resolveVisibleColumns({
        prefs,
        viewMode: prefs.viewMode,
        deviceClass,
        allowedFields: fieldPermissions.allowedFields,
      }),
    [deviceClass, fieldPermissions.allowedFields, prefs]
  );

  const cardGridColumns = useMemo(
    () => resolveCardGridColumns(prefs, deviceClass),
    [deviceClass, prefs]
  );

  return (
    <div className="space-y-3">
      <ProductListToolbar
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categoryOptions={categoryOptions}
        prefs={prefs}
        onPrefsChange={setPrefs}
        fieldPermissions={fieldPermissions}
        detectedDeviceClass={deviceClass}
        resultCount={displayedProducts.length}
        totalCount={products.length}
      />

      {displayedProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          {products.length === 0
            ? "No product profiles yet. Create your first master profile to populate the catalog."
            : "No products match the current filter."}
        </p>
      ) : prefs.viewMode === "compact" ? (
        <ProductListCompact
          products={displayedProducts}
          columns={visibleColumns}
          gridColumns={cardGridColumns}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        <ProductListTable
          products={displayedProducts}
          columns={visibleColumns}
          selectedId={selectedId}
          sortField={prefs.sortField}
          sortDirection={prefs.sortDirection}
          frozenColumnCount={prefs.frozenColumnCount}
          onSortChange={(sortField, sortDirection) =>
            setPrefs((current) => ({ ...current, sortField, sortDirection }))
          }
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
