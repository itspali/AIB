"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getPriceBookEntries, savePriceBookEntries } from "@/app/items/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  uomCodes: string[];
  readOnly?: boolean;
};

const ALL_VARIANTS = "__all__";
const ANY_UOM = "__any__";

type DraftRow = {
  key: string;
  variantId: string | null;
  uomCode: string | null;
  minQuantity: string;
  price: string;
};

type BookMeta = { id: string; name: string; currency_code: string };

let rowCounter = 0;
function nextRowKey(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

export function PriceBookEntryEditor({ itemId, variants, uomCodes, readOnly = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [rowsByBook, setRowsByBook] = useState<Record<string, DraftRow[]>>({});
  const [isPending, startTransition] = useTransition();

  const variantLabel = useCallback(
    (variantId: string | null): string => {
      if (!variantId) return "All variants";
      const match = variants.find((v) => v.id === variantId);
      return match ? match.sku : variantId;
    },
    [variants]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getPriceBookEntries(itemId);
    if ("error" in result) {
      toast.error(result.error ?? "Unable to load price book entries.");
      setLoading(false);
      return;
    }

    const grouped: Record<string, DraftRow[]> = {};
    for (const book of result.data.books) {
      grouped[book.id] = [];
    }
    for (const entry of result.data.entries) {
      if (!grouped[entry.price_book_id]) grouped[entry.price_book_id] = [];
      grouped[entry.price_book_id].push({
        key: nextRowKey(),
        variantId: entry.variant_id,
        uomCode: entry.uom_code,
        minQuantity: String(entry.min_quantity),
        price: String(entry.price),
      });
    }

    setBooks(result.data.books);
    setRowsByBook(grouped);
    setSelectedBookId((prev) => prev || result.data.books[0]?.id || "");
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentRows = useMemo(
    () => (selectedBookId ? rowsByBook[selectedBookId] ?? [] : []),
    [rowsByBook, selectedBookId]
  );

  const currentBook = books.find((book) => book.id === selectedBookId) ?? null;

  const updateRows = (updater: (rows: DraftRow[]) => DraftRow[]) => {
    setRowsByBook((prev) => ({
      ...prev,
      [selectedBookId]: updater(prev[selectedBookId] ?? []),
    }));
  };

  const addRow = () => {
    updateRows((rows) => [
      ...rows,
      { key: nextRowKey(), variantId: null, uomCode: null, minQuantity: "1", price: "" },
    ]);
  };

  const removeRow = (key: string) => {
    updateRows((rows) => rows.filter((row) => row.key !== key));
  };

  const patchRow = (key: string, patch: Partial<DraftRow>) => {
    updateRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleSave = () => {
    if (!selectedBookId) return;

    const seen = new Set<string>();
    const payload: Array<{
      variant_id: string | null;
      uom_code: string | null;
      min_quantity: number;
      price: number;
    }> = [];

    for (const row of currentRows) {
      const minQty = Number(row.minQuantity);
      const price = Number(row.price);

      if (!row.price.trim() || !Number.isFinite(price) || price < 0) {
        toast.error(`Enter a valid price for the ${variantLabel(row.variantId)} row.`);
        return;
      }
      if (!Number.isFinite(minQty) || minQty <= 0) {
        toast.error(`Minimum quantity must be greater than zero (${variantLabel(row.variantId)}).`);
        return;
      }

      const combo = `${row.variantId ?? "*"}|${row.uomCode ?? "*"}|${minQty}`;
      if (seen.has(combo)) {
        toast.error("Two rows share the same variant, unit, and minimum quantity.");
        return;
      }
      seen.add(combo);

      payload.push({
        variant_id: row.variantId,
        uom_code: row.uomCode,
        min_quantity: minQty,
        price,
      });
    }

    startTransition(async () => {
      const result = await savePriceBookEntries(itemId, selectedBookId, payload);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save price book entries.");
        return;
      }
      toast.success("Price book updated.");
      router.refresh();
      void load();
    });
  };

  if (loading) {
    return (
      <section className="surface-panel">
        <p className="text-sm text-muted-foreground">Loading price books…</p>
      </section>
    );
  }

  if (books.length === 0) {
    return (
      <section className="surface-panel space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Price Book Entries
        </h3>
        <p className="text-sm text-muted-foreground">
          No active price books yet. Create a price book to manage per-variant and quantity-break
          pricing.
        </p>
      </section>
    );
  }

  return (
    <section className="surface-panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Price Book Entries
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Set per-variant, per-unit, and quantity-break prices. Leave the variant as{" "}
            <span className="font-medium">All variants</span> for an item-level price; the most
            specific match wins at sale time.
          </p>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            Save price book
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={selectedBookId} onValueChange={setSelectedBookId}>
          <SelectTrigger className="sm:w-72">
            <SelectValue placeholder="Select a price book" />
          </SelectTrigger>
          <SelectContent>
            {books.map((book) => (
              <SelectItem key={book.id} value={book.id}>
                {book.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentBook && <Badge variant="active">{currentBook.currency_code}</Badge>}
      </div>

      <div className="surface-inset overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3 font-medium text-muted-foreground">Variant</th>
              <th className="p-3 font-medium text-muted-foreground">Unit</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Min qty</th>
              <th className="p-3 text-right font-medium text-muted-foreground">
                Price{currentBook ? ` (${currentBook.currency_code})` : ""}
              </th>
              {!readOnly && <th className="p-3" />}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="p-3">
                  <Select
                    value={row.variantId ?? ALL_VARIANTS}
                    disabled={readOnly || isPending}
                    onValueChange={(value) =>
                      patchRow(row.key, { variantId: value === ALL_VARIANTS ? null : value })
                    }
                  >
                    <SelectTrigger className="min-w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VARIANTS}>All variants</SelectItem>
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.sku}
                          {variant.is_master ? " (master)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Select
                    value={row.uomCode ?? ANY_UOM}
                    disabled={readOnly || isPending}
                    onValueChange={(value) =>
                      patchRow(row.key, { uomCode: value === ANY_UOM ? null : value })
                    }
                  >
                    <SelectTrigger className="min-w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY_UOM}>Any unit</SelectItem>
                      {uomCodes.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Input
                    className="text-right font-mono"
                    inputMode="decimal"
                    disabled={readOnly || isPending}
                    value={row.minQuantity}
                    onChange={(event) => patchRow(row.key, { minQuantity: event.target.value })}
                  />
                </td>
                <td className="p-3">
                  <Input
                    className="text-right font-mono"
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={readOnly || isPending}
                    value={row.price}
                    onChange={(event) => patchRow(row.key, { price: event.target.value })}
                  />
                </td>
                {!readOnly && (
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => removeRow(row.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {currentRows.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 4 : 5}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  No price entries in this book yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={isPending}>
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
      )}
    </section>
  );
}
