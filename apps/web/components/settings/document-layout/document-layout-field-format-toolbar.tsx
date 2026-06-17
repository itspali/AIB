"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eye,
  EyeOff,
  Italic,
  MoreHorizontal,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
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

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={iconButtonClass(column.defaultVisible)}
        disabled={disabled}
        aria-label={column.defaultVisible ? `Hide ${column.label}` : `Show ${column.label}`}
        onClick={() => onPatch({ defaultVisible: !column.defaultVisible })}
      >
        {column.defaultVisible ? (
          <Eye className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
        )}
      </Button>

      {showAlign ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={iconButtonClass(align === "left")}
            disabled={disabled}
            aria-label={`Align ${column.label} left`}
            onClick={() => onPatch({ align: "left" })}
          >
            <AlignLeft className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={iconButtonClass(align === "center")}
            disabled={disabled}
            aria-label={`Align ${column.label} center`}
            onClick={() => onPatch({ align: "center" })}
          >
            <AlignCenter className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={iconButtonClass(align === "right")}
            disabled={disabled}
            aria-label={`Align ${column.label} right`}
            onClick={() => onPatch({ align: "right" })}
          >
            <AlignRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </>
      ) : null}

      {showTypography ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={iconButtonClass(fontWeight === "bold" || fontWeight === "semibold")}
            disabled={disabled}
            aria-label={`Toggle bold for ${column.label}`}
            onClick={() =>
              patchTypography(
                "fontWeight",
                fontWeight === "bold" ? DOCUMENT_TYPOGRAPHY_DEFAULT : "bold"
              )
            }
          >
            <Bold className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={iconButtonClass(fontStyle === "italic")}
            disabled={disabled}
            aria-label={`Toggle italic for ${column.label}`}
            onClick={() =>
              patchTypography(
                "fontStyle",
                fontStyle === "italic" ? DOCUMENT_TYPOGRAPHY_DEFAULT : "italic"
              )
            }
          >
            <Italic className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </>
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            disabled={disabled}
            aria-label={`More formatting for ${column.label}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {showTypography ? (
            <>
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
              <DropdownMenuSeparator />
            </>
          ) : null}
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
          ) : (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Type className="h-3.5 w-3.5" aria-hidden />
              Field options
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
