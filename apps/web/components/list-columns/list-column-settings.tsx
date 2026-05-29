"use client";

import { useMemo, useRef, useState } from "react";
import { Columns3, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ListColumnPrefs, ListColumnRegistry } from "@/lib/list-columns/types";
import { getColumnDef } from "@/lib/list-columns/types";
import type { CardGridColumnCount } from "@/lib/products/list-prefs";
import { getMaxCardGridColumns } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

export type ColumnSettingsLayout = "table" | "compact";
export type ColumnSettingsDevice = "mobile" | "tablet" | "desktop";

type Props<TId extends string> = {
  registry: ListColumnRegistry<TId>;
  prefs: ListColumnPrefs<TId>;
  onChange: (prefs: ListColumnPrefs<TId>) => void;
  allowedColumnIds: readonly TId[];
  editingLayout: ColumnSettingsLayout;
  editingDevice: ColumnSettingsDevice;
  detectedDevice: ColumnSettingsDevice;
  onEditingLayoutChange: (layout: ColumnSettingsLayout) => void;
  onEditingDeviceChange: (device: ColumnSettingsDevice) => void;
  showFreezeControl?: boolean;
  frozenColumnCount?: 0 | 1 | 2 | 3;
  onFrozenColumnCountChange?: (count: 0 | 1 | 2 | 3) => void;
  cardGridColumns?: CardGridColumnCount;
  onCardGridColumnsChange?: (count: CardGridColumnCount) => void;
  disabled?: boolean;
};

const DEVICE_LABEL: Record<ColumnSettingsDevice, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

