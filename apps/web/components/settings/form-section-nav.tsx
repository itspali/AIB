"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpDown, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FormSectionNavItem = {
  id: string;
  label: string;
  shortLabel?: string;
};

type Props = {
  sections: FormSectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
  onSectionOrderChange?: (orderedIds: string[]) => void;
};

export function FormSectionNav({
  sections,
  activeId,
  onSelect,
  className,
  onSectionOrderChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dragIdRef = useRef<string | null>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
  const [reorderMode, setReorderMode] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollLeft, scrollWidth, clientWidth } = element;
    const maxScroll = scrollWidth - clientWidth;

    setScrollState({
      canScrollLeft: scrollLeft > 4,
      canScrollRight: maxScroll > 4 && scrollLeft < maxScroll - 4,
    });
  }, []);

  const scrollActiveChipIntoView = useCallback(() => {
    if (reorderMode) return;

    const container = scrollRef.current;
    const activeChip = chipRefs.current.get(activeId);
    if (!container || !activeChip) return;

    const chipLeft = activeChip.offsetLeft;
    const chipWidth = activeChip.offsetWidth;
    const containerWidth = container.clientWidth;
    const targetLeft = chipLeft - containerWidth / 2 + chipWidth / 2;

    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [activeId, reorderMode]);

  const moveSection = useCallback(
    (fromId: string, toId: string) => {
      if (!onSectionOrderChange || fromId === toId) return;
      const ids = sections.map((section) => section.id);
      const fromIndex = ids.indexOf(fromId);
      const toIndex = ids.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0) return;

      const next = [...ids];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromId);
      onSectionOrderChange(next);
    },
    [onSectionOrderChange, sections]
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    updateScrollState();

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);

    element.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [sections, updateScrollState]);

  useEffect(() => {
    scrollActiveChipIntoView();
  }, [activeId, sections, scrollActiveChipIntoView]);

  useEffect(() => {
    if (!reorderMode) {
      dragIdRef.current = null;
      setDragOverId(null);
    }
  }, [reorderMode]);

  return (
    <nav aria-label="Form sections" className={cn("w-full min-w-0", className)}>
      <div className="flex items-start gap-2">
        <div className="relative isolate min-w-0 flex-1">
          <div
            ref={scrollRef}
            className={cn(
              "chip-scroll-track flex min-h-11 w-full min-w-0 touch-pan-x items-center gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-0.5 md:min-h-12 md:gap-2.5",
              reorderMode && "rounded-lg border border-dashed border-primary/30 bg-primary/5 px-2 py-1"
            )}
          >
            {sections.map((section) => {
              const isActive = section.id === activeId;
              const isDragOver = dragOverId === section.id;

              return (
                <button
                  key={section.id}
                  ref={(node) => {
                    if (node) {
                      chipRefs.current.set(section.id, node);
                    } else {
                      chipRefs.current.delete(section.id);
                    }
                  }}
                  type="button"
                  draggable={reorderMode}
                  aria-current={isActive ? "true" : undefined}
                  aria-grabbed={reorderMode && dragIdRef.current === section.id ? true : undefined}
                  onClick={() => {
                    if (reorderMode) return;
                    onSelect(section.id);
                  }}
                  onDragStart={(event) => {
                    if (!reorderMode) return;
                    dragIdRef.current = section.id;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", section.id);
                  }}
                  onDragEnd={() => {
                    dragIdRef.current = null;
                    setDragOverId(null);
                  }}
                  onDragOver={(event) => {
                    if (!reorderMode) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverId(section.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === section.id) {
                      setDragOverId(null);
                    }
                  }}
                  onDrop={(event) => {
                    if (!reorderMode) return;
                    event.preventDefault();
                    const fromId = dragIdRef.current ?? event.dataTransfer.getData("text/plain");
                    if (fromId) moveSection(fromId, section.id);
                    dragIdRef.current = null;
                    setDragOverId(null);
                  }}
                  className={cn(
                    "shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    reorderMode ? "cursor-grab active:cursor-grabbing" : "",
                    isDragOver && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                  )}
                >
                  <Badge
                    variant={isActive && !reorderMode ? "active" : "locked"}
                    className={cn(
                      "whitespace-nowrap px-3 py-1.5 text-xs transition-opacity md:px-4 md:py-2 md:text-sm",
                      reorderMode ? "cursor-grab gap-1.5 active:cursor-grabbing" : "cursor-pointer",
                      !isActive && !reorderMode && "opacity-80 hover:opacity-100"
                    )}
                  >
                    {reorderMode && <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                    <span className="md:hidden">{section.shortLabel ?? section.label}</span>
                    <span className="hidden md:inline">{section.label}</span>
                  </Badge>
                </button>
              );
            })}
          </div>

          {scrollState.canScrollLeft && !reorderMode && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-7 bg-gradient-to-r from-background via-background/90 to-transparent md:w-10"
            />
          )}
          {scrollState.canScrollRight && !reorderMode && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-7 bg-gradient-to-l from-background via-background/90 to-transparent md:w-10"
            />
          )}
        </div>

        {onSectionOrderChange && (
          <Button
            type="button"
            variant={reorderMode ? "secondary" : "outline"}
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            title={reorderMode ? "Done reordering sections" : "Reorder sections"}
            aria-label={reorderMode ? "Done reordering sections" : "Reorder sections"}
            aria-pressed={reorderMode}
            onClick={() => setReorderMode((current) => !current)}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        )}
      </div>
      {reorderMode && (
        <p className="mt-2 text-xs text-muted-foreground">
          Drag section chips to reorder the drawer layout.
        </p>
      )}
    </nav>
  );
}
