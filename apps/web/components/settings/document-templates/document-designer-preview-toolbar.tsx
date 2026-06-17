"use client";

import { ChevronLeft, ChevronRight, FileText, LayoutTemplate, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const iconButtonClass = "h-7 w-7 shrink-0 p-0";

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
  const controlsDisabled = !canEdit || isPending;

  return (
    <div className="flex min-w-0 w-full flex-wrap items-center justify-end gap-1.5">
      <div className="document-designer-preview-toolbar-compact min-w-0 flex-wrap items-center gap-1.5">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(iconButtonClass, "border-border/60 bg-muted/20")}
              disabled={controlsDisabled}
              aria-label={`Paper size: ${pageSize}`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel className="text-xs">Paper size</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={pageSize}
              onValueChange={(value) => onPageSizeChange(value as PresentationPageSize)}
            >
              {PRESENTATION_PAGE_SIZE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center rounded-md border border-border/60 bg-muted/20 p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={iconButtonClass}
            disabled={controlsDisabled}
            aria-label="Previous layout"
            onClick={onPreviousPreset}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={iconButtonClass}
                disabled={controlsDisabled}
                aria-label={`Layout: ${activePreset?.label ?? "Layout"}`}
              >
                <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Layout preset</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activePresetId} onValueChange={onSelectPreset}>
                {presets.map((preset) => (
                  <DropdownMenuRadioItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={iconButtonClass}
            disabled={controlsDisabled}
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
          className={iconButtonClass}
          disabled={controlsDisabled}
          aria-label="Auto-generate layout"
          onClick={onAutoGenerate}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={iconButtonClass}
          disabled={isPending}
          aria-label="Refresh preview"
          onClick={onRefresh}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} aria-hidden />
        </Button>
      </div>

      <div className="document-designer-preview-toolbar-wide min-w-0 flex-wrap items-center justify-end gap-1.5">
        <Select
          value={pageSize}
          disabled={controlsDisabled}
          onValueChange={(value) => onPageSizeChange(value as PresentationPageSize)}
        >
          <SelectTrigger className="h-7 w-[5.25rem] shrink-0 border border-border/60 bg-muted/20 px-2 text-xs">
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

        <div className="flex min-w-0 max-w-full items-center rounded-md border border-border/60 bg-muted/20 p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={iconButtonClass}
            disabled={controlsDisabled}
            aria-label="Previous layout"
            onClick={onPreviousPreset}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Select
            value={activePresetId}
            disabled={controlsDisabled}
            onValueChange={onSelectPreset}
          >
            <SelectTrigger className="h-7 min-w-[5.5rem] max-w-[9rem] flex-1 border-0 bg-transparent px-2 text-xs shadow-none focus:ring-0">
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
            className={iconButtonClass}
            disabled={controlsDisabled}
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
          className="h-7 shrink-0 px-2 text-xs"
          disabled={controlsDisabled}
          aria-label="Auto-generate layout"
          onClick={onAutoGenerate}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
          Auto-generate
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          disabled={isPending}
          aria-label="Refresh preview"
          onClick={onRefresh}
        >
          <RefreshCw className={cn("mr-1 h-3.5 w-3.5 shrink-0", isPending && "animate-spin")} aria-hidden />
          Refresh
        </Button>
      </div>
    </div>
  );
}
