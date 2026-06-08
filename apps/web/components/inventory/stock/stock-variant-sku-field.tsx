"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { ScanLine, Search } from "lucide-react";
import {
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
  value: StockLineSkuSelection;
  onChange: (patch: Partial<StockLineSkuSelection>) => void;
};

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

export function StockVariantSkuField({
  disabled = false,
  compact = false,
  value,
  onChange,
}: Props) {
  const listboxId = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [query, setQuery] = useState(value.variant_sku || value.sku);
  const [results, setResults] = useState<StockVariantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(value.skuError);
  const [isSearching, startSearchTransition] = useTransition();
  const [isResolving, startResolveTransition] = useTransition();
  const blurTimeoutRef = useRef<number | null>(null);
  const skipSearchRef = useRef(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resultsRef = useRef(results);
  const highlightIndexRef = useRef(highlightIndex);
  const openRef = useRef(open);
  resultsRef.current = results;
  highlightIndexRef.current = highlightIndex;
  openRef.current = open;
  const [portalReady, setPortalReady] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

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
    optionRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open, results.length]);

  useEffect(() => {
    setQuery(value.variant_sku || value.sku);
    setFieldError(value.skuError);
  }, [value.sku, value.variant_sku, value.skuError]);

  const runSearch = useCallback((nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setOpen(false);
      setFieldError(null);
      return;
    }

    startSearchTransition(async () => {
      const result = await searchStockVariantsForAdjustment(trimmed);
      if ("error" in result) {
        setResults([]);
        setOpen(false);
        setFieldError(result.error);
        return;
      }

      setResults(result.variants);
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
    if (value.variant_id && query === value.variant_sku) return;

    const handle = window.setTimeout(() => {
      runSearch(query);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query, runSearch, value.variant_id, value.variant_sku]);

  const selectVariant = useCallback((variant: StockVariantOption) => {
    if (!variant.adjustable) {
      setFieldError(variant.blocked_reason ?? STOCK_VARIANT_NOT_ADJUSTABLE);
      return;
    }
    skipSearchRef.current = true;
    applyVariant(variant, onChangeRef.current);
    setQuery(variant.variant_sku);
    setOpen(false);
    setResults([]);
    setFieldError(null);
  }, []);

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
        if (results.length === 1) {
          selectVariant(results[0]!);
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
        setOpen(results.length > 1);
        return;
      }

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
      setQuery(result.variant.variant_sku);
      setOpen(false);
      setResults([]);
      setFieldError(null);
    });
  }, [query, results, selectVariant]);

  const handleComboboxKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const currentResults = resultsRef.current;
      if (currentResults.length === 0) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        if (!openRef.current) {
          setOpen(true);
          setHighlightIndex(0);
          return;
        }
        setHighlightIndex((current) => Math.min(current + 1, currentResults.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        if (!openRef.current) {
          setOpen(true);
          setHighlightIndex(currentResults.length - 1);
          return;
        }
        setHighlightIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const highlighted = currentResults[highlightIndexRef.current];
        if (openRef.current && highlighted) {
          if (!highlighted.adjustable) {
            setFieldError(
              highlighted.blocked_reason ?? STOCK_VARIANT_NOT_ADJUSTABLE
            );
            return;
          }
          selectVariant(highlighted);
          return;
        }
        void resolveExactSku();
      }
    },
    [resolveExactSku, selectVariant]
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
    setOpen(true);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 120);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (results.length > 0) setOpen(true);
  };

  const inputDisabled = disabled || isResolving;

  return (
    <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-2 sm:col-span-2")}>
      {!compact ? (
        <Label className="text-sm font-medium text-muted-foreground">SKU</Label>
      ) : null}
      <div ref={anchorRef} className="relative min-w-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          className={cn("font-mono pl-8 pr-8", compact && "h-9 text-xs")}
          value={query}
          disabled={inputDisabled}
          placeholder={compact ? "Scan or search SKU…" : "Scan barcode or search SKU / item name"}
          aria-label="SKU"
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
          onKeyDown={handleComboboxKeyDown}
        />
        <ScanLine
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />

        {portalReady && open && results.length > 0 && dropdownStyle
          ? createPortal(
              <ul
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
                        aria-disabled={!variant.adjustable}
                        className={cn(
                          "flex w-full flex-col rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
                          !variant.adjustable && "cursor-not-allowed opacity-60",
                          variant.adjustable &&
                            (selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/70")
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectVariant(variant)}
                      >
                        <span className="font-mono text-xs font-medium">{variant.variant_sku}</span>
                        <span className="text-xs text-muted-foreground">{variant.item_name}</span>
                        {!variant.adjustable && variant.blocked_reason ? (
                          <span className="mt-0.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
                            {variant.blocked_reason}
                          </span>
                        ) : null}
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
      ) : value.variant_id ? (
        <p className="truncate text-[11px] leading-snug text-muted-foreground" title={value.item_name}>
          {value.item_name}
        </p>
      ) : isSearching ? (
        <p className="text-[11px] text-muted-foreground">Searching…</p>
      ) : null}
    </div>
  );
}