export function ListColumnSettings<TId extends string>({
  registry,
  prefs,
  onChange,
  allowedColumnIds,
  editingLayout,
  editingDevice,
  detectedDevice,
  onEditingLayoutChange,
  onEditingDeviceChange,
  showFreezeControl = false,
  frozenColumnCount = 0,
  onFrozenColumnCountChange,
  cardGridColumns = 1,
  onCardGridColumnsChange,
  disabled = false,
}: Props<TId>) {
  const dragIdRef = useRef<TId | null>(null);
  const [dragOverId, setDragOverId] = useState<TId | null>(null);

  const allowedSet = useMemo(() => new Set(allowedColumnIds), [allowedColumnIds]);
  const editableColumnOrder = useMemo(
    () => prefs.columnOrder.filter((columnId) => allowedSet.has(columnId)),
    [allowedSet, prefs.columnOrder]
  );

  const maxCardGridColumns = getMaxCardGridColumns(editingDevice);
  const cardGridOptions = useMemo(() => {
    return Array.from({ length: maxCardGridColumns }, (_, index) => (index + 1) as CardGridColumnCount);
  }, [maxCardGridColumns]);

  const moveColumn = (fromId: TId, toId: TId) => {
    if (fromId === toId) return;

    const columnOrder = [...prefs.columnOrder];
    const fromIndex = columnOrder.indexOf(fromId);
    const toIndex = columnOrder.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0) return;

    columnOrder.splice(fromIndex, 1);
    columnOrder.splice(toIndex, 0, fromId);
    onChange({ ...prefs, columnOrder });
  };

  const toggleVisible = (columnId: TId, visible: boolean) => {
    const visibleColumns = visible
      ? [...new Set([...prefs.visibleColumns, columnId])]
      : prefs.visibleColumns.filter((id) => id !== columnId);

    if (visibleColumns.length === 0) return;

    onChange({ ...prefs, visibleColumns });
  };

  const editingLabel = `${editingLayout === "table" ? "Table" : "Card"} · ${DEVICE_LABEL[editingDevice]}`;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title="Column settings"
          aria-label="Column settings"
          disabled={disabled}
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80"
        onPointerDownOutside={(event) => {
          if (dragIdRef.current) event.preventDefault();
        }}
      >
        <DropdownMenuLabel>Visible columns & order</DropdownMenuLabel>
        <p className="px-2 pb-2 text-xs text-muted-foreground">
          Editing: <span className="font-medium text-foreground">{editingLabel}</span>
          {editingDevice === detectedDevice ? (
            <span className="text-muted-foreground"> (auto-detected)</span>
          ) : null}
        </p>
        <div className="space-y-2 px-2 pb-2">
          <div className="inline-flex w-full rounded-md border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={editingLayout === "table" ? "secondary" : "ghost"}
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => onEditingLayoutChange("table")}
            >
              Table
            </Button>
            <Button
              type="button"
              size="sm"
              variant={editingLayout === "compact" ? "secondary" : "ghost"}
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => onEditingLayoutChange("compact")}
            >
              Card
            </Button>
          </div>
          <div className="inline-flex w-full rounded-md border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={editingDevice === "mobile" ? "secondary" : "ghost"}
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => onEditingDeviceChange("mobile")}
            >
              Mobile
            </Button>
            <Button
              type="button"
              size="sm"
              variant={editingDevice === "tablet" ? "secondary" : "ghost"}
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => onEditingDeviceChange("tablet")}
            >
              Tablet
            </Button>
            <Button
              type="button"
              size="sm"
              variant={editingDevice === "desktop" ? "secondary" : "ghost"}
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => onEditingDeviceChange("desktop")}
            >
              Desktop
            </Button>
          </div>
        </div>
        {editingLayout === "compact" ? (
          <div className="flex items-center justify-between gap-3 px-2 pb-2">
            <label
              htmlFor="card-grid-columns-select"
              className="shrink-0 text-xs text-muted-foreground"
            >
              Card columns · {DEVICE_LABEL[editingDevice]}
            </label>
            {editingDevice === "mobile" ? (
              <span className="text-xs font-medium text-foreground">1 (fixed)</span>
            ) : (
              <Select
                value={String(Math.min(cardGridColumns, maxCardGridColumns))}
                onValueChange={(value) => {
                  const count = Number(value);
                  if (count === 1 || count === 2 || count === 3 || count === 4) {
                    onCardGridColumnsChange?.(count);
                  }
                }}
              >
                <SelectTrigger
                  id="card-grid-columns-select"
                  className="h-8 w-14 shrink-0 px-2"
                  aria-label="Card columns per row"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardGridOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : null}
        <p className="px-2 pb-1 text-xs text-muted-foreground">Drag rows to reorder columns.</p>
        {showFreezeControl ? (
          <>
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <label
                htmlFor="freeze-columns-select"
                className="shrink-0 text-xs text-muted-foreground"
              >
                Freeze columns when scrolling
              </label>
              <Select
                value={String(frozenColumnCount)}
                onValueChange={(value) => {
                  const count = Number(value);
                  if (count === 0 || count === 1 || count === 2 || count === 3) {
                    onFrozenColumnCountChange?.(count);
                  }
                }}
              >
                <SelectTrigger
                  id="freeze-columns-select"
                  className="h-8 w-14 shrink-0 px-2"
                  aria-label="Freeze columns"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <div className="max-h-96 space-y-0.5 overflow-y-auto p-1">
          {editableColumnOrder.map((columnId) => {
            const column = getColumnDef(registry, columnId);
            const visible = prefs.visibleColumns.includes(columnId);
            const isDragOver = dragOverId === columnId;

            return (
              <div
                key={columnId}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverId(columnId);
                }}
                onDragLeave={() => {
                  if (dragOverId === columnId) setDragOverId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromId =
                    dragIdRef.current ?? (event.dataTransfer.getData("text/plain") as TId);
                  if (fromId) moveColumn(fromId, columnId);
                  dragIdRef.current = null;
                  setDragOverId(null);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-accent/50",
                  isDragOver && "bg-accent/60 ring-2 ring-primary/30"
                )}
              >
                <button
                  type="button"
                  draggable
                  className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
                  aria-label={`Drag ${column.label} to reorder`}
                  onDragStart={(event) => {
                    dragIdRef.current = columnId;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", columnId);
                  }}
                  onDragEnd={() => {
                    dragIdRef.current = null;
                    setDragOverId(null);
                  }}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <Switch
                  checked={visible}
                  onCheckedChange={(checked) => toggleVisible(columnId, checked)}
                  aria-label={`Toggle ${column.label}`}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{column.label}</span>
                  {column.group ? (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {column.group}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
