"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { ScanLine, Search } from "lucide-react";
import {
  listStockVariantsForAdjustmentBrowse,
  lookupStockVariantBySku,
  searchStockVariantsForAdjustment,
} from "@/app/inventory/stock/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import type { StockVariantOption } from "@/lib/inventory/stock/types";
import { cn } from "@/lib/utils";

const STOCK_VARIANT_NOT_ADJUSTABLE =
  "This variant is not available for stock adjustments or transfers.";

function isEnterKey(key: string): boolean {
  return key === "Enter" || key === "NumpadEnter";
}

export type StockLineSkuSelection = {
  sku: string;
  variant_id: string;
  item_name: string;
  variant_sku: string;
  unit_cost: string;
  skuError: string | null;
};

type Props = {
  disabled?: boolean;
  compact?: boolean;
  /** When "item", shows item name in the field and SKU as secondary text. */
  displayMode?: "sku" | "item";
  inputRef?: React.Ref<HTMLInputElement | null>;
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

function applyVariant(
  variant: StockVariantOption,
  onChange: (patch: Partial<StockLineSkuSelection>) => void
) {
  onChange({
    sku: variant.variant_sku,
    variant_id: variant.variant_id,
    item_name: variant.item_name,
    variant_sku: variant.variant_sku,
    unit_cost: variant.standard_cost ?? "0",
    skuError: null,
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
  inputRef: externalInputRef,
  value,
  onChange,
}: Props) {
  const listboxId = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;
  const [query, setQuery] = useState(() => resolveDisplayQuery(value, displayMode));
  const [results, setResults] = useState<StockVariantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(value.skuError);
  const [isSearching, startSearchTransition] = useTransition();
  const [isResolving, startResolveTransition] = useTransition();
  const blurTimeoutRef = useRef<number | null>(null);
  const skipSearchRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const assignInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      assignRef(externalInputRef, node);
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
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const debounceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const maxHeight = Math.max(120, Math.min(224, spaceBelow));

    setDropdownStyle({
      top: rect.bottom + 4,
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
    if (!open || results.length === 0) {
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
  }, [open, results.length, updateDropdownPosition]);

  useLayoutEffect(() => {
    if (!open || results.length === 0) return;
    scrollHighlightedIntoView(highlightIndex);
  }, [highlightIndex, open, results.length, scrollHighlightedIntoView]);

  useEffect(() => {
    setQuery(resolveDisplayQuery(value, displayMode));
    setFieldError(value.skuError);
  }, [displayMode, value.item_name, value.sku, value.variant_id, value.variant_sku, value.skuError]);

  const runBrowse = useCallback(() => {
    if (!focusedRef.current || variantIdRef.current) return;

    const requestId = ++searchRequestIdRef.current;

    startSearchTransition(async () => {
      const result = await listStockVariantsForAdjustmentBrowse();
      if (requestId !== searchRequestIdRef.current || !focusedRef.current) return;

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
      setFieldError(null);
    });
  }, []);

  const runBrowseRef = useRef(runBrowse);
  runBrowseRef.current = runBrowse;

  const runSearch = useCallback((nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setOpen(false);
      setFieldError(null);
      return;
    }

    const requestId = ++searchRequestIdRef.current;

    startSearchTransition(async () => {
      const result = await searchStockVariantsForAdjustment(trimmed);
      if (requestId !== searchRequestIdRef.current) return;

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
    });
  }, []);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (value.variant_id && isSelectionDisplayQuery(query, value, displayMode)) return;
    if (query.trim().length < 1) return;

    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      debounceTimeoutRef.current = null;
      runSearch(query);
    }, 250);

    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [displayMode, query, runSearch, value]);

  const selectVariant = useCallback((variant: StockVariantOption) => {
    if (!variant.adjustable) {
      setFieldError(variant.blocked_reason ?? STOCK_VARIANT_NOT_ADJUSTABLE);
      return;
    }

    searchRequestIdRef.current += 1;
    skipSearchRef.current = true;
    applyVariant(variant, onChangeRef.current);
    setQuery(resolveVariantDisplayQuery(variant, displayModeRef.current));
    setOpen(false);
    setResults([]);
    setFieldError(null);
  }, []);

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

      searchRequestIdRef.current += 1;
      skipSearchRef.current = true;
      applyVariant(
        {
          variant_id: result.variant.variant_id,
          item_id: result.variant.item_id,
          item_name: result.variant.item_name,
          variant_sku: result.variant.variant_sku,
          standard_cost: result.variant.standard_cost,
          adjustable: true,
          blocked_reason: null,
        },
        onChangeRef.current
      );
      setQuery(resolveVariantDisplayQuery(result.variant, displayModeRef.current));
      setOpen(false);
      setResults([]);
      setFieldError(null);
    });
  }, [query]);

  const resolveExactSkuRef = useRef(resolveExactSku);
  resolveExactSkuRef.current = resolveExactSku;

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
  }, []);

  const setHighlight = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, Math.max(resultsRef.current.length - 1, 0)));
    highlightIndexRef.current = clamped;
    setHighlightIndex(clamped);
    inputRef.current?.focus({ preventScroll: true });
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
    if (nextQuery.trim().length < 1) {
      runBrowseRef.current();
      return;
    }
    setOpen(true);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
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
      runBrowseRef.current();
      return;
    }
    if (results.length > 0) setOpen(true);
  };

  const inputDisabled = disabled || isResolving;
  const itemDisplay = displayMode === "item";
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

  return (
    <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-2 sm:col-span-2")}>
      {!compact ? (
        <Label className="text-sm font-medium text-muted-foreground">{fieldLabel}</Label>
      ) : null}
      <div
        ref={anchorRef}
        className="relative min-w-0"
        onKeyDownCapture={handleComboboxKeyDown}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={assignInputRef}
          className={cn("pl-8 pr-8", !itemDisplay && "font-mono", compact && "h-9 text-xs")}
          value={query}
          disabled={inputDisabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-label={fieldLabel}
          role="combobox"
          aria-expanded={open}
          aria-controls={open && results.length > 0 ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[highlightIndex]
              ? `${listboxId}-option-${highlightIndex}`
              : undefined
          }
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <ScanLine
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />

        {portalReady && open && results.length > 0 && dropdownStyle
          ? createPortal(
              <ul
                ref={listboxRef}
                id={listboxId}
                role="listbox"
                style={{
                  position: "fixed",
                  top: dropdownStyle.top,
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
                          "flex w-full flex-col rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
                          selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/70"
                        )}
                        onMouseEnter={() => setHighlight(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectVariant(variant)}
                      >
                        {itemDisplay ? (
                          <>
                            <span className="text-xs font-medium">{variant.item_name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {variant.variant_sku}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-mono text-xs font-medium">{variant.variant_sku}</span>
                            <span className="text-xs text-muted-foreground">{variant.item_name}</span>
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>,
              document.body
            )
          : null}
      </div>

      {fieldError ? (
        <p className="line-clamp-2 text-[11px] leading-snug text-destructive">{fieldError}</p>
      ) : secondaryText ? (
        <p
          className={cn(
            "truncate text-[11px] leading-snug text-muted-foreground",
            itemDisplay && "font-mono"
          )}
          title={secondaryTitle}
        >
          {secondaryText}
        </p>
      ) : isSearching ? (
        <p className="text-[11px] text-muted-foreground">Searching…</p>
      ) : null}
    </div>
  );
}
