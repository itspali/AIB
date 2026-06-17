"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  SlidersHorizontal,
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
import type { DocumentColumnPref } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

type Props = {
  column: DocumentColumnPref;
  disabled?: boolean;
  showAlign?: boolean;
  showDecimalPlaces?: boolean;
  showTypography?: boolean;
  onPatch: (patch: Partial<DocumentColumnPref>) => void;
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
  showAlign = false,
  showDecimalPlaces = false,
  showTypography = true,
  onPatch,
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

  return (
    <div className="flex items-center justify-end gap-0.5">
      {showAlign ? (
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

      {hasFormatOptions ? (
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
    </div>
  );
}
