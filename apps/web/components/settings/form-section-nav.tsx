"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
};

export function FormSectionNav({ sections, activeId, onSelect, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });

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
  }, [activeId]);

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

  return (
    <nav aria-label="Form sections" className={cn("w-full min-w-0", className)}>
      <div className="relative isolate">
        <div
          ref={scrollRef}
          className="chip-scroll-track flex min-h-11 w-full min-w-0 touch-pan-x items-center gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-0.5 md:min-h-12 md:gap-2.5"
        >
          {sections.map((section) => {
            const isActive = section.id === activeId;

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
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelect(section.id)}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge
                  variant={isActive ? "active" : "locked"}
                  className={cn(
                    "cursor-pointer whitespace-nowrap px-3 py-1.5 text-xs transition-opacity md:px-4 md:py-2 md:text-sm",
                    !isActive && "opacity-80 hover:opacity-100"
                  )}
                >
                  <span className="md:hidden">{section.shortLabel ?? section.label}</span>
                  <span className="hidden md:inline">{section.label}</span>
                </Badge>
              </button>
            );
          })}
        </div>

        {scrollState.canScrollLeft && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-7 bg-gradient-to-r from-background via-background/90 to-transparent md:w-10"
          />
        )}
        {scrollState.canScrollRight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-7 bg-gradient-to-l from-background via-background/90 to-transparent md:w-10"
          />
        )}
      </div>
    </nav>
  );
}
