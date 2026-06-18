"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { DocumentLayoutFieldFormatToolbar } from "@/components/settings/document-layout/document-layout-field-format-toolbar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DOCUMENT_TYPOGRAPHY_DEFAULT,
  patchDocumentTypography,
  typographySelectValue,
} from "@/lib/documents/document-typography-classes";
import type {
  DocumentColumnPref,
  DocumentHeaderSlot,
  DocumentItemDetailFlow,
  DocumentLineSlot,
} from "@/lib/documents/types";
import { cn } from "@/lib/utils";

export type DocumentLayoutFieldRowMeta = {
  draggable?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  pinned?: boolean;
  removable?: boolean;
  showDecimalPlaces?: boolean;
  showAlign?: boolean;
  showTypography?: boolean;
  lockLineSlot?: DocumentLineSlot;
  showHeaderPlacement?: boolean;
  lockHeaderSlot?: DocumentHeaderSlot;
};

type RowProps<TId extends string> = {
  columnId: TId;
  column: DocumentColumnPref;
  meta?: DocumentLayoutFieldRowMeta;
  showAlignColumn: boolean;
  showDecimalsColumn: boolean;
  showPresentationColumns: boolean;
  showHeaderPlacementColumns: boolean;
  showTypographyColumns: boolean;
  compactToolbar?: boolean;
  onPatch: (patch: Partial<DocumentColumnPref>) => void;
  onMove: (fromId: TId, toId: TId) => void;
  onRemove?: (id: TId) => void;
};

function TypographySelectCells({
  column,
  disabled,
  onPatch,
}: {
  column: DocumentColumnPref;
  disabled: boolean;
  onPatch: (patch: Partial<DocumentColumnPref>) => void;
}) {
  const patchTypography = (key: "fontSize" | "fontWeight" | "fontStyle", value: string) => {
    onPatch({ typography: patchDocumentTypography(column.typography, key, value) });
  };

  return (
    <>
      <td className="min-w-[4rem] px-1 py-1 align-middle">
        <Select
          value={typographySelectValue(column.typography?.fontSize)}
          disabled={disabled}
          onValueChange={(value) => patchTypography("fontSize", value)}
        >
          <SelectTrigger className="h-7 w-full min-w-[3.5rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DOCUMENT_TYPOGRAPHY_DEFAULT}>Def</SelectItem>
            <SelectItem value="xs">XS</SelectItem>
            <SelectItem value="sm">SM</SelectItem>
            <SelectItem value="base">Base</SelectItem>
            <SelectItem value="lg">LG</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="min-w-[4.25rem] px-1 py-1 align-middle">
        <Select
          value={typographySelectValue(column.typography?.fontWeight)}
          disabled={disabled}
          onValueChange={(value) => patchTypography("fontWeight", value)}
        >
          <SelectTrigger className="h-7 w-full min-w-[3.75rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DOCUMENT_TYPOGRAPHY_DEFAULT}>Def</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="semibold">Semi</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="min-w-[3.5rem] px-1 py-1 align-middle">
        <Select
          value={typographySelectValue(column.typography?.fontStyle)}
          disabled={disabled}
          onValueChange={(value) => patchTypography("fontStyle", value)}
        >
          <SelectTrigger className="h-7 w-full min-w-[3rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DOCUMENT_TYPOGRAPHY_DEFAULT}>Def</SelectItem>
            <SelectItem value="normal">Upright</SelectItem>
            <SelectItem value="italic">Italic</SelectItem>
          </SelectContent>
        </Select>
      </td>
    </>
  );
}

