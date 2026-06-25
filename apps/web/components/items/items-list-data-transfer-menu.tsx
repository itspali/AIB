"use client";

import { useState } from "react";
import { Download, MoreHorizontal, Upload } from "lucide-react";
import { ItemsListExportDialog } from "@/components/items/items-list-export-dialog";
import { ItemsListImportDialog } from "@/components/items/items-list-import-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listToolbarIconButtonClass } from "@/lib/layout/list-toolbar-chrome";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

export type ItemsListDataTransferMenuProps = {
  fieldPermissions: ProductFieldPermissions;
  defaultColumnIds: ProductListColumnId[];
  rowCount: number;
  previewRows?: ProductListRow[];
  resolveExportRows: () => Promise<ProductListRow[]>;
  onImported?: () => void;
  className?: string;
  /** Inline actions for mobile overflow menu (no dropdown trigger). */
  variant?: "menu" | "embedded";
};

export function ItemsListDataTransferMenu({
  fieldPermissions,
  defaultColumnIds,
  rowCount,
  previewRows,
  resolveExportRows,
  onImported,
  className,
  variant = "menu",
}: ItemsListDataTransferMenuProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const dialogs = (
    <>
      <ItemsListImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={onImported}
      />
      <ItemsListExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        fieldPermissions={fieldPermissions}
        defaultColumnIds={defaultColumnIds}
        rowCount={rowCount}
        previewRows={previewRows}
        resolveRows={resolveExportRows}
      />
    </>
  );

  if (variant === "embedded") {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          className={cn(listToolbarIconButtonClass(false), "h-8 w-full justify-start px-2", className)}
          onClick={() => setImportOpen(true)}
        >
          <Upload className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          Import…
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(listToolbarIconButtonClass(false), "h-8 w-full justify-start px-2", className)}
          onClick={() => setExportOpen(true)}
        >
          <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          Export…
        </Button>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(listToolbarIconButtonClass(false), "shrink-0", className)}
            aria-label="Import and export items"
            title="Import / export"
          >
            <MoreHorizontal className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
            <Download className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" aria-hidden />
            Import…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Export…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  );
}
