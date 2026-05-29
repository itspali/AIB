"use client";

import { ChevronDown, ChevronUp, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListPrefs } from "@/lib/products/list-prefs";

type Props = {
  prefs: ProductListPrefs;
  onChange: (prefs: ProductListPrefs) => void;
};

export function ProductListColumnSettings({ prefs, onChange }: Props) {
  const moveColumn = (columnId: ProductListColumnId, direction: -1 | 1) => {
    const index = prefs.columnOrder.indexOf(columnId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= prefs.columnOrder.length) return;

    const columnOrder = [...prefs.columnOrder];
    [columnOrder[index], columnOrder[target]] = [columnOrder[target], columnOrder[index]];
    onChange({ ...prefs, columnOrder });
  };

  const toggleVisible = (columnId: ProductListColumnId, visible: boolean) => {
    const visibleColumns = visible
      ? [...new Set([...prefs.visibleColumns, columnId])]
      : prefs.visibleColumns.filter((id) => id !== columnId);

    if (visibleColumns.length === 0) return;

    onChange({ ...prefs, visibleColumns });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title="Column settings"
          aria-label="Column settings"
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Visible columns & order</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 space-y-1 overflow-y-auto p-1">
          {prefs.columnOrder.map((columnId, index) => {
            const column = getColumnDef(columnId);
            const visible = prefs.visibleColumns.includes(columnId);

            return (
              <div
                key={columnId}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
              >
                <Switch
                  checked={visible}
                  onCheckedChange={(checked) => toggleVisible(columnId, checked)}
                  aria-label={`Toggle ${column.label}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{column.label}</span>
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={index === 0}
                    onClick={() => moveColumn(columnId, -1)}
                    aria-label={`Move ${column.label} up`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={index === prefs.columnOrder.length - 1}
                    onClick={() => moveColumn(columnId, 1)}
                    aria-label={`Move ${column.label} down`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
