"use client";

import { AppWindow, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openDrawerPopOut } from "@/lib/layout/drawer-width-policy";

type Props = {
  href: string;
  /** Accessible label for the trigger. */
  label?: string;
};

/** Fixed-width drawer escape hatch — new tab or sized pop-out window. */
export function DrawerPopOutButton({ href, label = "Open outside drawer" }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          aria-label={label}
          title={label}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        <DropdownMenuItem
          onSelect={() => openDrawerPopOut(href, "tab")}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          Open in new tab
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => openDrawerPopOut(href, "window")}
          className="gap-2"
        >
          <AppWindow className="h-4 w-4 shrink-0" aria-hidden />
          Open in pop-out window
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
