"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FocusEvent,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { Package, ScanLine, Search, X } from "lucide-react";
import {
  lookupStockVariantBySku,
  searchStockVariantsForAdjustment,
} from "@/app/inventory/stock/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import type { StockVariantOption } from "@/lib/inventory/stock/types";
import {
  filterStockVariantSuggestions,
  getCachedBrowseVariants,
  loadBrowseVariants,
  prefetchBrowseVariants,
  registerVariantSuggestions,
} from "@/lib/inventory/stock/variant-suggestion-cache";
import { prefetchPoLineCatalogContext } from "@/lib/documents/po-line-catalog-cache";
import { prefetchLineStockContexts } from "@/lib/inventory/stock/line-stock-context-cache";
import type { LineStockContextPrefetchScope } from "@/lib/inventory/stock/line-stock-context-cache";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 100;

const STOCK_VARIANT_NOT_ADJUSTABLE =
  "This variant is not available for stock adjustments or transfers.";

function isEnterKey(key: string): boolean {
  return key === "Enter" || key === "NumpadEnter";
}

export type StockLineSkuSelection = {
  sku: string;
  variant_id: string;
  item_id?: string;
  item_name: string;
  variant_sku: string;
  unit_cost: string;
  /** Item master purchase rate — used by PO lines for offer unit price. */
  purchase_price?: string | null;
  /** Item master selling rate — used by sales lines for offer unit price. */
  selling_price?: string | null;
  skuError: string | null;
  /** Optional thumbnail URL from variant search/browse (PO line image hydration). */
  image_url?: string | null;
  /** Base unit from variant search/browse (PO unit column hydration). */
  base_unit_of_measure?: string | null;
  description?: string | null;
  hsn_sac_code?: string | null;
  mrp?: string | null;
  variant_attributes?: Record<string, string>;
  custom_fields?: Record<string, string>;
  /** Item tax code from variant search — hydrates line tax before full catalog fetch. */
  tax_code_id?: string | null;
  tax_rate?: number;
  tax_is_variable?: boolean;
  /** Alternate UOM rows from item master — hydrates line UOM before full catalog fetch. */
  alternate_uoms?: Array<{ uom_code: string; conversion_factor: number }>;
};

type Props = {
  disabled?: boolean;
  compact?: boolean;
  /** When "item", shows item name in the field and SKU as secondary text. */
  displayMode?: "sku" | "item";
  /** PO line grid: wrap selected item names; textarea grows to show full name without scroll. */
  wrapSelectedItemName?: boolean;
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement | null>;
  inputClassName?: string;
  showSecondaryText?: boolean;
  /** Show a clear control when a variant is selected (default true). */
  clearable?: boolean;
  /** Document location for warming on-hand hints while browsing the picker. */
  stockLocationId?: string;
  /** Lighter fetch when only on-hand is needed (e.g. transfer lines). */
  stockContextScope?: LineStockContextPrefetchScope;
  value: StockLineSkuSelection;
  onChange: (patch: Partial<StockLineSkuSelection>) => void;
};

function resolveDisplayQuery(
  value: StockLineSkuSelection,
  displayMode: "sku" | "item"
): string {
  if (displayMode === "item" && value.variant_id && value.item_name) {
    return value.item_name;
  }
  return value.variant_sku || value.sku;
}

function isSelectionDisplayQuery(
  query: string,
  value: StockLineSkuSelection,
  displayMode: "sku" | "item"
): boolean {
  if (!value.variant_id) return false;
  if (displayMode === "item") {
    return query === value.item_name || query === value.variant_sku;
  }
  return query === value.variant_sku;
}

function resolveVariantDisplayQuery(
  variant: Pick<StockVariantOption, "item_name" | "variant_sku">,
  displayMode: "sku" | "item"
): string {
  return displayMode === "item" ? variant.item_name : variant.variant_sku;
}

