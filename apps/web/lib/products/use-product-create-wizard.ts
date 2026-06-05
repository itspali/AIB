"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorWizardChrome } from "@/components/products/product-editor/product-editor-shell";
import {
  editorStageOrder,
  isEditorStageId,
  type EditorStageId,
} from "@/lib/products/editor-stages";
import type { ProductDetailSnapshot } from "@/lib/products/types";

export type WizardNav =
  | { type: "primary" }
  | { type: "back" }
  | { type: "exit" }
  | { type: "stage"; stage: EditorStageId };

type Options = {
  active: boolean;
  variantStrategy?: string | null;
  hasComposition?: boolean;
  onFinished: (itemId: string) => void;
};

export function useProductCreateWizard({
  active,
  variantStrategy = "SINGLE_SKU",
  hasComposition = false,
  onFinished,
}: Options) {
  const [stage, setStage] = useState<EditorStageId>("essentials");
  const [resolvedStrategy, setResolvedStrategy] = useState(variantStrategy);
  const [resolvedComposition, setResolvedComposition] = useState(hasComposition);
  const navRef = useRef<WizardNav>({ type: "primary" });
  const submitRef = useRef<((nav: WizardNav) => void) | null>(null);

  useEffect(() => {
    setResolvedStrategy(variantStrategy);
  }, [variantStrategy]);

  useEffect(() => {
    setResolvedComposition(hasComposition);
  }, [hasComposition]);

  const stageOrderInput = useMemo(
    () => ({
      isMultiSku: resolvedStrategy === "MULTI_SKU",
      hasComposition: resolvedComposition,
    }),
    [resolvedComposition, resolvedStrategy]
  );

  const renderOrder = editorStageOrder(stageOrderInput);
  const renderIndex = Math.max(0, renderOrder.indexOf(stage));

  const handleSaved = useCallback(
    (savedItemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      if (!active) return;

      const multi =
        (savedDetail?.variant_strategy ?? resolvedStrategy ?? "SINGLE_SKU") === "MULTI_SKU";
      const composition = savedDetail?.is_bundle ?? resolvedComposition;
      if (savedDetail?.variant_strategy) {
        setResolvedStrategy(savedDetail.variant_strategy);
      }
      setResolvedComposition(composition);

      const order = editorStageOrder({
        isMultiSku: multi,
        hasComposition: composition,
      });
      const at = Math.max(0, order.indexOf(stage));
      const nav = navRef.current;
      navRef.current = { type: "primary" };

      if (nav.type === "exit") {
        onFinished(savedItemId);
        return;
      }
      if (nav.type === "stage") {
        setStage(nav.stage);
        return;
      }
      if (nav.type === "back") {
        const previous = order[at - 1];
        if (previous) {
          setStage(previous);
        } else {
          onFinished(savedItemId);
        }
        return;
      }
      const next = order[at + 1];
      if (next) {
        setStage(next);
      } else {
        onFinished(savedItemId);
      }
    },
    [active, onFinished, resolvedComposition, resolvedStrategy, stage]
  );

  const resetWizard = useCallback(() => {
    setStage("essentials");
    setResolvedStrategy(variantStrategy);
    setResolvedComposition(hasComposition);
    navRef.current = { type: "primary" };
  }, [hasComposition, variantStrategy]);

  const wizard: EditorWizardChrome | undefined = active
    ? {
        stage,
        isFirst: renderIndex === 0,
        isLast: renderIndex === renderOrder.length - 1,
        onBack: () => {
          const nav: WizardNav = { type: "back" };
          navRef.current = nav;
          submitRef.current?.(nav);
        },
        onSkip: () => {
          const nav: WizardNav = { type: "exit" };
          navRef.current = nav;
          submitRef.current?.(nav);
        },
        onPrimary: () => {
          const nav: WizardNav = { type: "primary" };
          navRef.current = nav;
          submitRef.current?.(nav);
        },
        onSelectStage: (nextStage) => {
          const nav: WizardNav = { type: "stage", stage: nextStage };
          navRef.current = nav;
          submitRef.current?.(nav);
        },
        registerSubmit: (fn) => {
          submitRef.current = fn;
        },
      }
    : undefined;

  const setStageFromParam = useCallback((param: string | null) => {
    if (isEditorStageId(param)) setStage(param);
  }, []);

  return useMemo(
    () => ({
      wizard,
      handleSaved,
      resetWizard,
      setStageFromParam,
      triggerPrimarySave: () => {
        const nav: WizardNav = { type: "primary" };
        navRef.current = nav;
        submitRef.current?.(nav);
      },
    }),
    [handleSaved, resetWizard, setStageFromParam, wizard]
  );
}
