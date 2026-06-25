"use client";

import { PanelLeft, TableProperties } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listToolbarIconButtonClass } from "@/lib/layout/list-toolbar-chrome";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace";
import { cn } from "@/lib/utils";

const LAYOUT_OPTIONS: {
  id: ListWorkspaceLayout;
  label: string;
  title: string;
  icon: typeof PanelLeft;
}[] = [
  { id: "split", label: "Split", title: "Split view — list and inline detail", icon: PanelLeft },
  {
    id: "matrix",
    label: "Matrix",
    title: "Matrix view — registry table and peek drawer",
    icon: TableProperties,
  },
];

type Props = {
  layout: ListWorkspaceLayout;
  onLayoutChange: (layout: ListWorkspaceLayout) => void;
  disabled?: boolean;
  className?: string;
};

export function ListWorkspaceLayoutToggle({
  layout,
  onLayoutChange,
  disabled = false,
  className,
}: Props) {
  const current =
    LAYOUT_OPTIONS.find((option) => option.id === layout) ?? LAYOUT_OPTIONS[1];
  const nextLayout: ListWorkspaceLayout = layout === "split" ? "matrix" : "split";
  const next =
    LAYOUT_OPTIONS.find((option) => option.id === nextLayout) ?? LAYOUT_OPTIONS[0];
  const Icon = current.icon;

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      className={cn(listToolbarIconButtonClass(false), "hidden shrink-0 sm:inline-flex", className)}
      onClick={() => onLayoutChange(nextLayout)}
      title={`${current.title}. Switch to ${next.label.toLowerCase()} view.`}
      aria-label={`${current.label} view. Switch to ${next.label} view.`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
    </Button>
  );
}
