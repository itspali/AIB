"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlignJustify,
  LayoutGrid,
  LayoutList,
  RotateCcw,
  Sparkles,
  Square,
  TableProperties,
  Wand2,
} from "lucide-react";
import { useAppearancePreview } from "@/components/appearance/appearance-preview-provider";
import { Button } from "@/components/ui/button";
import type { UiGeneration } from "@/lib/appearance/types";
import { cn } from "@/lib/utils";

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon: LucideIcon;
};

function PreviewSegment<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:inline">
        {label}
      </span>
      <div
        className={cn(
          "inline-flex shrink-0 items-center rounded-md bg-muted/80 p-0.5 ring-1 ring-border/60",
          disabled && "pointer-events-none opacity-50"
        )}
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const selected = value === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex items-center justify-center rounded transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "h-7 min-w-7 px-2 md:h-auto md:min-w-0 md:px-2 md:py-1",
                selected
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 md:hidden" aria-hidden />
              <span className="hidden text-[11px] font-medium md:inline">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type AppearancePreviewBarProps = {
  moduleName?: string;
  /** Catalog pages compare list styling; overview pages compare command center. */
  previewMode?: "catalog" | "overview";
};

export function AppearancePreviewBar({
  moduleName,
  previewMode = "overview",
}: AppearancePreviewBarProps = {}) {
  const { state, setGeneration, setVisual, setDensity, reset, isPreview } = useAppearancePreview();
  const revampChromeActive = isPreview || state.headerChrome === "unified";
  const hint =
    previewMode === "catalog"
      ? moduleName
        ? `${moduleName}: classic list · input matrix · unified header`
        : "Classic list · input matrix · unified header"
      : moduleName
        ? `${moduleName}: classic overview vs revamp command center`
        : "Classic overview vs revamp command center";

  const layoutOptions =
    previewMode === "catalog"
      ? [
          { value: "classic" as const, label: "Classic", icon: LayoutList },
          { value: "matrix" as const, label: "Matrix", icon: TableProperties },
        ]
      : [
          { value: "classic" as const, label: "Classic", icon: LayoutList },
          { value: "preview" as const, label: "Revamp", icon: Wand2 },
        ];

  const layoutValue =
    previewMode === "catalog" && state.generation === "preview" ? "matrix" : state.generation;

  const handleLayoutChange = (value: UiGeneration) => {
    setGeneration(value);
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-3 mb-2 border-b border-primary/20 bg-background/95 px-2 py-1.5 backdrop-blur-xl",
        "sm:mb-3 sm:px-3 sm:py-2 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3 sm:gap-y-2">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/20 sm:px-2 sm:text-[10px]">
            UI Revamp
          </span>
          <span className="hidden text-xs text-muted-foreground lg:inline">{hint}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:gap-2 md:gap-3">
          <PreviewSegment
            label="Layout"
            value={layoutValue}
            onChange={handleLayoutChange}
            options={layoutOptions}
          />
          <PreviewSegment
            label="Style"
            value={state.visual}
            onChange={setVisual}
            disabled={!revampChromeActive}
            options={[
              { value: "glass", label: "Glass", icon: Sparkles },
              { value: "flat", label: "Flat", icon: Square },
            ]}
          />
          <PreviewSegment
            label="Density"
            value={state.density}
            onChange={setDensity}
            disabled={!revampChromeActive}
            options={[
              { value: "compact", label: "Compact", icon: AlignJustify },
              { value: "comfortable", label: "Comfortable", icon: LayoutGrid },
            ]}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0 sm:w-auto sm:px-2"
            onClick={reset}
            aria-label="Reset preview preferences"
            title="Reset preview preferences"
          >
            <RotateCcw className="h-3.5 w-3.5 sm:mr-1" aria-hidden />
            <span className="hidden text-xs sm:inline">Reset</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