function DocumentLayoutFieldRow<TId extends string>({
  columnId,
  column,
  meta = {},
  showAlignColumn,
  showDecimalsColumn,
  showPresentationColumns,
  showHeaderPlacementColumns,
  showTypographyColumns,
  compactToolbar = false,
  onPatch,
  onMove,
  onRemove,
}: RowProps<TId>) {
  const dragIdRef = useRef<TId | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    draggable = true,
    disabled = false,
    disabledReason,
    pinned = false,
    removable = false,
    showDecimalPlaces = false,
    showAlign = false,
    showTypography = true,
    lockLineSlot,
    showHeaderPlacement = false,
    lockHeaderSlot,
  } = meta;

  const rowDisabled = disabled || !!meta.disabled;
  const fieldEnabled = column.defaultVisible !== false;
  const canDrag = draggable && !pinned && !rowDisabled;
  const lineSlot = lockLineSlot ?? column.lineSlot ?? "column";
  const isItemDetail = lineSlot === "item_detail";
  const headerSlot = lockHeaderSlot ?? column.headerSlot ?? "primary";

  return (
    <tr
      onDragOver={(event) => {
        if (!canDrag) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        if (!canDrag) return;
        event.preventDefault();
        const fromId = dragIdRef.current ?? (event.dataTransfer.getData("text/plain") as TId);
        if (fromId) onMove(fromId, columnId);
        dragIdRef.current = null;
        setDragOver(false);
      }}
      className={cn(
        "border-b border-border last:border-0",
        dragOver && canDrag && "bg-accent/50",
        rowDisabled && "opacity-55"
      )}
      title={disabledReason}
    >
      <td className="w-7 px-1 py-1 align-middle">
        <button
          type="button"
          draggable={canDrag}
          disabled={!canDrag}
          aria-label={pinned ? `${column.label} pinned` : `Drag ${column.label} to reorder`}
          className={cn(
            "rounded p-0.5 text-muted-foreground",
            canDrag ? "cursor-grab hover:bg-muted/60 active:cursor-grabbing" : "cursor-not-allowed opacity-40"
          )}
          onDragStart={(event) => {
            if (!canDrag) return;
            dragIdRef.current = columnId;
            event.dataTransfer.setData("text/plain", columnId);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            dragIdRef.current = null;
            setDragOver(false);
          }}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      </td>
      <td className="w-9 py-1 pl-1 pr-2 align-middle">
        <Switch
          size="xs"
          checked={column.defaultVisible}
          disabled={rowDisabled || pinned}
          onCheckedChange={(checked) => onPatch({ defaultVisible: checked })}
          aria-label={`Show ${column.label}`}
        />
      </td>
      <td className={cn("py-1 pl-1 pr-2 align-middle", compactToolbar ? "w-auto" : "min-w-[10rem]")}>
        <Input
          value={column.label}
          disabled={rowDisabled}
          onChange={(event) => onPatch({ label: event.target.value })}
          className={cn(
            "h-7 w-full border-transparent bg-transparent px-1.5 text-xs shadow-none focus-visible:border-border focus-visible:bg-background",
            !compactToolbar && "min-w-[8rem]",
            column.typography?.fontWeight === "semibold" && "font-semibold",
            column.typography?.fontWeight === "bold" && "font-bold",
            column.typography?.fontStyle === "italic" && "italic"
          )}
        />
      </td>
      {showHeaderPlacementColumns && !compactToolbar ? (
        <td className="min-w-[5.5rem] px-1 py-1 align-middle">
          {showHeaderPlacement && fieldEnabled ? (
            <Select
              value={headerSlot}
              disabled={rowDisabled || lockHeaderSlot != null}
              onValueChange={(value) =>
                onPatch({ headerSlot: value as DocumentHeaderSlot })
              }
            >
              <SelectTrigger className="h-7 w-full min-w-[5rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Header</SelectItem>
                <SelectItem value="details">Details</SelectItem>
              </SelectContent>
            </Select>
          ) : showHeaderPlacement ? (
            <span className="block px-1 text-[10px] text-muted-foreground/50">—</span>
          ) : (
            <span className="block px-1 text-[10px] text-muted-foreground/50">Peek</span>
          )}
        </td>
      ) : null}
      {showPresentationColumns && !compactToolbar ? (
        <>
          <td className="min-w-[5.5rem] px-1 py-1 align-middle">
            {fieldEnabled ? (
            <Select
              value={lineSlot}
              disabled={rowDisabled || pinned || lockLineSlot != null}
              onValueChange={(value) =>
                onPatch({
                  lineSlot: value as DocumentLineSlot,
                  ...(value === "column" ? { itemDetailFlow: undefined } : { itemDetailFlow: "new_line" }),
                })
              }
            >
              <SelectTrigger className="h-7 w-full min-w-[5rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="column">Column</SelectItem>
                <SelectItem value="item_detail">Detail</SelectItem>
              </SelectContent>
            </Select>
            ) : (
              <span className="block px-1 text-[10px] text-muted-foreground/50">—</span>
            )}
          </td>
          <td className="min-w-[3.5rem] px-1 py-1 align-middle">
            {fieldEnabled && isItemDetail ? (
            <Select
              value={column.showLabel === false ? "off" : "on"}
              disabled={rowDisabled}
              onValueChange={(value) => onPatch({ showLabel: value === "on" })}
            >
              <SelectTrigger className="h-7 w-full min-w-[3rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
            ) : (
              <span className="block px-1 text-[10px] text-muted-foreground/50">—</span>
            )}
          </td>
          <td className="min-w-[5.5rem] px-1 py-1 align-middle">
            {fieldEnabled && isItemDetail ? (
            <Select
              value={column.itemDetailFlow ?? "new_line"}
              disabled={rowDisabled}
              onValueChange={(value) =>
                onPatch({ itemDetailFlow: value as DocumentItemDetailFlow })
              }
            >
              <SelectTrigger className="h-7 w-full min-w-[5rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_line">New line</SelectItem>
                <SelectItem value="inline_previous">Inline</SelectItem>
              </SelectContent>
            </Select>
            ) : (
              <span className="block px-1 text-[10px] text-muted-foreground/50">—</span>
            )}
          </td>
        </>
      ) : null}
      {showAlignColumn && !compactToolbar ? (
        <td className="min-w-[5rem] px-1 py-1 align-middle">
          {showAlign && fieldEnabled ? (
            <Select
              value={column.align ?? "left"}
              disabled={rowDisabled}
              onValueChange={(value) => onPatch({ align: value as DocumentColumnPref["align"] })}
            >
              <SelectTrigger className="h-7 w-full min-w-[4.5rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Ctr</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="block px-1 text-[10px] text-muted-foreground/50">—</span>
          )}
        </td>
      ) : null}
      {showDecimalsColumn && !compactToolbar ? (
        <td className="min-w-[3.5rem] px-1 py-1 align-middle">
          {showDecimalPlaces && fieldEnabled ? (
            <Select
              value={String(column.decimalPlaces ?? 2)}
              disabled={rowDisabled}
              onValueChange={(value) => onPatch({ decimalPlaces: Number.parseInt(value, 10) })}
            >
              <SelectTrigger className="h-7 w-full min-w-[2.75rem] border-transparent bg-transparent px-1.5 text-[11px] shadow-none focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4].map((digits) => (
                  <SelectItem key={digits} value={String(digits)}>
                    {digits}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="block px-1 text-[10px] text-muted-foreground/50">—</span>
          )}
        </td>
      ) : null}
      {showTypographyColumns && !compactToolbar ? (
        showTypography && fieldEnabled ? (
          <TypographySelectCells column={column} disabled={rowDisabled} onPatch={onPatch} />
        ) : (
          <>
            <td className="px-1 py-1 text-[10px] text-muted-foreground/50">—</td>
            <td className="px-1 py-1 text-[10px] text-muted-foreground/50">—</td>
            <td className="px-1 py-1 text-[10px] text-muted-foreground/50">—</td>
          </>
        )
      ) : null}
      {compactToolbar ? (
        <td className="w-[7rem] px-1 py-1 align-middle">
          {fieldEnabled || (removable && onRemove) ? (
            <DocumentLayoutFieldFormatToolbar
              column={column}
              disabled={rowDisabled}
              formatDisabled={!fieldEnabled}
              pinned={pinned}
              showAlign={showAlign}
              showDecimalPlaces={showDecimalPlaces}
              showTypography={showTypography}
              showHeaderPlacement={showHeaderPlacementColumns && showHeaderPlacement}
              showPresentation={showPresentationColumns}
              showRemove={removable && !pinned}
              lockLineSlot={lockLineSlot}
              lockHeaderSlot={lockHeaderSlot}
              onPatch={onPatch}
              onRemove={removable && !pinned && onRemove ? () => onRemove(columnId) : undefined}
            />
          ) : null}
        </td>
      ) : null}
      {compactToolbar ? null : (
      <td className="w-10 px-1 py-1 align-middle text-[10px] text-muted-foreground">
        {pinned ? "Pin" : null}
      </td>
      )}
    </tr>
  );
}

