"use client";

import { useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import {
  Columns3,
  GripVertical,
  LayoutGrid,
  Monitor,
  RectangleHorizontal,
  RectangleVertical,
  Rows3,
  Smartphone,
  Tablet,
  Table2,
  Type,
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
import { ColumnChipColorEditor } from "@/components/list-columns/column-chip-color-editor";
import type {
  ColumnChipDisplay,
  ListColumnPrefs,
  ListColumnRegistry,
} from "@/lib/list-columns/types";
import {
  ensureColumnInOrder,
  resolveSelectorColumnOrder,
} from "@/lib/list-columns/prefs";
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
  type ProductCardMetaDisplay,
  type ProductCardOrientation,
} from "@/lib/products/list-prefs";
import {
  listToolbarViewToggleSegmentClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

export type ColumnSettingsLayout = "table" | "compact" | "card";
export type ColumnSettingsDevice = "mobile" | "tablet" | "desktop";

export type ColumnSettingsLayoutPreset = {
  id: string;
  label: string;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type Props<TId extends string> = {
  registry: ListColumnRegistry<TId>;
  prefs: ListColumnPrefs<TId>;
  onChange: (prefs: ListColumnPrefs<TId>) => void;
  /** Columns the user may view and configure (excludes fields without view access). */
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
  cardOrientation?: ProductCardOrientation;
  onCardOrientationChange?: (orientation: ProductCardOrientation) => void;
  cardMetaDisplay?: ProductCardMetaDisplay;
  onCardMetaDisplayChange?: (display: ProductCardMetaDisplay) => void;
  isColumnApplicable?: (columnId: TId) => boolean;
  columnDisabledReason?: (columnId: TId) => string | undefined;
  disabled?: boolean;
  isSaving?: boolean;
  triggerClassName?: string;
  triggerVariant?: "outline" | "ghost";
  /** Hide table/compact/card layout toggles (operational list modules). */
  showLayoutSwitcher?: boolean;
  /** Hide mobile/tablet/desktop device toggles when prefs are not device-scoped. */
  showDeviceSwitcher?: boolean;
  /** Replaces the default table/compact/card switcher (e.g. Items list presets). */
  layoutPresets?: ColumnSettingsLayoutPreset[];
  editingLayoutPreset?: string;
  onEditingLayoutPresetChange?: (presetId: string) => void;
  /** Hides card style, orientation, and metadata controls inside the panel. */
  hideCardVariantControls?: boolean;
  /** Devices left, views (+ card/freeze count) right on one row. */
  controlBarLayout?: "default" | "split";
};

const DEVICE_LABEL: Record<ColumnSettingsDevice, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

function segmentIconButtonClass(selected: boolean, className?: string) {
  return cn(listToolbarViewToggleSegmentClass(selected), className);
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
  cardOrientation = "vertical",
  onCardOrientationChange,
  cardMetaDisplay = "labels",
  onCardMetaDisplayChange,
  isColumnApplicable,
  columnDisabledReason,
  disabled = false,
  isSaving = false,
  triggerClassName,
  triggerVariant = "outline",
  showLayoutSwitcher = true,
  showDeviceSwitcher = true,
  layoutPresets,
  editingLayoutPreset,
  onEditingLayoutPresetChange,
  hideCardVariantControls = false,
  controlBarLayout = "default",
}: Props<TId>) {
  const dragIdRef = useRef<TId | null>(null);
  const [dragOverId, setDragOverId] = useState<TId | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedChipColumnId, setExpandedChipColumnId] = useState<TId | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      dragIdRef.current = null;
      setDragOverId(null);
    }
  };

  const editableColumnOrder = useMemo(
    () => resolveSelectorColumnOrder(allowedColumnIds, prefs.columnOrder),
    [allowedColumnIds, prefs.columnOrder]
  );

  const columnDisplayGroups = useMemo(() => {
    if (!isColumnApplicable) {
      return { applicable: editableColumnOrder, notApplicable: [] as TId[] };
    }

    const applicable: TId[] = [];
    const notApplicable: TId[] = [];
    for (const columnId of editableColumnOrder) {
      if (isColumnApplicable(columnId)) applicable.push(columnId);
      else notApplicable.push(columnId);
    }
    return { applicable, notApplicable };
  }, [editableColumnOrder, isColumnApplicable]);

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

    let columnOrder = ensureColumnInOrder(
      ensureColumnInOrder(prefs.columnOrder, fromId),
      toId
    );
    const fromIndex = columnOrder.indexOf(fromId);
    const toIndex = columnOrder.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0) return;

    columnOrder = [...columnOrder];
    columnOrder.splice(fromIndex, 1);
    columnOrder.splice(toIndex, 0, fromId);
    onChange({ ...prefs, columnOrder });
  };

  const toggleVisible = (columnId: TId, visible: boolean) => {
    const visibleColumns = visible
      ? [...new Set([...prefs.visibleColumns, columnId])]
      : prefs.visibleColumns.filter((id) => id !== columnId);

    if (visibleColumns.length === 0) return;

    const columnOrder = visible
      ? ensureColumnInOrder(prefs.columnOrder, columnId)
      : prefs.columnOrder;

    onChange({ ...prefs, columnOrder, visibleColumns });
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

  const setChipDisplay = (columnId: TId, display: ColumnChipDisplay | undefined) => {
    const next: Partial<Record<TId, ColumnChipDisplay>> = {
      ...(prefs.columnChipDisplay ?? {}),
    };
    if (!display || display.mode === "text") {
      delete next[columnId];
    } else {
      next[columnId] = display;
    }
    onChange({
      ...prefs,
      columnChipDisplay: Object.keys(next).length > 0 ? next : undefined,
    });
  };

  const toggleChipMode = (columnId: TId, enabled: boolean) => {
    if (!enabled) {
      setExpandedChipColumnId((current) => (current === columnId ? null : current));
      setChipDisplay(columnId, undefined);
      return;
    }
    setChipDisplay(columnId, { mode: "chip" });
    setExpandedChipColumnId(columnId);
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

  const activeLayoutPreset = layoutPresets?.find((preset) => preset.id === editingLayoutPreset);
  const layoutLabel = activeLayoutPreset
    ? activeLayoutPreset.label
    : editingLayout === "table"
      ? "Table"
      : editingLayout === "compact"
        ? "Compact"
        : "Card";
  const editingLabel = `${layoutLabel} · ${DEVICE_LABEL[editingDevice]}`;
  const useSplitControlBar = controlBarLayout === "split";

  const layoutSwitcher = showLayoutSwitcher && layoutPresets?.length ? (
    <div
      className="inline-flex shrink-0 gap-px rounded-md border border-border bg-muted p-px"
      role="group"
      aria-label="View"
    >
      {layoutPresets.map((preset) => {
        const Icon = preset.icon;
        const selected = editingLayoutPreset === preset.id;
        return (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="ghost"
            className={segmentIconButtonClass(selected, "w-7")}
            onClick={() => onEditingLayoutPresetChange?.(preset.id)}
            title={preset.title}
            aria-label={preset.title}
            aria-pressed={selected}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </Button>
        );
      })}
    </div>
  ) : showLayoutSwitcher ? (
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
  ) : null;

  const deviceSwitcher = showDeviceSwitcher ? (
    <div
      className={cn(
        "inline-flex gap-px rounded-md border border-border bg-muted p-px",
        useSplitControlBar ? "shrink-0" : "min-w-0 flex-1"
      )}
      role="group"
      aria-label="Screen"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={segmentIconButtonClass(editingDevice === "mobile", useSplitControlBar ? "w-7" : "flex-1")}
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
        className={segmentIconButtonClass(editingDevice === "tablet", useSplitControlBar ? "w-7" : "flex-1")}
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
        className={segmentIconButtonClass(editingDevice === "desktop", useSplitControlBar ? "w-7" : "flex-1")}
        onClick={() => onEditingDeviceChange("desktop")}
        title="Desktop"
        aria-label="Desktop"
        aria-pressed={editingDevice === "desktop"}
      >
        <Monitor className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  ) : null;

  const cardGridControl = onCardGridColumnsChange ? (
    <div className="flex shrink-0 items-center gap-1">
      <label
        htmlFor="card-grid-columns-select"
        className="shrink-0 text-[11px] text-muted-foreground"
      >
        Cards
      </label>
      <Select
        value={cardGridSelectValue}
        onValueChange={(value) => {
          if (value === AUTO_LAYOUT_PREF) {
            onCardGridColumnsChange(AUTO_LAYOUT_PREF);
            return;
          }
          const count = Number(value);
          if (isCardGridColumnCount(count)) {
            onCardGridColumnsChange(count);
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
  ) : null;

  const freezeControl = onFrozenColumnCountChange ? (
    <div className="flex shrink-0 items-center gap-1">
      <label
        htmlFor="freeze-columns-select"
        className="shrink-0 text-[11px] text-muted-foreground"
      >
        Freeze
      </label>
      {editingDevice === "mobile" ? (
        <span className="text-[11px] font-medium text-foreground">Auto ({autoFrozenLabel})</span>
      ) : (
        <Select
          value={freezeSelectValue}
          onValueChange={(value) => {
            if (value === AUTO_LAYOUT_PREF) {
              onFrozenColumnCountChange(AUTO_LAYOUT_PREF);
              return;
            }
            const count = Number(value);
            if (count === 0 || count === 1 || count === 2 || count === 3) {
              onFrozenColumnCountChange(count);
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
    </div>
  ) : null;

  const cardVariantControls =
    showLayoutSwitcher && !hideCardVariantControls && editingLayout === "card" && cardLayout === "v2" ? (
      <>
        <div
          className="inline-flex shrink-0 gap-px rounded-md border border-border bg-muted p-px"
          role="group"
          aria-label="Card orientation"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={segmentIconButtonClass(cardOrientation === "vertical", "w-7")}
            onClick={() => onCardOrientationChange?.("vertical")}
            title="Vertical card"
            aria-label="Vertical card"
            aria-pressed={cardOrientation === "vertical"}
            disabled={disabled}
          >
            <RectangleVertical className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={segmentIconButtonClass(cardOrientation === "horizontal", "w-7")}
            onClick={() => onCardOrientationChange?.("horizontal")}
            title="Horizontal row"
            aria-label="Horizontal row"
            aria-pressed={cardOrientation === "horizontal"}
            disabled={disabled}
          >
            <RectangleHorizontal className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
        <div
          className="inline-flex shrink-0 gap-px rounded-md border border-border bg-muted p-px"
          role="group"
          aria-label="Card metadata display"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={segmentIconButtonClass(cardMetaDisplay === "labels", "w-7")}
            onClick={() => onCardMetaDisplayChange?.("labels")}
            title="Labeled metadata"
            aria-label="Labeled metadata"
            aria-pressed={cardMetaDisplay === "labels"}
            disabled={disabled}
          >
            <Type className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={segmentIconButtonClass(cardMetaDisplay === "icons", "w-7")}
            onClick={() => onCardMetaDisplayChange?.("icons")}
            title="Icon-only metadata"
            aria-label="Icon-only metadata"
            aria-pressed={cardMetaDisplay === "icons"}
            disabled={disabled}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </>
    ) : null;

  const renderColumnRow = (columnId: TId) => {
    const column = getColumnDef(registry, columnId);
    const applicable = isColumnApplicable?.(columnId) ?? true;
    const disabledReason = columnDisabledReason?.(columnId);
    const rowDisabled = disabled || !applicable;
    const visible = prefs.visibleColumns.includes(columnId);
    const isDragOver = dragOverId === columnId;
    const chipEnabled = prefs.columnChipDisplay?.[columnId]?.mode === "chip";

    return (
      <div
        key={columnId}
        onDragOver={(event) => {
          if (!applicable) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOverId(columnId);
        }}
        onDragLeave={() => {
          if (dragOverId === columnId) setDragOverId(null);
        }}
        onDrop={(event) => {
          if (!applicable) return;
          event.preventDefault();
          const fromId =
            dragIdRef.current ?? (event.dataTransfer.getData("text/plain") as TId);
          if (fromId) moveColumn(fromId, columnId);
          dragIdRef.current = null;
          setDragOverId(null);
        }}
        className={cn(
          "rounded-sm px-0.5 py-0.5 transition-colors",
          applicable && "hover:bg-accent/50",
          !applicable && "opacity-45",
          isDragOver && applicable && "bg-accent/60 ring-1 ring-primary/30"
        )}
        title={disabledReason}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            draggable={applicable}
            disabled={!applicable}
            className={cn(
              "flex h-6 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
              applicable &&
                "cursor-grab hover:bg-accent hover:text-foreground active:cursor-grabbing"
            )}
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
            disabled={rowDisabled}
            onCheckedChange={(checked) => toggleVisible(columnId, checked)}
            aria-label={`Toggle ${column.label}`}
            className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3 [&>span]:shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs leading-tight">{column.label}</span>
          </div>
          {visible && applicable && columnSupportsWrapControl(column.valueKind) ? (
            <Select
              value={effectiveWrapMode(columnId)}
              disabled={rowDisabled}
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
          ) : (
            <span className="w-[4.5rem] shrink-0" aria-hidden />
          )}
          {visible && applicable && column.chipEligible ? (
            <label
              className="flex h-6 shrink-0 cursor-pointer items-center gap-1 pr-0.5"
              title="Show as chips"
              onClick={(event) => event.stopPropagation()}
            >
              <Switch
                checked={chipEnabled}
                disabled={rowDisabled}
                onCheckedChange={(checked) => toggleChipMode(columnId, checked)}
                aria-label={`Show ${column.label} as chips`}
                className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3 [&>span]:shadow-sm"
              />
              <span className="text-[10px] text-muted-foreground">Chip</span>
            </label>
          ) : null}
        </div>
        {visible && applicable && column.chipEligible && chipEnabled ? (
          <ColumnChipColorEditor
            column={column}
            display={prefs.columnChipDisplay?.[columnId]}
            disabled={rowDisabled}
            expanded={expandedChipColumnId === columnId}
            onExpandedChange={(next) => setExpandedChipColumnId(next ? columnId : null)}
            onChange={(display) => setChipDisplay(columnId, display)}
          />
        ) : null}
      </div>
    );
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <div className={cn(listToolbarViewToggleShellClass(), "inline-flex shrink-0")}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(listToolbarViewToggleSegmentClass(open), triggerClassName)}
            title="Column settings"
            aria-label="Column settings"
            aria-busy={isSaving}
            disabled={disabled}
          >
            {isSaving ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Columns3 className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent
        align="end"
        className="column-settings-panel z-50 w-[min(26rem,calc(100vw-2rem))] min-w-[22rem] border p-0 text-xs ring-1 ring-border/80 dark:ring-primary/25"
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
          {showDeviceSwitcher && editingDevice === detectedDevice ? " · auto" : null}
        </p>
        {showLayoutSwitcher || showDeviceSwitcher ? (
          useSplitControlBar ? (
            <div className="flex min-w-0 items-center justify-between gap-2 px-2 pb-1.5">
              {deviceSwitcher}
              <div className="flex min-w-0 items-center justify-end gap-1.5">
                {layoutSwitcher}
                {editingLayout === "card" ? cardGridControl : freezeControl}
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-2 pb-1.5">
              {layoutSwitcher}
              {deviceSwitcher}
              {cardVariantControls}
            </div>
          )
        ) : null}
        {!useSplitControlBar ? (
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          {editingLayout === "card" ? (
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
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
              {!hideCardVariantControls ? (
                <div className="flex shrink-0 items-center gap-2">
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
              ) : null}
            </div>
          ) : onFrozenColumnCountChange ? (
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
          ) : null}
        </div>
        ) : null}
        <DropdownMenuSeparator />
        <div className="max-h-80 space-y-px overflow-y-auto px-1 pb-1">
          {columnDisplayGroups.applicable.map(renderColumnRow)}
          {columnDisplayGroups.notApplicable.length > 0 ? (
            <>
              <div className="mx-1 my-1 border-t border-border/70" />
              <p className="px-1.5 pb-0.5 pt-1 text-[10px] font-medium text-muted-foreground">
                Not on this card layout
              </p>
              {columnDisplayGroups.notApplicable.map(renderColumnRow)}
            </>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
