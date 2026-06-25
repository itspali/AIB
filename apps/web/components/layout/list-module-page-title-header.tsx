"use client";

import { Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  title: string;
  description: string;
  createLabel: string;
  onCreate?: () => void;
  aboutAriaLabel?: string;
};

/** Shared list-module page title row (Items / Tier B operational modules). */
export function ListModulePageTitleHeader({
  title,
  description,
  createLabel,
  onCreate,
  aboutAriaLabel,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">{title}</h1>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label={aboutAriaLabel ?? `About ${title}`}
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-3">
            <p className="text-sm leading-snug text-muted-foreground">{description}</p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {onCreate ? (
        <Button
          type="button"
          size="sm"
          className="h-8 w-8 shrink-0 px-0 sm:w-auto sm:gap-1.5 sm:px-2.5"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{createLabel}</span>
          <span className="sr-only sm:hidden">{createLabel}</span>
        </Button>
      ) : null}
    </div>
  );
}
