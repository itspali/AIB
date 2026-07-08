"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { EditorStageAccordionHeader } from "@/components/products/product-editor/editor-stage-accordion-header";
import type { EditorWizardChrome } from "@/components/products/product-editor/product-editor-shell";
import {
  EDITOR_STAGES,
  editorStageById,
  stageForSection,
  type EditorStageId,
} from "@/lib/products/editor-stages";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import {
  overallCompletenessPercent,
  rollUpStageStatus,
  type StageStatus,
} from "@/lib/products/item-completeness";
import {
  type EditorSectionStatus,
  type SectionId,
} from "@/lib/products/item-editor/editor-shell-shared";
import { scrollElementInDashboardRoot } from "@/lib/settings/form-section-spy";

export type UseItemEditorWizardChromeInput = {
  wizard?: EditorWizardChrome;
  wizardAccordion: boolean;
  wizardSteps: boolean;
  isPanelLayout: boolean;
  isPhysical: boolean;
  hasComposition: boolean;
  showVariantsSection: boolean;
  showCompositeItemSection: boolean;
  pinnedSections?: EditorSectionId[];
  itemId: string | null;
  sectionStatus: (id: SectionId) => EditorSectionStatus;
  panelScrollRef: RefObject<HTMLDivElement | null>;
  scrollRootRef: RefObject<HTMLElement | null>;
  ignoreSpyUntilRef: RefObject<number>;
};

export function useItemEditorWizardChrome({
  wizard,
  wizardAccordion,
  wizardSteps,
  isPanelLayout,
  isPhysical,
  hasComposition,
  showVariantsSection,
  showCompositeItemSection,
  pinnedSections,
  itemId,
  sectionStatus,
  panelScrollRef,
  scrollRootRef,
  ignoreSpyUntilRef,
}: UseItemEditorWizardChromeInput) {
  const [expandedStage, setExpandedStage] = useState<EditorStageId>("essentials");
  const stageHeaderRefs = useRef<Partial<Record<EditorStageId, HTMLDivElement>>>({});

  const activeWizardStage: EditorStageId | null = wizardAccordion
    ? expandedStage
    : wizard?.stage ?? null;

  const wizardSectionSet = useMemo(
    () =>
      wizardSteps && wizard ? new Set(editorStageById(wizard.stage).sections) : null,
    [wizard, wizardSteps]
  );

  const sectionInStage = useCallback(
    (id: SectionId) => !wizardSectionSet || wizardSectionSet.has(id),
    [wizardSectionSet]
  );

  const sectionInExpandedStage = useCallback(
    (id: SectionId) => {
      if (!wizardAccordion) return true;
      const stage = stageForSection(id);
      if (!stage) return true;
      return expandedStage === stage;
    },
    [wizardAccordion, expandedStage]
  );

  const pinnedSet = useMemo(
    () => (pinnedSections ? new Set(pinnedSections) : null),
    [pinnedSections]
  );

  const sectionVisible = useCallback(
    (id: SectionId) =>
      sectionInExpandedStage(id) &&
      sectionInStage(id) &&
      (id !== "inventory" || isPhysical) &&
      (id !== "composition" || hasComposition) &&
      (id !== "composite_item" || showCompositeItemSection) &&
      (id !== "item_logistics" || isPhysical) &&
      (!pinnedSet || pinnedSet.has(id)),
    [sectionInExpandedStage, sectionInStage, pinnedSet, isPhysical, hasComposition, showCompositeItemSection]
  );

  const wizardStages = useMemo(
    () =>
      EDITOR_STAGES.filter((stage) => {
        if (stage.id === "composition" && !hasComposition) return false;
        return true;
      }),
    [hasComposition]
  );

  const applicableWizardSections = useCallback(
    (sections: EditorSectionId[]) =>
      sections.filter(
        (section) =>
          (section !== "inventory" || isPhysical) &&
          (section !== "variants" || showVariantsSection) &&
          (section !== "composition" || hasComposition) &&
          (section !== "composite_item" || showCompositeItemSection) &&
          (section !== "item_logistics" || isPhysical)
      ),
    [hasComposition, isPhysical, showVariantsSection, showCompositeItemSection]
  );

  const wizardStageStatuses = useMemo(() => {
    const map = {} as Record<EditorStageId, StageStatus>;
    for (const stage of wizardStages) {
      map[stage.id] = rollUpStageStatus(
        applicableWizardSections(stage.sections).map((section) => sectionStatus(section))
      );
    }
    return map;
  }, [wizardStages, sectionStatus, applicableWizardSections]);

  const wizardPercent = useMemo(
    () =>
      overallCompletenessPercent(
        wizardStages
          .flatMap((stage) => applicableWizardSections(stage.sections))
          .map((section) => sectionStatus(section))
      ),
    [wizardStages, sectionStatus, applicableWizardSections]
  );

  useEffect(() => {
    if (wizardAccordion) {
      setExpandedStage("essentials");
    }
  }, [wizardAccordion, itemId]);

  const jumpToStage = useCallback(
    (stageId: EditorStageId) => {
      setExpandedStage(stageId);
      ignoreSpyUntilRef.current = Date.now() + 900;
      requestAnimationFrame(() => {
        const el = stageHeaderRefs.current[stageId];
        if (!el) return;
        if (isPanelLayout && panelScrollRef.current) {
          const root = panelScrollRef.current;
          const rootRect = root.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const top = root.scrollTop + (elRect.top - rootRect.top) - 12;
          root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          return;
        }
        scrollElementInDashboardRoot(el, {
          offsetTop: isPanelLayout ? 20 : 96,
          scrollRootRef,
        });
      });
    },
    [ignoreSpyUntilRef, isPanelLayout, panelScrollRef, scrollRootRef]
  );

  const toggleExpandedStage = useCallback(
    (stageId: EditorStageId) => {
      setExpandedStage((prev) => (prev === stageId ? prev : stageId));
      ignoreSpyUntilRef.current = Date.now() + 400;
    },
    [ignoreSpyUntilRef]
  );

  const registerStageHeader = useCallback(
    (stageId: EditorStageId) => (el: HTMLDivElement | null) => {
      if (el) {
        stageHeaderRefs.current[stageId] = el;
      } else {
        delete stageHeaderRefs.current[stageId];
      }
    },
    []
  );

  const renderStageAccordionHeader = useCallback(
    (stageId: EditorStageId): ReactNode => {
      if (!wizardAccordion) return null;
      const stage = wizardStages.find((entry) => entry.id === stageId);
      if (!stage) return null;
      const index = wizardStages.findIndex((entry) => entry.id === stageId);
      return (
        <EditorStageAccordionHeader
          stage={stage}
          index={index}
          status={wizardStageStatuses[stageId] ?? "empty"}
          expanded={expandedStage === stageId}
          onToggle={() => toggleExpandedStage(stageId)}
          registerRef={registerStageHeader(stageId)}
          panel={isPanelLayout}
        />
      );
    },
    [
      wizardAccordion,
      wizardStages,
      wizardStageStatuses,
      expandedStage,
      toggleExpandedStage,
      registerStageHeader,
      isPanelLayout,
    ]
  );

  const wizardStepperActiveStage = wizardAccordion ? expandedStage : wizard?.stage ?? "essentials";
  const wizardStepperOnSelect = wizardAccordion ? jumpToStage : wizard?.onSelectStage;

  return {
    activeWizardStage,
    sectionVisible,
    wizardStages,
    wizardStageStatuses,
    wizardPercent,
    renderStageAccordionHeader,
    wizardStepperActiveStage,
    wizardStepperOnSelect,
    jumpToStage,
  };
}
