"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  LayoutTemplate,
  SlidersHorizontal,
  Tag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type Props = {
  column: DocumentColumnPref;
  disabled?: boolean;
  formatDisabled?: boolean;
  pinned?: boolean;
  showAlign?: boolean;
  showDecimalPlaces?: boolean;
  showTypography?: boolean;
  showHeaderPlacement?: boolean;
  showPresentation?: boolean;
  showRemove?: boolean;
  lockLineSlot?: DocumentLineSlot;
  lockHeaderSlot?: DocumentHeaderSlot;
  onPatch: (patch: Partial<DocumentColumnPref>) => void;
  onRemove?: () => void;
};

function iconButtonClass(active?: boolean) {
  return cn(
    "h-7 w-7 shrink-0 p-0",
    active && "bg-primary/10 text-primary hover:bg-primary/15"
  );
}

function AlignIcon({ align }: { align: NonNullable<DocumentColumnPref["align"]> }) {
  if (align === "center") return <AlignCenter className="h-3.5 w-3.5" aria-hidden />;
  if (align === "right") return <AlignRight className="h-3.5 w-3.5" aria-hidden />;
  return <AlignLeft className="h-3.5 w-3.5" aria-hidden />;
}

export function DocumentLayoutFieldFormatToolbar({
  column,
  disabled = false,
  formatDisabled = false,
  pinned = false,
  showAlign = false,
  showDecimalPlaces = false,
  showTypography = true,
  showHeaderPlacement = false,
  showPresentation = false,
  showRemove = false,
  lockLineSlot,
  lockHeaderSlot,
  onPatch,
  onRemove,
}: Props) {
  const patchTypography = (key: "fontSize" | "fontWeight" | "fontStyle", value: string) => {
    onPatch({ typography: patchDocumentTypography(column.typography, key, value) });
  };

  const align = column.align ?? "left";
  const fontWeight = typographySelectValue(column.typography?.fontWeight);
  const fontStyle = typographySelectValue(column.typography?.fontStyle);
  const isBold = fontWeight === "bold" || fontWeight === "semibold";
  const isItalic = fontStyle === "italic";
  const hasFormatOptions = showTypography || showDecimalPlaces;
  const showFormatControls = !formatDisabled;

  const lineSlot = lockLineSlot ?? column.lineSlot ?? "column";
  const isItemDetail = lineSlot === "item_detail";
  const headerSlot = lockHeaderSlot ?? column.headerSlot ?? "primary";
  const showPlacementControls = showHeaderPlacement || showPresentation;
  const placementActive =
    (showHeaderPlacement && headerSlot === "details") ||
    (showPresentation && (lineSlot === "item_detail" || column.showLabel === false));

  if (!showFormatControls && !(showRemove && onRemove)) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      {showFormatControls && showPlacementControls ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={iconButtonClass(placementActive)}
              disabled={disabled}
              aria-label={`Placement for ${column.label}`}
            >
              <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {showHeaderPlacement ? (
              <>
                <DropdownMenuLabel className="text-xs">Header placement</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={headerSlot}
                  onValueChange={(value) =>
                    onPatch({ headerSlot: value as DocumentHeaderSlot })
                  }
                >
                  <DropdownMenuRadioItem
                    value="primary"
                    disabled={disabled || lockHeaderSlot != null}
                  >
                    Header
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="details"
                    disabled={disabled || lockHeaderSlot != null}
                  >
                    Details
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </>
            ) : null}
            {showHeaderPlacement && showPresentation ? <DropdownMenuSeparator /> : null}
            {showPresentation ? (
              <>
                <DropdownMenuLabel className="text-xs">Line placement</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={lineSlot}
                  onValueChange={(value) =>
                    onPatch({
                      lineSlot: value as DocumentLineSlot,
                      ...(value === "column"
                        ? { itemDetailFlow: undefined }
                        : { itemDetailFlow: "new_line" }),
                    })
                  }
                >
                  <DropdownMenuRadioItem value="column" disabled={disabled || pinned || lockLineSlot != null}>
                    Column
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="item_detail" disabled={disabled || pinned || lockLineSlot != null}>
                    Detail
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {isItemDetail ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Detail flow</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={column.itemDetailFlow ?? "new_line"}
                      onValueChange={(value) =>
                        onPatch({ itemDetailFlow: value as DocumentItemDetailFlow })
                      }
                    >
                      <DropdownMenuRadioItem value="new_line" disabled={disabled}>
                        New line
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="inline_previous" disabled={disabled}>
                        Inline
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </>
                ) : null}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {showFormatControls && showPresentation && isItemDetail ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={iconButtonClass(column.showLabel === false)}
              disabled={disabled}
              aria-label={`Detail label for ${column.label}`}
            >
              <Tag className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel className="text-xs">Detail label</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={column.showLabel === false ? "off" : "on"}
              onValueChange={(value) => onPatch({ showLabel: value === "on" })}
            >
              <DropdownMenuRadioItem value="on" disabled={disabled}>
                Show label
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="off" disabled={disabled}>
                Hide label
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {showFormatControls && showAlign ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={iconButtonClass(align !== "left")}
              disabled={disabled}
              aria-label={`Align ${column.label}`}
            >
              <AlignIcon align={align} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel className="text-xs">Alignment</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={align}
              onValueChange={(value) => onPatch({ align: value as DocumentColumnPref["align"] })}
            >
              <DropdownMenuRadioItem value="left">Left</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="center">Center</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {showFormatControls && hasFormatOptions ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={iconButtonClass(isBold || isItalic)}
              disabled={disabled}
              aria-label={`Format ${column.label}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {showTypography ? (
              <>
                <DropdownMenuLabel className="text-xs">Style</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={isBold}
                  onCheckedChange={(checked) =>
                    patchTypography("fontWeight", checked ? "bold" : DOCUMENT_TYPOGRAPHY_DEFAULT)
                  }
                >
                  Bold
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={isItalic}
                  onCheckedChange={(checked) =>
                    patchTypography("fontStyle", checked ? "italic" : DOCUMENT_TYPOGRAPHY_DEFAULT)
                  }
                >
                  Italic
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Font size</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={typographySelectValue(column.typography?.fontSize)}
                  onValueChange={(value) => patchTypography("fontSize", value)}
                >
                  <DropdownMenuRadioItem value={DOCUMENT_TYPOGRAPHY_DEFAULT}>Default</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="xs">Extra small</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="sm">Small</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="base">Base</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="lg">Large</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </>
            ) : null}
            {showTypography && showDecimalPlaces ? <DropdownMenuSeparator /> : null}
            {showDecimalPlaces ? (
              <>
                <DropdownMenuLabel className="text-xs">Decimal places</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={String(column.decimalPlaces ?? 2)}
                  onValueChange={(value) => onPatch({ decimalPlaces: Number.parseInt(value, 10) })}
                >
                  {[0, 1, 2, 3, 4].map((digits) => (
                    <DropdownMenuRadioItem key={digits} value={String(digits)}>
                      {digits}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {showRemove && onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          disabled={disabled}
          aria-label={`Remove ${column.label}`}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
