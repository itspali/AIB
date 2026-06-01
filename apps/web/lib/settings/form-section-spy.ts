"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const DASHBOARD_SCROLL_ROOT_SELECTOR = "[data-dashboard-scroll-root]";

function resolveScrollRoot(scrollRootRef?: RefObject<HTMLElement | null>): HTMLElement | null {
  if (scrollRootRef?.current) return scrollRootRef.current;
  return document.querySelector(DASHBOARD_SCROLL_ROOT_SELECTOR);
}

function getAnchorLine(headerRef: RefObject<HTMLElement | null>): number {
  return headerRef.current?.getBoundingClientRect().bottom ?? 120;
}

export type ScrollInDashboardRootOptions = {
  /** Base offset from the top of the dashboard scrollport (default 96). */
  offsetTop?: number;
  /** Extra clearance for sticky in-page nav (e.g. mobile chip bar height). */
  additionalOffset?: number;
  scrollRootRef?: RefObject<HTMLElement | null>;
};

export function scrollChipIntoCenter(container: HTMLElement, chip: HTMLElement) {
  const chipLeft = chip.offsetLeft;
  const chipWidth = chip.offsetWidth;
  const containerWidth = container.clientWidth;
  const targetLeft = chipLeft - containerWidth / 2 + chipWidth / 2;

  container.scrollTo({
    left: Math.max(0, targetLeft),
    behavior: "smooth",
  });
}

export function scrollElementInDashboardRoot(
  element: HTMLElement,
  options: ScrollInDashboardRootOptions = {}
) {
  const {
    offsetTop = 96,
    additionalOffset = 0,
    scrollRootRef,
  } = options;
  const scrollRoot = resolveScrollRoot(scrollRootRef);
  if (!scrollRoot) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const totalOffset = offsetTop + additionalOffset;
  const anchorLine = scrollRoot.getBoundingClientRect().top + totalOffset;
  const targetScrollTop =
    scrollRoot.scrollTop + (element.getBoundingClientRect().top - anchorLine);

  scrollRoot.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
}

export function resolveScrollSpyAnchorLine(scrollRoot: HTMLElement, offsetTop = 0): number {
  return scrollRoot.getBoundingClientRect().top + offsetTop;
}

/** Last section whose top has crossed the anchor line (progressive scroll-spy). */
export function resolveActiveSectionByScrollPosition<T extends string>(
  sectionIds: readonly T[],
  getElement: (id: T) => HTMLElement | null,
  anchorLine: number,
  tolerance = 12
): T | null {
  let currentId: T | null = sectionIds[0] ?? null;

  for (const id of sectionIds) {
    const element = getElement(id);
    if (!element) continue;
    if (element.getBoundingClientRect().top <= anchorLine + tolerance) {
      currentId = id;
    }
  }

  return currentId;
}

export function scrollToFormSection(
  sectionId: string,
  headerRef: RefObject<HTMLElement | null>,
  extraGap = 12,
  scrollRootRef?: RefObject<HTMLElement | null>
) {
  const element = document.getElementById(sectionId);
  const scrollRoot = resolveScrollRoot(scrollRootRef);
  if (!element || !scrollRoot) return;

  const anchorLine = getAnchorLine(headerRef);
  const targetScrollTop =
    scrollRoot.scrollTop + (element.getBoundingClientRect().top - anchorLine) - extraGap;

  scrollRoot.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
}

type UseFormSectionSpyOptions = {
  headerRef: RefObject<HTMLElement | null>;
  scrollRootRef?: RefObject<HTMLElement | null>;
};

export function useFormSectionSpy(
  sectionIds: string[],
  { headerRef, scrollRootRef }: UseFormSectionSpyOptions
) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");
  const ignoreUntilRef = useRef(0);
  const sectionIdsRef = useRef(sectionIds);
  sectionIdsRef.current = sectionIds;

  const markScrollToSection = useCallback(() => {
    ignoreUntilRef.current = Date.now() + 900;
  }, []);

  useEffect(() => {
    setActiveId((current) => (sectionIds.includes(current) ? current : sectionIds[0] ?? ""));
  }, [sectionIds.join(",")]);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const scrollRoot = resolveScrollRoot(scrollRootRef);
    if (!scrollRoot) return;

    const updateActive = () => {
      if (Date.now() < ignoreUntilRef.current) return;

      const anchorLine = getAnchorLine(headerRef);
      let currentId = sectionIdsRef.current[0] ?? "";

      for (const id of sectionIdsRef.current) {
        const element = document.getElementById(id);
        if (!element) continue;

        if (element.getBoundingClientRect().top <= anchorLine + 12) {
          currentId = id;
        }
      }

      setActiveId(currentId);
    };

    updateActive();

    scrollRoot.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);

    const headerElement = headerRef.current;
    const headerObserver =
      headerElement instanceof Element ? new ResizeObserver(updateActive) : null;
    if (headerElement instanceof Element) {
      headerObserver?.observe(headerElement);
    }

    return () => {
      scrollRoot.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
      headerObserver?.disconnect();
    };
  }, [headerRef, scrollRootRef, sectionIds.join(",")]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      markScrollToSection();
      setActiveId(sectionId);
      scrollToFormSection(sectionId, headerRef, 12, scrollRootRef);
    },
    [headerRef, markScrollToSection, scrollRootRef]
  );

  return { activeId, scrollToSection };
}