type ListProps<TId extends string> = {
  order: readonly TId[];
  getColumn: (id: TId) => DocumentColumnPref | undefined;
  getMeta?: (id: TId, column: DocumentColumnPref) => DocumentLayoutFieldRowMeta;
  onPatch: (id: TId, patch: Partial<DocumentColumnPref>) => void;
  onMove: (fromId: TId, toId: TId) => void;
  onRemove?: (id: TId) => void;
  showAlignColumn?: boolean;
  showDecimalsColumn?: boolean;
  showPresentationColumns?: boolean;
  showHeaderPlacementColumns?: boolean;
  showTypographyColumns?: boolean;
  compactToolbar?: boolean;
  flush?: boolean;
};

export function DocumentLayoutFieldList<TId extends string>({
  order,
  getColumn,
  getMeta,
  onPatch,
  onMove,
  onRemove,
  showAlignColumn = false,
  showDecimalsColumn = false,
  showPresentationColumns = false,
  showHeaderPlacementColumns = false,
  showTypographyColumns = false,
  compactToolbar = false,
  flush = false,
}: ListProps<TId>) {
  const hasStructuralColumns =
    !compactToolbar && (showPresentationColumns || showHeaderPlacementColumns);
  const isWideTable =
    !flush &&
    (hasStructuralColumns ||
      (!compactToolbar && (showAlignColumn || showDecimalsColumn || showTypographyColumns)));

  return (
    <div
      className={cn(
        "min-w-0 overflow-x-auto",
        flush ? "w-full bg-white dark:bg-card" : "table-chrome-frame rounded-md border border-border"
      )}
    >
      <table
        data-header-tone="subtle"
        className={cn(
          "table-chrome w-full border-separate border-spacing-0 text-xs",
          flush || compactToolbar ? "table-fixed" : isWideTable ? "table-auto" : "table-fixed",
          flush &&
            "bg-white dark:bg-card [&_tbody_td]:bg-white dark:[&_tbody_td]:bg-card [&_thead_tr:first-child_th]:bg-white dark:[&_thead_tr:first-child_th]:bg-card [&_thead_tr:first-child_th:first-child]:rounded-none [&_thead_tr:first-child_th:last-child]:rounded-none",
          !flush && isWideTable && (compactToolbar ? "min-w-[34rem]" : "min-w-[56rem]"),
          !flush && !isWideTable && !compactToolbar && "min-w-[20rem]"
        )}
      >
        {flush && compactToolbar ? (
          <colgroup>
            <col className="w-7" />
            <col className="w-9" />
            <col />
            <col className="w-[7rem]" />
          </colgroup>
        ) : null}
        <thead>
          <tr className="border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="w-7 px-1 py-1.5" aria-label="Reorder" />
            <th className="w-9 py-1.5 pl-1 pr-2 text-left">{compactToolbar ? "On" : "Show"}</th>
            <th
              className={cn(
                "py-1.5 pl-1 pr-2 text-left",
                compactToolbar ? "w-auto" : isWideTable ? "min-w-[10rem]" : "min-w-[8rem]"
              )}
            >
              Label
            </th>
            {showHeaderPlacementColumns && !compactToolbar ? (
              <th className="min-w-[5.5rem] px-1 py-1.5 text-left">Place</th>
            ) : null}
            {showPresentationColumns && !compactToolbar ? (
              <>
                <th className="min-w-[5.5rem] px-1 py-1.5 text-left">Place</th>
                <th className="min-w-[3.5rem] px-1 py-1.5 text-left">Lbl</th>
                <th className="min-w-[5.5rem] px-1 py-1.5 text-left">Flow</th>
              </>
            ) : null}
            {showAlignColumn && !compactToolbar ? (
              <th className="min-w-[5rem] px-1 py-1.5 text-left">Align</th>
            ) : null}
            {showDecimalsColumn && !compactToolbar ? (
              <th className="min-w-[3.5rem] px-1 py-1.5 text-left">Dec</th>
            ) : null}
            {showTypographyColumns && !compactToolbar ? (
              <>
                <th className="min-w-[4rem] px-1 py-1.5 text-left">Size</th>
                <th className="min-w-[4.25rem] px-1 py-1.5 text-left">Wt</th>
                <th className="min-w-[3.5rem] px-1 py-1.5 text-left">Ital</th>
              </>
            ) : null}
            {compactToolbar ? (
              <th className="w-[7rem] px-1 py-1.5 text-right">Tools</th>
            ) : null}
            {!compactToolbar ? <th className="w-10 px-1 py-1.5" /> : null}
          </tr>
        </thead>
        <tbody>
          {order.map((columnId) => {
            const column = getColumn(columnId);
            if (!column) return null;
            return (
              <DocumentLayoutFieldRow
                key={columnId}
                columnId={columnId}
                column={column}
                meta={getMeta?.(columnId, column)}
                showAlignColumn={showAlignColumn}
                showDecimalsColumn={showDecimalsColumn}
                showPresentationColumns={showPresentationColumns}
                showHeaderPlacementColumns={showHeaderPlacementColumns}
                showTypographyColumns={showTypographyColumns}
                compactToolbar={compactToolbar}
                onPatch={(patch) => onPatch(columnId, patch)}
                onMove={onMove}
                onRemove={onRemove}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
