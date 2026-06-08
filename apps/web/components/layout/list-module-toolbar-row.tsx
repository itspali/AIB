"use client";

import type { ReactNode } from "react";
import {
  LIST_TOOLBAR_CONTROL_HEIGHT,
  LIST_TOOLBAR_ROW_GAP,
  LIST_TOOLBAR_ROW_MIN_HEIGHT,
  LIST_TOOLBAR_TEXT,
  LIST_TOOLBAR_TOOLS_GAP,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

type CountLabelProps = {
  compactCountLabel?: boolean;
  fullCountText: string;
  shortCountText: string;
  ratioCountText: string;
};

function CountLabel({
  compactCountLabel,
  fullCountText,
  shortCountText,
  ratioCountText,
}: CountLabelProps) {
  return (
    <span
      className={cn(
        "min-w-0 shrink truncate whitespace-nowrap tabular-nums",
        compactCountLabel
          ? "max-w-[5.5rem] sm:max-w-[6.5rem]"
          : "max-w-[5.5rem] sm:max-w-[7.5rem] md:max-w-[10rem] lg:max-w-[14rem] xl:max-w-[18rem] 2xl:max-w-[24rem]"
      )}
      title={compactCountLabel ? ratioCountText : fullCountText}
    >
      {compactCountLabel ? (
        ratioCountText
      ) : (
        <>
          <span className="lg:hidden">{ratioCountText}</span>
          <span className="hidden lg:inline 2xl:hidden">{shortCountText}</span>
          <span className="hidden 2xl:inline">{fullCountText}</span>
        </>
      )}
    </span>
  );
}

type Props = {
  resultCount: number;
  totalCount: number;
  countNoun?: string;
  countNounPlural?: string;
  compactCountLabel?: boolean;
  controls: ReactNode;
  className?: string;
};

export function ListModuleToolbarRow({
  resultCount,
  totalCount,
  countNoun = "item",
  countNounPlural,
  compactCountLabel = false,
  controls,
  className,
}: Props) {
  const plural = countNounPlural ?? `${countNoun}s`;
  const label = totalCount === 1 ? countNoun : plural;
  const fullCountText = `Showing ${resultCount} of ${totalCount} ${label}.`;
  const shortCountText = `Showing ${resultCount} of ${totalCount}`;
  const ratioCountText = `${resultCount}/${totalCount}`;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex min-w-0 flex-nowrap items-center overflow-hidden text-muted-foreground",
          LIST_TOOLBAR_ROW_GAP,
          LIST_TOOLBAR_ROW_MIN_HEIGHT,
          LIST_TOOLBAR_TEXT
        )}
      >
        <div className="min-w-0 shrink-0">
          <CountLabel
          compactCountLabel={compactCountLabel}
          fullCountText={fullCountText}
          shortCountText={shortCountText}
          ratioCountText={ratioCountText}
        />
        </div>
        <div
          className={cn(
            "relative z-10 flex min-w-0 flex-1 items-center justify-end overflow-x-auto overflow-y-visible",
            LIST_TOOLBAR_TOOLS_GAP,
            LIST_TOOLBAR_CONTROL_HEIGHT,
            "flex-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {controls}
        </div>
      </div>
    </div>
  );
}
