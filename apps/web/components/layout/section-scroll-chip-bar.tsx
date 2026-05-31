"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { scrollChipIntoCenter } from "@/lib/settings/form-section-spy";
import { cn } from "@/lib/utils";

export type SectionScrollChip = {
  id: string;
  label: string;
  leading?: ReactNode;
};

type Props = {
  chips: SectionScrollChip[];
  activeId: string;
  onSelect: (id: string) => void;
  barRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  /** When true, parent owns sticky chrome — bar is scroll-only. */
  embedded?: boolean;
};

const TAP_MOVE_THRESHOLD_PX = 10;

export function SectionScrollChipBar({
  chips,
  activeId,
  onSelect,
  barRef: externalBarRef,
  className,
  embedded = false,
}: Props) {
  const internalBarRef = useRef<HTMLDivElement | null>(null);
  const barRef = externalBarRef ?? internalBarRef;
  const touchStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const chip = bar.querySelector<HTMLElement>(`[data-chip="${activeId}"]`);
    if (chip) scrollChipIntoCenter(bar, chip);
  }, [activeId, barRef, chips]);

  const handleChipActivate = (id: string) => {
    onSelect(id);
  };

  return (
    <div
      ref={barRef}
      className={cn(
        "chip-scroll-track flex min-h-11 touch-pan-x gap-1 overflow-x-auto overscroll-x-contain",
        embedded
          ? "px-0.5"
          : "sticky top-0 z-20 -mx-1 rounded-lg border border-border bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden",
        className
      )}
    >
      {chips.map((chip) => {
        const active = activeId === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            data-chip={chip.id}
            onPointerDown={(event) => {
              touchStartRef.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              const dx = Math.abs(event.clientX - touchStartRef.current.x);
              const dy = Math.abs(event.clientY - touchStartRef.current.y);
              if (dx <= TAP_MOVE_THRESHOLD_PX && dy <= TAP_MOVE_THRESHOLD_PX) {
                handleChipActivate(chip.id);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleChipActivate(chip.id);
              }
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-transparent bg-secondary text-secondary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {chip.leading}
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
