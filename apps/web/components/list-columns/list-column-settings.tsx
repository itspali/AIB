"use client";

import { useMemo, useRef, useState } from "react";
import {
  Columns3,
  GripVertical,
  LayoutGrid,
  Monitor,
  Rows3,
  Smartphone,
  Tablet,
  Table2,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  columnSupportsWrapControl,
  defaultWrapModeForValueKind,
  TEXT_WRAP_MODE_LABELS,
  TEXT_WRAP_MODES,
  type TextWrapMode,
} from "@/lib/display/text-wrap";
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
  ProductCardLayout,
} from "@/lib/products/list-prefs";
import {
  AUTO_LAYOUT_PREF,
  getAutoCardGridColumns,
  getAutoFrozenColumnCount,
  getMaxCardGridColumns,
  isCardGridColumnCount,
  parseProductCardLayout,
} from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

export type ColumnSettingsLayout = "table" | "compact" | "card";
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
  cardLayout?: ProductCardLayout;
  onCardLayoutChange?: (layout: ProductCardLayout) => void;
  disabled?: boolean;
  isSaving?: boolean;
  triggerClassName?: string;
  triggerVariant?: "outline" | "ghost";
};

const DEVICE_LABEL: Record<ColumnSettingsDevice, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

function segmentIconButtonClass(selected: boolean, className?: string) {
  return cn(
    "h-6 p-0 focus-visible:ring-1 focus-visible:ring-ring",
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
  cardLayout = "v2",
  onCardLayoutChange,
  disabled = false,
  isSaving = false,
  triggerClassName,
  triggerVariant = "outline",
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

  const setWrapMode = (columnId: TId, wrapMode: TextWrapMode) => {
    onChange({
      ...prefs,
      columnWrapModes: {
        ...prefs.columnWrapModes,
        [columnId]: wrapMode,
      },
    });
  };

  const effectiveWrapMode = (columnId: TId): TextWrapMode => {
    const column = getColumnDef(registry, columnId);
    const override = prefs.columnWrapModes?.[columnId];
    if (override) return override;
    if (column.defaultWrapMode) return column.defaultWrapMode;
    if (column.valueKind) {
      return defaultWrapModeForValueKind(column.valueKind, editingLayout);
    }
    return "truncate";
  };

  const layoutLabel =
    editingLayout === "table" ? "Table" : editingLayout === "compact" ? "Compact" : "Card";
  const editingLabel = `${layoutLabel} · ${DEVICE_LABEL[editingDevice]}`;

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size="sm"
          className={cn("h-8 w-8 p-0", triggerClassName)}
          title="Column settings"
          aria-label="Column settings"
          aria-busy={isSaving}
          disabled={disabled}
        >
          {isSaving ? (
            <Spinner />
          ) : (
            <Columns3 className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[17.5rem] p-0 text-xs"
        onPointerDownOutside={(event) => {
          if (dragIdRef.current) event.preventDefault();
        }}
      >
        <div className="flex items-center justify-between gap-1.5 px-2 pt-1.5">
          <DropdownMenuLabel className="p-0 text-xs font-semibold leading-none">
            Columns
          </DropdownMenuLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 p-0"
            onClick={() => handleOpenChange(false)}
            aria-label="Close column settings"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="px-2 pb-1.5 text-[11px] leading-snug text-muted-foreground">
          {editingLabel}
          {editingDevice === detectedDevice ? " · auto" : null}
        </p>
        <div className="flex items-center gap-1.5 px-2 pb-1.5">
          <div
            className="inline-flex shrink-0 gap-px rounded-md border border-border bg-muted p-px"
            role="group"
            aria-label="Layout"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={segmentIconButtonClass(editingLayout === "table", "w-7")}
              onClick={() => onEditingLayoutChange("table")}
              title="Table layout"
              aria-label="Table layout"
              aria-pressed={editingLayout === "table"}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={segmentIconButtonClass(editingLayout === "compact", "w-7")}
              onClick={() => onEditingLayoutChange("compact")}
              title="Compact table layout"
              aria-label="Compact table layout"
              aria-pressed={editingLayout === "compact"}
            >
              <Rows3 className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={segmentIconButtonClass(editingLayout === "card", "w-7")}
              onClick={() => onEditingLayoutChange("card")}
              title="Card layout"
              aria-label="Card layout"
              aria-pressed={editingLayout === "card"}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          <div
            className="inline-flex min-w-0 flex-1 gap-px rounded-md border border-border bg-muted p-px"
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
              <Smartphone className="h-3.5 w-3.5" aria-hidden />
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
              <Tablet className="h-3.5 w-3.5" aria-hidden />
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
              <Monitor className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          {editingLayout === "card" ? (
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="card-grid-columns-select"
                  className="shrink-0 text-[11px] text-muted-foreground"
                >
                  Cards · {DEVICE_LABEL[editingDevice]}
                </label>
                <Select
                  value={cardGridSelectValue}
                  onValueChange={(value) => {
                    if (value === AUTO_LAYOUT_PREF) {
                      onCardGridColumnsChange?.(AUTO_LAYOUT_PREF);
                      return;
                    }
                    const count = Number(value);
                    if (isCardGridColumnCount(count)) {
                      onCardGridColumnsChange?.(count);
                    }
                  }}
                >
                  <SelectTrigger
                    id="card-grid-columns-select"
                    className="h-6 w-14 shrink-0 px-1.5 py-0 text-[11px] [&>svg]:h-3 [&>svg]:w-3"
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
              </div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="card-layout-style-settings"
                  className="shrink-0 text-[11px] text-muted-foreground"
                >
                  Card style
                </label>
                <Select
                  value={cardLayout}
                  onValueChange={(value) =>
                    onCardLayoutChange?.(parseProductCardLayout(value))
                  }
                >
                  <SelectTrigger
                    id="card-layout-style-settings"
                    className="h-6 w-[4.75rem] shrink-0 px-1.5 py-0 text-[11px] [&>svg]:h-3 [&>svg]:w-3"
                    aria-label="Card tile style"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v2">Detail</SelectItem>
                    <SelectItem value="shop">Shop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <>
              <label
                htmlFor="freeze-columns-select"
                className="shrink-0 text-[11px] text-muted-foreground"
              >
                Freeze · {DEVICE_LABEL[editingDevice]}
              </label>
              {editingDevice === "mobile" ? (
                <span className="text-[11px] font-medium text-foreground">Auto ({autoFrozenLabel})</span>
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
                    className="h-6 w-14 shrink-0 px-1.5 py-0 text-[11px] [&>svg]:h-3 [&>svg]:w-3"
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
        <div className="max-h-64 space-y-px overflow-y-auto px-1 pb-1">
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
                  "flex items-center gap-1 rounded-sm px-0.5 py-0.5 transition-colors hover:bg-accent/50",
                  isDragOver && "bg-accent/60 ring-1 ring-primary/30"
                )}
              >
                <button
                  type="button"
                  draggable
                  className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
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
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                <Switch
                  checked={visible}
                  onCheckedChange={(checked) => toggleVisible(columnId, checked)}
                  aria-label={`Toggle ${column.label}`}
                  className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3 [&>span]:shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs leading-tight">{column.label}</span>
                </div>
                {visible && columnSupportsWrapControl(column.valueKind) ? (
                  <Select
                    value={effectiveWrapMode(columnId)}
                    disabled={disabled}
                    onValueChange={(value) => setWrapMode(columnId, value as TextWrapMode)}
                  >
                    <SelectTrigger
                      className="h-6 w-[4.5rem] shrink-0 px-1.5 py-0 text-[11px] [&>span]:truncate [&>svg]:h-3 [&>svg]:w-3"
                      aria-label={`Text wrap for ${column.label}`}
                      title="Text wrap"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {TEXT_WRAP_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode} className="text-xs py-1">
                          {TEXT_WRAP_MODE_LABELS[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
