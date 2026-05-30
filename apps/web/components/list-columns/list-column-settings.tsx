"use client";

import { useMemo, useRef, useState } from "react";
import {
  Columns3,
  GripVertical,
  LayoutList,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Table2,
  X,
} from "lucide-react";
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
import type {
  CardGridColumnCount,
  CardGridColumnPref,
  FrozenColumnPref,
} from "@/lib/products/list-prefs";
import {
  AUTO_LAYOUT_PREF,
  getAutoCardGridColumns,
  getAutoFrozenColumnCount,
  getMaxCardGridColumns,
} from "@/lib/products/list-prefs";
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
  frozenColumnCount?: FrozenColumnPref;
  onFrozenColumnCountChange?: (count: FrozenColumnPref) => void;
  cardGridColumns?: CardGridColumnPref;
  onCardGridColumnsChange?: (count: CardGridColumnPref) => void;
  disabled?: boolean;
  isSaving?: boolean;
};

const DEVICE_LABEL: Record<ColumnSettingsDevice, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

function segmentIconButtonClass(selected: boolean, className?: string) {
  return cn(
    "h-7 p-0 focus-visible:ring-1 focus-visible:ring-ring",
    className,
    selected
      ? "bg-background text-primary shadow-sm hover:bg-background hover:text-primary"
      : "text-muted-foreground hover:text-foreground"
  );
}

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
  frozenColumnCount = AUTO_LAYOUT_PREF,
  onFrozenColumnCountChange,
  cardGridColumns = AUTO_LAYOUT_PREF,
  onCardGridColumnsChange,
  disabled = false,
  isSaving = false,
}: Props<TId>) {
  const dragIdRef = useRef<TId | null>(null);
  const [dragOverId, setDragOverId] = useState<TId | null>(null);
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      dragIdRef.current = null;
      setDragOverId(null);
    }
  };

  const allowedSet = useMemo(() => new Set(allowedColumnIds), [allowedColumnIds]);
  const editableColumnOrder = useMemo(
    () => prefs.columnOrder.filter((columnId) => allowedSet.has(columnId)),
    [allowedSet, prefs.columnOrder]
  );

  const maxCardGridColumns = getMaxCardGridColumns(editingDevice);
  const cardGridOptions = useMemo(() => {
    return Array.from({ length: maxCardGridColumns }, (_, index) => (index + 1) as CardGridColumnCount);
  }, [maxCardGridColumns]);

  const autoCardGridLabel = getAutoCardGridColumns(editingDevice);
  const autoFrozenLabel = getAutoFrozenColumnCount(editingDevice);
  const cardGridSelectValue =
    cardGridColumns === AUTO_LAYOUT_PREF
      ? AUTO_LAYOUT_PREF
      : String(Math.min(cardGridColumns, maxCardGridColumns));
  const freezeSelectValue =
    frozenColumnCount === AUTO_LAYOUT_PREF ? AUTO_LAYOUT_PREF : String(frozenColumnCount);

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
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title="Column settings"
          aria-label="Column settings"
          aria-busy={isSaving}
          disabled={disabled}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Columns3 className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80"
        onPointerDownOutside={(event) => {
          if (dragIdRef.current) event.preventDefault();
        }}
      >
        <div className="flex items-start justify-between gap-2 px-2 pt-1.5">
          <DropdownMenuLabel className="p-0">Visible columns & order</DropdownMenuLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            onClick={() => handleOpenChange(false)}
            aria-label="Close column settings"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="px-2 pb-2 text-xs text-muted-foreground">
          Editing: <span className="font-medium text-foreground">{editingLabel}</span>
          {editingDevice === detectedDevice ? (
            <span className="text-muted-foreground"> (auto-detected)</span>
          ) : null}
        </p>
        <div className="flex items-center gap-2 px-2 pb-2">
          <div
            className="inline-flex shrink-0 gap-0.5 rounded-md border border-border bg-muted p-0.5"
            role="group"
            aria-label="Layout"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={segmentIconButtonClass(editingLayout === "table", "w-8")}
              onClick={() => onEditingLayoutChange("table")}
              title="Table layout"
              aria-label="Table layout"
              aria-pressed={editingLayout === "table"}
            >
              <Table2 className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={segmentIconButtonClass(editingLayout === "compact", "w-8")}
              onClick={() => onEditingLayoutChange("compact")}
              title="Card layout"
              aria-label="Card layout"
              aria-pressed={editingLayout === "compact"}
            >
              <LayoutList className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div
            className="inline-flex min-w-0 flex-1 gap-0.5 rounded-md border border-border bg-muted p-0.5"
            role="group"
            aria-label="Device"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={segmentIconButtonClass(editingDevice === "mobile", "flex-1")}
              onClick={() => onEditingDeviceChange("mobile")}
              title="Mobile"
              aria-label="Mobile"
              aria-pressed={editingDevice === "mobile"}
            >
              <Smartphone className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={segmentIconButtonClass(editingDevice === "tablet", "flex-1")}
              onClick={() => onEditingDeviceChange("tablet")}
              title="Tablet"
              aria-label="Tablet"
              aria-pressed={editingDevice === "tablet"}
            >
              <Tablet className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={segmentIconButtonClass(editingDevice === "desktop", "flex-1")}
              onClick={() => onEditingDeviceChange("desktop")}
              title="Desktop"
              aria-label="Desktop"
              aria-pressed={editingDevice === "desktop"}
            >
              <Monitor className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 px-2 py-2">
          {editingLayout === "compact" ? (
            <>
              <label
                htmlFor="card-grid-columns-select"
                className="shrink-0 text-xs text-muted-foreground"
              >
                Card columns · {DEVICE_LABEL[editingDevice]}
              </label>
              {editingDevice === "mobile" ? (
                <span className="text-xs font-medium text-foreground">Auto ({autoCardGridLabel})</span>
              ) : (
                <Select
                  value={cardGridSelectValue}
                  onValueChange={(value) => {
                    if (value === AUTO_LAYOUT_PREF) {
                      onCardGridColumnsChange?.(AUTO_LAYOUT_PREF);
                      return;
                    }
                    const count = Number(value);
                    if (count === 1 || count === 2 || count === 3 || count === 4) {
                      onCardGridColumnsChange?.(count);
                    }
                  }}
                >
                  <SelectTrigger
                    id="card-grid-columns-select"
                    className="h-7 w-16 shrink-0 px-2 py-0 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5"
                    aria-label="Card columns per row"
                    title={
                      cardGridColumns === AUTO_LAYOUT_PREF
                        ? `Auto (${autoCardGridLabel} on ${DEVICE_LABEL[editingDevice].toLowerCase()})`
                        : undefined
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_LAYOUT_PREF}>Auto</SelectItem>
                    {cardGridOptions.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          ) : (
            <>
              <label
                htmlFor="freeze-columns-select"
                className="shrink-0 text-xs text-muted-foreground"
              >
                Freeze columns · {DEVICE_LABEL[editingDevice]}
              </label>
              {editingDevice === "mobile" ? (
                <span className="text-xs font-medium text-foreground">Auto ({autoFrozenLabel})</span>
              ) : (
                <Select
                  value={freezeSelectValue}
                  onValueChange={(value) => {
                    if (value === AUTO_LAYOUT_PREF) {
                      onFrozenColumnCountChange?.(AUTO_LAYOUT_PREF);
                      return;
                    }
                    const count = Number(value);
                    if (count === 0 || count === 1 || count === 2 || count === 3) {
                      onFrozenColumnCountChange?.(count);
                    }
                  }}
                >
                  <SelectTrigger
                    id="freeze-columns-select"
                    className="h-7 w-16 shrink-0 px-2 py-0 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5"
                    aria-label="Freeze columns"
                    title={
                      frozenColumnCount === AUTO_LAYOUT_PREF
                        ? `Auto (${autoFrozenLabel} on ${DEVICE_LABEL[editingDevice].toLowerCase()})`
                        : undefined
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_LAYOUT_PREF}>Auto</SelectItem>
                    <SelectItem value="0">0</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
        <DropdownMenuSeparator />
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
                  className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4 [&>span]:shadow-md"
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
