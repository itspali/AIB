"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { EDITOR_SECTIONS_HIDDEN_WHILE_CREATING } from "@/lib/products/editor-sections";
import {
  resolveEditorScrollSpyOffset,
  type SectionId,
} from "@/lib/products/item-editor/editor-shell-shared";
import {
  resolveActiveSectionByScrollPosition,
  resolveScrollSpyAnchorLine,
  scrollElementInDashboardRoot,
} from "@/lib/settings/form-section-spy";

export type UseItemEditorSectionNavInput = {
  isPanelLayout: boolean;
  panelUseTopSectionTabs: boolean;
  panelRailHorizontal: boolean;
  itemId: string | null;
  formRef: RefObject<HTMLFormElement | null>;
  panelScrollRef: RefObject<HTMLDivElement | null>;
  chipBarRef: RefObject<HTMLDivElement | null>;
  panelPaneWidth: number;
  visibleSectionIds: SectionId[];
};

export function useItemEditorSectionNav({
  isPanelLayout,
  panelUseTopSectionTabs,
  panelRailHorizontal,
  itemId,
  formRef,
  panelScrollRef,
  chipBarRef,
  panelPaneWidth,
  visibleSectionIds,
}: UseItemEditorSectionNavInput) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLDivElement | null>>>({});
  const ignoreSpyUntilRef = useRef(0);
  const scrollToSectionRef = useRef<(id: SectionId) => void>(() => {});

  useLayoutEffect(() => {
    if (isPanelLayout && panelScrollRef.current) {
      scrollRootRef.current = panelScrollRef.current;
      setScrollRoot(panelScrollRef.current);
      return;
    }
    let el = formRef.current?.parentElement ?? null;
    while (el) {
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollRootRef.current = el;
        setScrollRoot(el);
        return;
      }
      el = el.parentElement;
    }
    scrollRootRef.current = null;
    setScrollRoot(null);
  }, [formRef, isPanelLayout, panelPaneWidth, panelScrollRef, panelUseTopSectionTabs]);

  useEffect(() => {
    const scrollRootEl = scrollRootRef.current;
    if (!scrollRootEl) return;

    const updateActive = () => {
      if (Date.now() < ignoreSpyUntilRef.current) return;

      const stickyNavHeight = isPanelLayout
        ? panelUseTopSectionTabs
          ? (chipBarRef.current?.offsetHeight ?? 0)
          : 0
        : (chipBarRef.current?.offsetHeight ?? 0);
      const anchorLine = resolveScrollSpyAnchorLine(
        scrollRootEl,
        resolveEditorScrollSpyOffset(isPanelLayout, stickyNavHeight, panelRailHorizontal)
      );
      const nextActive = resolveActiveSectionByScrollPosition(
        visibleSectionIds,
        (id) => sectionRefs.current[id as SectionId] ?? null,
        anchorLine
      );

      if (nextActive) {
        setActiveSection(nextActive);
      }
    };

    updateActive();
    scrollRootEl.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);

    return () => {
      scrollRootEl.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [
    chipBarRef,
    isPanelLayout,
    panelRailHorizontal,
    panelUseTopSectionTabs,
    scrollRoot,
    visibleSectionIds,
  ]);

  useEffect(() => {
    if (itemId) return;
    if (EDITOR_SECTIONS_HIDDEN_WHILE_CREATING.includes(activeSection)) {
      setActiveSection("overview");
    }
  }, [itemId, activeSection]);

  const scrollToSection = useCallback(
    (id: SectionId) => {
      ignoreSpyUntilRef.current = Date.now() + 900;
      setActiveSection(id);
      const el = sectionRefs.current[id];
      if (!el) return;

      const stickyNavHeight = isPanelLayout
        ? panelUseTopSectionTabs
          ? (chipBarRef.current?.offsetHeight ?? 0)
          : 0
        : (chipBarRef.current?.offsetHeight ?? 0);
      if (isPanelLayout && panelScrollRef.current) {
        const root = panelScrollRef.current;
        const rootRect = root.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const top =
          root.scrollTop + (elRect.top - rootRect.top) - (stickyNavHeight > 0 ? stickyNavHeight + 8 : 12);
        root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return;
      }
      scrollElementInDashboardRoot(el, {
        offsetTop: isPanelLayout ? 20 : 96,
        additionalOffset: stickyNavHeight > 0 ? stickyNavHeight + 8 : 0,
        scrollRootRef,
      });
    },
    [chipBarRef, isPanelLayout, panelScrollRef, panelUseTopSectionTabs]
  );

  scrollToSectionRef.current = scrollToSection;

  const registerSection = useCallback(
    (id: SectionId) => (el: HTMLDivElement | null) => {
      sectionRefs.current[id] = el;
    },
    []
  );

  return {
    activeSection,
    scrollRoot,
    scrollRootRef,
    sectionRefs,
    ignoreSpyUntilRef,
    scrollToSection,
    scrollToSectionRef,
    registerSection,
  };
}