function VariantSuggestionThumb({ imageUrl }: { imageUrl: string | null }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-muted">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

function applyVariant(
  variant: StockVariantOption,
  onChange: (patch: Partial<StockLineSkuSelection>) => void
) {
  onChange({
    sku: variant.variant_sku,
    variant_id: variant.variant_id,
    item_id: variant.item_id,
    item_name: variant.item_name,
    variant_sku: variant.variant_sku,
    unit_cost: variant.standard_cost ?? "0",
    purchase_price: variant.purchase_price ?? null,
    selling_price: variant.selling_price ?? null,
    skuError: null,
    ...(variant.image_url ? { image_url: variant.image_url } : {}),
    ...(variant.base_unit_of_measure
      ? { base_unit_of_measure: variant.base_unit_of_measure }
      : {}),
    ...(variant.description ? { description: variant.description } : {}),
    ...(variant.hsn_sac_code ? { hsn_sac_code: variant.hsn_sac_code } : {}),
    ...(variant.mrp ? { mrp: variant.mrp } : {}),
    ...(variant.variant_attributes && Object.keys(variant.variant_attributes).length > 0
      ? { variant_attributes: variant.variant_attributes }
      : {}),
    ...(variant.custom_fields && Object.keys(variant.custom_fields).length > 0
      ? { custom_fields: variant.custom_fields }
      : {}),
    ...(variant.tax_code_id ? { tax_code_id: variant.tax_code_id } : {}),
    ...(variant.tax_rate != null && Number.isFinite(variant.tax_rate)
      ? { tax_rate: variant.tax_rate }
      : {}),
    ...(variant.tax_is_variable != null ? { tax_is_variable: variant.tax_is_variable } : {}),
    ...(variant.alternate_uoms?.length ? { alternate_uoms: variant.alternate_uoms } : {}),
  });
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}

export function StockVariantSkuField({
  disabled = false,
  compact = false,
  displayMode = "sku",
  wrapSelectedItemName = false,
  inputRef: externalInputRef,
  inputClassName,
  showSecondaryText = true,
  clearable = true,
  stockLocationId = "",
  stockContextScope = "full",
  value,
  onChange,
}: Props) {
  const listboxId = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;
  const stockLocationIdRef = useRef(stockLocationId);
  stockLocationIdRef.current = stockLocationId;
  const stockContextScopeRef = useRef(stockContextScope);
  stockContextScopeRef.current = stockContextScope;
  const [query, setQuery] = useState(() => resolveDisplayQuery(value, displayMode));
  const [results, setResults] = useState<StockVariantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(value.skuError);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, startResolveTransition] = useTransition();
  const blurTimeoutRef = useRef<number | null>(null);
  const skipSearchRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const assignInputRef = useCallback(
    (node: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = node;
      assignRef(externalInputRef, node);
      if (node instanceof HTMLTextAreaElement) {
        node.style.height = "auto";
        node.style.height = `${node.scrollHeight}px`;
      }
    },
    [externalInputRef]
  );
  const listboxRef = useRef<HTMLUListElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resultsRef = useRef(results);
  const highlightIndexRef = useRef(highlightIndex);
  const openRef = useRef(open);
  const focusedRef = useRef(false);
  const queryRef = useRef(query);
  const variantIdRef = useRef(value.variant_id);
  resultsRef.current = results;
  highlightIndexRef.current = highlightIndex;
  openRef.current = open;
  queryRef.current = query;
  variantIdRef.current = value.variant_id;
  const [portalReady, setPortalReady] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const debounceTimeoutRef = useRef<number | null>(null);

  const cancelBlurClose = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  const cancelPendingSearch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    searchRequestIdRef.current += 1;
    setIsSearching(false);
  }, []);

  useEffect(() => {
    setPortalReady(true);
    prefetchBrowseVariants();
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const gap = 4;
    const viewportPadding = 8;
    const preferredMaxHeight = 224;
    const minOpenSpace = 80;

    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;

    const openBelow =
      spaceBelow >= preferredMaxHeight ||
      (spaceBelow >= spaceAbove && spaceBelow >= minOpenSpace);

    const available = Math.max(0, openBelow ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(preferredMaxHeight, available);

    setDropdownStyle({
      ...(openBelow
        ? { top: rect.bottom + gap }
        : { bottom: window.innerHeight - rect.top + gap }),
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, []);

  const scrollHighlightedIntoView = useCallback((index: number) => {
    const listbox = listboxRef.current;
    const option = optionRefs.current[index];
    if (!listbox || !option) return;

    const listboxTop = listbox.scrollTop;
    const listboxBottom = listboxTop + listbox.clientHeight;
    const optionTop = option.offsetTop;
    const optionBottom = optionTop + option.offsetHeight;

    if (optionBottom > listboxBottom) {
      listbox.scrollTop = optionBottom - listbox.clientHeight;
    } else if (optionTop < listboxTop) {
      listbox.scrollTop = optionTop;
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setDropdownStyle(null);
      return;
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition]);

  useLayoutEffect(() => {
    if (!open || results.length === 0) return;
    scrollHighlightedIntoView(highlightIndex);
  }, [highlightIndex, open, results.length, scrollHighlightedIntoView]);

  useEffect(() => {
    setQuery(resolveDisplayQuery(value, displayMode));
    setFieldError(value.skuError);
  }, [displayMode, value.item_name, value.sku, value.variant_id, value.variant_sku, value.skuError]);

  const applySuggestionResults = useCallback(
    (variants: StockVariantOption[], queryOverride?: string) => {
      registerVariantSuggestions(variants);
      const term = queryOverride ?? queryRef.current;
      const visible =
        term.trim().length < 1
          ? variants
          : filterStockVariantSuggestions(variants, term);

      setResults(visible);
      highlightIndexRef.current = 0;
      setHighlightIndex(0);
      setOpen(true);
      setFieldError(
        visible.length === 0 && term.trim().length > 0 ? "No matching variants." : null
      );
    },
    []
  );

  const runBrowse = useCallback(async () => {
    if (!focusedRef.current || variantIdRef.current) return;

    const cached = getCachedBrowseVariants();
    if (cached) {
      applySuggestionResults(cached);
    } else {
      setOpen(true);
      setIsSearching(true);
    }

    const requestId = ++searchRequestIdRef.current;
    const variants = await loadBrowseVariants();
    if (requestId !== searchRequestIdRef.current || !focusedRef.current) return;

    setIsSearching(false);
    if (!variants) {
      setResults([]);
      setOpen(false);
      setFieldError("Unable to load variants.");
      return;
    }

    applySuggestionResults(variants);
  }, [applySuggestionResults]);

  const runBrowseRef = useRef(runBrowse);
  runBrowseRef.current = runBrowse;

  const runSearch = useCallback(
    async (nextQuery: string) => {
      const trimmed = nextQuery.trim();
      if (trimmed.length < 1) {
        setResults([]);
        setOpen(false);
        setFieldError(null);
        return;
      }

      const cached = getCachedBrowseVariants();
      if (cached) {
        applySuggestionResults(cached, trimmed);
      } else {
        setOpen(true);
      }

      const requestId = ++searchRequestIdRef.current;
      setIsSearching(true);

      const result = await searchStockVariantsForAdjustment(trimmed);
      if (requestId !== searchRequestIdRef.current) return;

      setIsSearching(false);

      if ("error" in result) {
        setResults([]);
        setOpen(false);
        setFieldError(result.error);
        return;
      }

      setResults(result.variants);
      highlightIndexRef.current = 0;
      setHighlightIndex(0);
      setOpen(result.variants.length > 0);
      setFieldError(result.variants.length === 0 ? "No matching variants." : null);
    },
    [applySuggestionResults]
  );

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (value.variant_id && isSelectionDisplayQuery(query, value, displayMode)) return;
    if (query.trim().length < 1) return;

    const cached = getCachedBrowseVariants();
    if (cached) {
      applySuggestionResults(cached, query);
    }

    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      debounceTimeoutRef.current = null;
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [applySuggestionResults, displayMode, query, runSearch, value]);

  const selectVariant = useCallback((variant: StockVariantOption) => {
    if (!variant.adjustable) {
      setFieldError(variant.blocked_reason ?? STOCK_VARIANT_NOT_ADJUSTABLE);
      return;
    }

    cancelPendingSearch();
    skipSearchRef.current = true;
    applyVariant(variant, onChangeRef.current);
    prefetchLineStockContexts(stockLocationIdRef.current, variant.variant_id, {
      scope: stockContextScopeRef.current,
    });
    setQuery(resolveVariantDisplayQuery(variant, displayModeRef.current));
    setOpen(false);
    setResults([]);
    setFieldError(null);
  }, [cancelPendingSearch]);

  const selectVariantRef = useRef(selectVariant);
  selectVariantRef.current = selectVariant;

  const resolveExactSku = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      onChangeRef.current({
        variant_id: "",
        item_name: "",
        variant_sku: "",
        skuError: null,
      });
      setFieldError(null);
      return;
    }

    startResolveTransition(async () => {
      const result = await lookupStockVariantBySku(trimmed);
      if ("error" in result) {
        const adjustableMatches = resultsRef.current.filter((variant) => variant.adjustable);
        if (adjustableMatches.length === 1) {
          selectVariantRef.current(adjustableMatches[0]!);
          return;
        }
        const message = result.error ?? "No active variant found for that SKU.";
        onChangeRef.current({
          variant_id: "",
          item_name: "",
          variant_sku: "",
          skuError: message,
        });
        setFieldError(message);
        setOpen(resultsRef.current.length > 1);
        return;
      }

      cancelPendingSearch();
      skipSearchRef.current = true;
      applyVariant(
        {
          variant_id: result.variant.variant_id,
          item_id: result.variant.item_id,
          item_name: result.variant.item_name,
          variant_sku: result.variant.variant_sku,
          standard_cost: result.variant.standard_cost,
          purchase_price: null,
          selling_price: null,
          adjustable: true,
          blocked_reason: null,
          image_url: null,
          base_unit_of_measure: result.variant.base_unit_of_measure ?? null,
        },
        onChangeRef.current
      );
      setQuery(resolveVariantDisplayQuery(result.variant, displayModeRef.current));
      setOpen(false);
      setResults([]);
      setFieldError(null);
    });
  }, [cancelPendingSearch, query]);

  const resolveExactSkuRef = useRef(resolveExactSku);
  resolveExactSkuRef.current = resolveExactSku;

  useEffect(() => {
    if (!value.variant_id) return;
    cancelPendingSearch();
    setOpen(false);
    setResults([]);
  }, [cancelPendingSearch, value.variant_id]);

  const setHighlight = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, Math.max(resultsRef.current.length - 1, 0)));
    highlightIndexRef.current = clamped;
    setHighlightIndex(clamped);
    inputRef.current?.focus({ preventScroll: true });
    const variant = resultsRef.current[clamped];
    if (variant?.variant_id) {
      prefetchPoLineCatalogContext(variant.variant_id);
      prefetchLineStockContexts(stockLocationIdRef.current, variant.variant_id, {
      scope: stockContextScopeRef.current,
    });
    }
  }, []);

  const handleComboboxKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.nativeEvent.isComposing) return;

      cancelBlurClose();

      const currentResults = resultsRef.current;

      if (event.key === "ArrowDown") {
        if (currentResults.length === 0) {
          if (!variantIdRef.current && queryRef.current.trim().length < 1) {
            event.preventDefault();
            event.stopPropagation();
            runBrowseRef.current();
          }
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const next = openRef.current ? highlightIndexRef.current + 1 : 0;
        setHighlight(next);
        if (!openRef.current) setOpen(true);
        return;
      }

      if (event.key === "ArrowUp") {
        if (currentResults.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const next = openRef.current
          ? highlightIndexRef.current - 1
          : currentResults.length - 1;
        setHighlight(next);
        if (!openRef.current) setOpen(true);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }

      if (isEnterKey(event.key)) {
        event.preventDefault();
        event.stopPropagation();

        if (currentResults.length > 0) {
          cancelPendingSearch();
          const index = Math.min(
            Math.max(highlightIndexRef.current, 0),
            currentResults.length - 1
          );
          const highlighted = currentResults[index];
          if (highlighted) {
            selectVariantRef.current(highlighted);
          }
          return;
        }

        cancelPendingSearch();
        void resolveExactSkuRef.current();
      }
    },
    [cancelBlurClose, cancelPendingSearch, setHighlight]
  );

  const handleInputChange = (nextQuery: string) => {
    setQuery(nextQuery);
    onChangeRef.current({
      sku: nextQuery,
      variant_id: "",
      item_name: "",
      variant_sku: "",
      skuError: null,
    });
    setFieldError(null);

    const cached = getCachedBrowseVariants();
    if (cached) {
      applySuggestionResults(cached, nextQuery);
    } else {
      setOpen(true);
    }

    if (nextQuery.trim().length < 1) {
      void runBrowseRef.current();
    }
  };

  const clearSelection = useCallback(() => {
    cancelBlurClose();
    cancelPendingSearch();
    skipSearchRef.current = true;
    onChangeRef.current({
      sku: "",
      variant_id: "",
      item_name: "",
      variant_sku: "",
      unit_cost: "0",
      skuError: null,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
    setFieldError(null);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      runBrowseRef.current();
    });
  }, [cancelBlurClose, cancelPendingSearch]);

  const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && listboxRef.current?.contains(related)) return;

    focusedRef.current = false;
    blurTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      if (queryRef.current.trim().length < 1 && !variantIdRef.current) {
        searchRequestIdRef.current += 1;
        setResults([]);
      }
    }, 120);
  };

  const handleFocus = () => {
    focusedRef.current = true;
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (!variantIdRef.current && queryRef.current.trim().length < 1) {
      void runBrowseRef.current();
      return;
    }
    if (results.length > 0) {
      setOpen(true);
      return;
    }
    const cached = getCachedBrowseVariants();
    if (cached && queryRef.current.trim().length > 0) {
      applySuggestionResults(cached, queryRef.current);
    }
  };

  const inputDisabled = disabled || isResolving;
  const itemDisplay = displayMode === "item";
  const showClearControl = clearable && Boolean(value.variant_id) && !inputDisabled;
  const showSearchIcon = !value.variant_id;
  const fieldLabel = itemDisplay ? "Item" : "SKU";
  const placeholder = compact
    ? itemDisplay
      ? "Scan or search item…"
      : "Scan or search SKU…"
    : itemDisplay
      ? "Scan barcode or search item / SKU"
      : "Scan barcode or search SKU / item name";
  const secondaryText =
    value.variant_id && (itemDisplay ? value.variant_sku : value.item_name);
  const secondaryTitle = itemDisplay ? value.variant_sku : value.item_name;
  const useWrappedItemDisplay =
    wrapSelectedItemName && itemDisplay && compact && Boolean(value.variant_id);

  const syncWrappedTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    if (!useWrappedItemDisplay) return;
    syncWrappedTextareaHeight();
  }, [useWrappedItemDisplay, query, syncWrappedTextareaHeight]);

  const fieldClassName = cn(
    !itemDisplay && "font-mono",
    compact && !useWrappedItemDisplay && "h-9 text-sm",
    compact && useWrappedItemDisplay && "min-h-9 py-1.5 text-sm leading-snug",
    inputClassName,
    useWrappedItemDisplay &&
      "h-auto resize-none overflow-visible break-words whitespace-normal",
  );
  const comboboxFieldProps = {
    value: query,
    disabled: inputDisabled,
    autoComplete: "off" as const,
    autoCorrect: "off" as const,
    autoCapitalize: "off" as const,
    spellCheck: false,
    placeholder,
    "aria-label": fieldLabel,
    role: "combobox" as const,
    "aria-expanded": open,
    "aria-controls": open && results.length > 0 ? listboxId : undefined,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant":
      open && results[highlightIndex]
        ? `${listboxId}-option-${highlightIndex}`
        : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      handleInputChange(event.target.value),
    onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleFocus();
      if (value.variant_id) {
        event.currentTarget.select();
      }
    },
    onBlur: handleBlur,
  };

  return (
    <div className={cn("min-w-0", compact ? "space-y-1.5" : "space-y-2 sm:col-span-2")}>
      {!compact ? (
        <Label className="text-sm font-medium text-muted-foreground">{fieldLabel}</Label>
      ) : null}
      <div
        ref={anchorRef}
        className="relative min-w-0"
        onKeyDownCapture={handleComboboxKeyDown}
      >
        {showSearchIcon ? (
          <Search
            className={cn(
              "pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground",
              useWrappedItemDisplay ? "top-2.5" : "top-1/2 -translate-y-1/2"
            )}
          />
        ) : null}
        {useWrappedItemDisplay ? (
          <textarea
            ref={assignInputRef}
            rows={1}
            className={cn(
              "flex w-full min-w-0 overflow-visible bg-transparent focus-visible:outline-none",
              fieldClassName,
              showSearchIcon ? "pl-8" : "pl-2",
              "pr-8"
            )}
            {...comboboxFieldProps}
          />
        ) : (
          <Input
            ref={assignInputRef}
            className={cn(fieldClassName, showSearchIcon ? "pl-8" : "pl-2", "pr-8")}
            {...comboboxFieldProps}
          />
        )}
        {showClearControl ? (
          <button
            type="button"
            tabIndex={-1}
            className={cn(
              "absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              useWrappedItemDisplay ? "top-2" : "top-1/2 -translate-y-1/2"
            )}
            aria-label={`Clear ${fieldLabel.toLowerCase()}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <ScanLine
            className={cn(
              "pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground",
              useWrappedItemDisplay ? "top-2.5" : "top-1/2 -translate-y-1/2"
            )}
            aria-hidden
          />
        )}

        {portalReady && open && dropdownStyle
          ? createPortal(
              results.length > 0 ? (
              <ul
                ref={listboxRef}
                id={listboxId}
                role="listbox"
                style={{
                  position: "fixed",
                  ...(dropdownStyle.bottom != null
                    ? { bottom: dropdownStyle.bottom }
                    : { top: dropdownStyle.top }),
                  left: dropdownStyle.left,
                  width: dropdownStyle.width,
                  maxHeight: dropdownStyle.maxHeight,
                }}
                className={cn(
                  "overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md",
                  popoverAboveDrawerClassName
                )}
                onMouseDown={(event) => event.preventDefault()}
              >
                {results.map((variant, index) => {
                  const selected = index === highlightIndex;
                  return (
                    <li key={variant.variant_id} role="presentation">
                      <button
                        ref={(node) => {
                          optionRefs.current[index] = node;
                        }}
                        id={`${listboxId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        tabIndex={-1}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                          selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/70"
                        )}
                        onMouseEnter={() => setHighlight(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectVariant(variant)}
                      >
                        <VariantSuggestionThumb imageUrl={variant.image_url} />
                        <span className="min-w-0 flex-1">
                          {itemDisplay ? (
                            <>
                              <span className="block truncate text-xs font-medium">
                                {variant.item_name}
                              </span>
                              <span className="block truncate font-mono text-xs text-muted-foreground">
                                {variant.variant_sku}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="block truncate font-mono text-xs font-medium">
                                {variant.variant_sku}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {variant.item_name}
                              </span>
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              ) : isSearching ? (
                <ul
                  role="listbox"
                  style={{
                    position: "fixed",
                    ...(dropdownStyle.bottom != null
                      ? { bottom: dropdownStyle.bottom }
                      : { top: dropdownStyle.top }),
                    left: dropdownStyle.left,
                    width: dropdownStyle.width,
                  }}
                  className={cn(
                    "rounded-md border border-border bg-popover p-1 shadow-md",
                    popoverAboveDrawerClassName
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <li className="px-2.5 py-2 text-sm text-muted-foreground">Loading items…</li>
                </ul>
              ) : null,
              document.body
            )
          : null}
      </div>

      {fieldError ? (
        <p className="line-clamp-2 text-[11px] leading-snug text-destructive">{fieldError}</p>
      ) : showSecondaryText && secondaryText ? (
        <p
          className={cn(
            "leading-snug text-muted-foreground",
            wrapSelectedItemName ? "break-words" : "truncate",
            compact ? "text-xs" : "text-[11px]",
            itemDisplay && "font-mono"
          )}
          title={secondaryTitle}
        >
          {secondaryText}
        </p>
      ) : isSearching && !value.variant_id ? (
        <p className="text-[11px] text-muted-foreground">Searching…</p>
      ) : null}
    </div>
  );
}
