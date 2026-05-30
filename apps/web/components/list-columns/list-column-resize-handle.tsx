"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";

type Props = {
  ariaLabel: string;
  disabled?: boolean;
  getWidth: () => number;
  minWidth: number;
  maxWidth: number;
  onCommit: (width: number | null) => void;
  onPreview: (width: number) => void;
};

export function ListColumnResizeHandle({
  ariaLabel,
  disabled = false,
  getWidth,
  minWidth,
  maxWidth,
  onCommit,
  onPreview,
}: Props) {
  const clamp = useCallback(
    (width: number) => Math.round(Math.max(minWidth, Math.min(width, maxWidth))),
    [maxWidth, minWidth]
  );

  const startDrag = (event: React.MouseEvent) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = getWidth();

    const handleMove = (moveEvent: MouseEvent) => {
      onPreview(clamp(startWidth + (moveEvent.clientX - startX)));
    };

    const handleUp = (upEvent: MouseEvent) => {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      onCommit(clamp(startWidth + (upEvent.clientX - startX)));
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    onCommit(null);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title="Drag to resize. Double-click to reset."
      disabled={disabled}
      onMouseDown={startDrag}
      onDoubleClick={handleDoubleClick}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "absolute inset-y-0 right-0 z-30 w-2 translate-x-1/2 touch-none",
        "cursor-col-resize border-0 bg-transparent p-0",
        "after:absolute after:inset-y-2 after:right-1/2 after:w-px after:translate-x-1/2 after:bg-border/80",
        "hover:after:bg-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "pointer-events-none opacity-0"
      )}
    />
  );
}
