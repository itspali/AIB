"use client";

import { ChevronLeft, ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DesignerLayoutPreset } from "@/lib/documents/print/document-designer-layout-presets";
import { PRESENTATION_PAGE_SIZE_OPTIONS } from "@/lib/documents/print/presentation-page-dimensions";
import type { PresentationPageSize } from "@/lib/documents/print/types";
import { cn } from "@/lib/utils";

type Props = {
  presets: DesignerLayoutPreset[];
  activePresetId: string;
  pageSize: PresentationPageSize;
  canEdit: boolean;
  isPending?: boolean;
  onSelectPreset: (presetId: string) => void;
  onPreviousPreset: () => void;
  onNextPreset: () => void;
  onPageSizeChange: (size: PresentationPageSize) => void;
  onAutoGenerate: () => void;
  onRefresh: () => void;
};

export function DocumentDesignerPreviewToolbar({
  presets,
  activePresetId,
  pageSize,
  canEdit,
  isPending = false,
  onSelectPreset,
  onPreviousPreset,
  onNextPreset,
  onPageSizeChange,
  onAutoGenerate,
  onRefresh,
}: Props) {
  const activePreset =
    presets.find((preset) => preset.id === activePresetId) ?? presets[0] ?? null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      <Select
        value={pageSize}
        disabled={!canEdit || isPending}
        onValueChange={(value) => onPageSizeChange(value as PresentationPageSize)}
      >
        <SelectTrigger className="h-7 w-[min(6.5rem,28vw)] border border-border/60 bg-muted/20 px-2 text-xs">
          <SelectValue placeholder="Paper" />
        </SelectTrigger>
        <SelectContent align="end">
          {PRESENTATION_PAGE_SIZE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center rounded-md border border-border/60 bg-muted/20 p-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={!canEdit || isPending}
          aria-label="Previous layout"
          onClick={onPreviousPreset}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Select
          value={activePresetId}
          disabled={!canEdit || isPending}
          onValueChange={onSelectPreset}
        >
          <SelectTrigger className="h-7 w-[min(12rem,38vw)] border-0 bg-transparent px-2 text-xs shadow-none focus:ring-0">
            <SelectValue placeholder="Layout">{activePreset?.label ?? "Layout"}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={!canEdit || isPending}
          aria-label="Next layout"
          onClick={onNextPreset}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={!canEdit || isPending}
        onClick={onAutoGenerate}
      >
        <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />
        Auto-generate
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={isPending}
        onClick={onRefresh}
      >
        <RefreshCw className={cn("mr-1 h-3.5 w-3.5", isPending && "animate-spin")} aria-hidden />
        Refresh
      </Button>
    </div>
  );
}
