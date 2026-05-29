"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { saveProductListUserPrefs } from "@/app/items/actions";
import { ProductListCompact } from "@/components/products/product-list-compact";
import { ProductListSkeleton } from "@/components/products/product-list-skeleton";
import { ProductListTable } from "@/components/products/product-list-table";
import { ProductListToolbar } from "@/components/products/product-list-toolbar";
import { useDeviceClass } from "@/hooks/use-device-class";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { redactProductListRow } from "@/lib/products/field-permissions";
import {
  bumpProductListPrefsRevision,
  loadProductListPrefs,
  resolveCardGridColumns,
  resolvePrefsOnMount,
  saveProductListPrefs,
  shouldPersistPrefsImmediately,
  didColumnSettingsChange,
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
  const initialListPrefsRef = useRef(initialListPrefs);
  const hydratedRef = useRef(false);
  const [prefs, setPrefs] = useState<ProductListPrefs>(() =>
    resolvePrefsOnMount(initialListPrefs, null)
  );
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSavingColumnPrefs, setIsSavingColumnPrefs] = useState(false);
  const savingColumnPrefsRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPrefsRef = useRef(prefs);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const localPrefs = loadProductListPrefs();
    setPrefs(resolvePrefsOnMount(initialListPrefsRef.current, localPrefs));
    setPrefsHydrated(true);
  }, []);

  const persistToServer = useCallback(async (nextPrefs: ProductListPrefs) => {
    setIsSavingPrefs(true);
    setIsSavingColumnPrefs(savingColumnPrefsRef.current);
    saveProductListPrefs(nextPrefs);
    try {
      const result = await saveProductListUserPrefs(nextPrefs);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save list layout preferences.");
        return;
      }
    } finally {
      setIsSavingPrefs(false);
      setIsSavingColumnPrefs(false);
      savingColumnPrefsRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;

    const previous = prevPrefsRef.current;
    if (previous === prefs) return;

    prevPrefsRef.current = prefs;
    saveProductListPrefs(prefs);
    savingColumnPrefsRef.current = didColumnSettingsChange(previous, prefs);

    if (shouldPersistPrefsImmediately(previous, prefs)) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void persistToServer(prefs);
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void persistToServer(prefs);
    }, PREFS_SAVE_DEBOUNCE_MS);
  }, [persistToServer, prefs, prefsHydrated]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handlePrefsChange = useCallback(
    (next: ProductListPrefs | ((current: ProductListPrefs) => ProductListPrefs)) => {
      setPrefs((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        return bumpProductListPrefsRevision(resolved);
      });
    },
    []
  );

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

    if (omnibar?.appliedQuery.trim()) {
      const hasStructuralFilter = omnibar.activeAst.some((clause) => clause.kind !== "text");

      if (hasStructuralFilter && omnibar.filteredItemIds) {
        rows = rows.filter((product) => omnibar.filteredItemIds?.has(product.id));
      } else if (!hasStructuralFilter && omnibar.residualText) {
        rows = applyFallbackTextFilter(
          rows.map((row) => ({ ...row, description: null })),
          omnibar.residualText
        );
      }
    }

    // Live, uncommitted text preview as the user types in the inline bar.
    if (omnibar?.inlinePreviewText) {
      rows = applyFallbackTextFilter(
        rows.map((row) => ({ ...row, description: null })),
        omnibar.inlinePreviewText
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
    omnibar?.inlinePreviewText,
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

  const listContent = !prefsHydrated ? (
    <ProductListSkeleton viewMode={prefs.viewMode} />
  ) : displayedProducts.length === 0 ? (
    <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
      {products.length === 0
        ? "No items yet. Create your first item profile to populate the catalog."
        : "No items match the current filter."}
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
        handlePrefsChange((current) => ({ ...current, sortField, sortDirection }))
      }
      onSelect={onSelect}
    />
  );

  return (
    <div className="space-y-3">
      <ProductListToolbar
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          categoryOptions={categoryOptions}
          prefs={prefs}
          onPrefsChange={handlePrefsChange}
          fieldPermissions={fieldPermissions}
          detectedDeviceClass={deviceClass}
          resultCount={displayedProducts.length}
          totalCount={products.length}
          prefsHydrated={prefsHydrated}
          isSavingPrefs={isSavingPrefs}
          isSavingColumnPrefs={isSavingColumnPrefs}
        />

      {listContent}
    </div>
  );
}
