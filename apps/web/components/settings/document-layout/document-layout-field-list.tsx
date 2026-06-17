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
}: RowProps<TId>) {
  const dragIdRef = useRef<TId | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    draggable = true,
    disabled = false,
    disabledReason,
    pinned = false,
    showDecimalPlaces = false,
    showAlign = false,
    showTypography = true,
    lockLineSlot,
    showHeaderPlacement = false,
    lockHeaderSlot,
  } = meta;

  const rowDisabled = disabled || !!meta.disabled;
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
      <td className="w-10 py-1 pl-1 pr-3 align-middle">
        {compactToolbar ? null : (
          <Switch
            size="xs"
            checked={column.defaultVisible}
            disabled={rowDisabled || pinned}
            onCheckedChange={(checked) => onPatch({ defaultVisible: checked })}
            aria-label={`Show ${column.label}`}
          />
        )}
      </td>
      <td className="min-w-[10rem] py-1 pl-1 pr-2 align-middle">
        <Input
          value={column.label}
          disabled={rowDisabled}
          onChange={(event) => onPatch({ label: event.target.value })}
          className={cn(
            "h-7 w-full min-w-[8rem] border-transparent bg-transparent px-1.5 text-xs shadow-none focus-visible:border-border focus-visible:bg-background",
            column.typography?.fontWeight === "semibold" && "font-semibold",
            column.typography?.fontWeight === "bold" && "font-bold",
            column.typography?.fontStyle === "italic" && "italic"
          )}
        />
      </td>
      {showHeaderPlacementColumns ? (
        <td className="min-w-[5.5rem] px-1 py-1 align-middle">
          {showHeaderPlacement ? (
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
          ) : (
            <span className="block px-1 text-[10px] text-muted-foreground/50">Peek</span>
          )}
        </td>
      ) : null}
      {showPresentationColumns ? (
        <>
          <td className="min-w-[5.5rem] px-1 py-1 align-middle">
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
          </td>
          <td className="min-w-[3.5rem] px-1 py-1 align-middle">
            <Select
              value={column.showLabel === false ? "off" : "on"}
              disabled={rowDisabled || !isItemDetail}
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
          </td>
          <td className="min-w-[5.5rem] px-1 py-1 align-middle">
            <Select
              value={column.itemDetailFlow ?? "new_line"}
              disabled={rowDisabled || !isItemDetail}
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
          </td>
        </>
      ) : null}
      {showAlignColumn && !compactToolbar ? (
        <td className="min-w-[5rem] px-1 py-1 align-middle">
          {showAlign ? (
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
          {showDecimalPlaces ? (
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
        showTypography ? (
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
        <td className="min-w-[11rem] px-1 py-1 align-middle">
          <DocumentLayoutFieldFormatToolbar
            column={column}
            disabled={rowDisabled || pinned}
            showAlign={showAlign}
            showDecimalPlaces={showDecimalPlaces}
            showTypography={showTypography}
            onPatch={onPatch}
          />
        </td>
      ) : null}
      <td className="w-10 px-1 py-1 align-middle text-[10px] text-muted-foreground">
        {pinned ? "Pin" : null}
      </td>
    </tr>
  );
}

type ListProps<TId extends string> = {
  order: readonly TId[];
  getColumn: (id: TId) => DocumentColumnPref | undefined;
  getMeta?: (id: TId, column: DocumentColumnPref) => DocumentLayoutFieldRowMeta;
  onPatch: (id: TId, patch: Partial<DocumentColumnPref>) => void;
  onMove: (fromId: TId, toId: TId) => void;
  showAlignColumn?: boolean;
  showDecimalsColumn?: boolean;
  showPresentationColumns?: boolean;
  showHeaderPlacementColumns?: boolean;
  showTypographyColumns?: boolean;
  compactToolbar?: boolean;
};

export function DocumentLayoutFieldList<TId extends string>({
  order,
  getColumn,
  getMeta,
  onPatch,
  onMove,
  showAlignColumn = false,
  showDecimalsColumn = false,
  showPresentationColumns = false,
  showHeaderPlacementColumns = false,
  showTypographyColumns = false,
  compactToolbar = false,
}: ListProps<TId>) {
  const isWideTable =
    !compactToolbar &&
    (showPresentationColumns ||
      showHeaderPlacementColumns ||
      showAlignColumn ||
      showDecimalsColumn ||
      showTypographyColumns);

  return (
    <div className="table-chrome-frame overflow-x-auto rounded-md border border-border">
      <table
        data-header-tone="subtle"
        className={cn(
          "table-chrome w-full border-separate border-spacing-0 text-xs",
          isWideTable ? "min-w-[56rem] table-auto" : compactToolbar ? "min-w-[24rem] table-auto" : "min-w-[20rem] table-fixed"
        )}
      >
        <thead>
          <tr className="border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="w-7 px-1 py-1.5" aria-label="Reorder" />
            {!compactToolbar ? <th className="w-11 py-1.5 pl-1 pr-3 text-left">Show</th> : null}
            <th className={cn("py-1.5 pl-1 pr-2 text-left", isWideTable ? "min-w-[10rem]" : "min-w-[8rem]")}>
              Label
            </th>
            {showHeaderPlacementColumns ? (
              <th className="min-w-[5.5rem] px-1 py-1.5 text-left">Place</th>
            ) : null}
            {showPresentationColumns ? (
              <>
                <th className="min-w-[5.5rem] px-1 py-1.5 text-left">Place</th>
                <th className="min-w-[3.5rem] px-1 py-1.5 text-left">Lbl</th>
                <th className="min-w-[5.5rem] px-1 py-1.5 text-left">Flow</th>
              </>
            ) : null}
            {showAlignColumn ? <th className="min-w-[5rem] px-1 py-1.5 text-left">Align</th> : null}
            {showDecimalsColumn ? <th className="min-w-[3.5rem] px-1 py-1.5 text-left">Dec</th> : null}
            {showTypographyColumns ? (
              <>
                <th className="min-w-[4rem] px-1 py-1.5 text-left">Size</th>
                <th className="min-w-[4.25rem] px-1 py-1.5 text-left">Wt</th>
                <th className="min-w-[3.5rem] px-1 py-1.5 text-left">Ital</th>
              </>
            ) : null}
            {compactToolbar ? <th className="min-w-[11rem] px-1 py-1.5 text-right">Format</th> : null}
            <th className="w-10 px-1 py-1.5" />
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
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
