"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const DASHBOARD_SCROLL_ROOT_SELECTOR = "[data-dashboard-scroll-root]";

function getDashboardScrollRoot(): HTMLElement | null {
  return document.querySelector(DASHBOARD_SCROLL_ROOT_SELECTOR);
}

function getAnchorLine(headerRef: RefObject<HTMLElement | null>): number {
  return headerRef.current?.getBoundingClientRect().bottom ?? 120;
}

export function scrollToFormSection(
  sectionId: string,
  headerRef: RefObject<HTMLElement | null>,
  extraGap = 12
) {
  const element = document.getElementById(sectionId);
  const scrollRoot = getDashboardScrollRoot();
  if (!element || !scrollRoot) return;

  const anchorLine = getAnchorLine(headerRef);
  const targetScrollTop =
    scrollRoot.scrollTop + (element.getBoundingClientRect().top - anchorLine) - extraGap;

  scrollRoot.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
}

type UseFormSectionSpyOptions = {
  headerRef: RefObject<HTMLElement | null>;
};

export function useFormSectionSpy(
  sectionIds: string[],
  { headerRef }: UseFormSectionSpyOptions
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

    const scrollRoot = getDashboardScrollRoot();
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
  }, [headerRef, sectionIds.join(",")]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      markScrollToSection();
      setActiveId(sectionId);
      scrollToFormSection(sectionId, headerRef);
    },
    [headerRef, markScrollToSection]
  );

  return { activeId, scrollToSection };
}
