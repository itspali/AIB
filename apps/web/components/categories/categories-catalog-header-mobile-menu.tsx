"use client";

import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listToolbarIconButtonClass } from "@/lib/layout/list-toolbar-chrome";

type Props = {
  controls: ReactNode;
};

export function CategoriesCatalogHeaderMobileMenu({ controls }: Props) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={listToolbarIconButtonClass(false)}
          aria-label="Category catalog options"
          title="Category catalog options"
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
