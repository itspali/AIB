"use client";

import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listToolbarIconButtonClass } from "@/lib/layout/list-toolbar-chrome";

type Props = {
  controls: ReactNode;
  dataTransfer?: ReactNode;
};

/** Collapses catalog toolbar actions into a menu on narrow viewports. */
export function ItemsCatalogHeaderMobileMenu({ controls, dataTransfer }: Props) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={listToolbarIconButtonClass(false)}
          aria-label="Catalog options"
          title="Catalog options"
        >
          <Menu className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="items-catalog-header-mobile-panel w-[min(20rem,calc(100vw-2rem))] p-3"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="items-catalog-header-mobile-panel__controls">{controls}</div>
        {dataTransfer ? (
          <>
            <DropdownMenuSeparator className="my-2" />
            <div className="items-catalog-header-mobile-panel__transfer">{dataTransfer}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
