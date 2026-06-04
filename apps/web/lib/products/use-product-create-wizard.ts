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
  onFinished: (itemId: string) => void;
};

export function useProductCreateWizard({
  active,
  variantStrategy = "SINGLE_SKU",
  onFinished,
}: Options) {
  const [stage, setStage] = useState<EditorStageId>("essentials");
  const [resolvedStrategy, setResolvedStrategy] = useState(variantStrategy);
  const navRef = useRef<WizardNav>({ type: "primary" });
  const submitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setResolvedStrategy(variantStrategy);
  }, [variantStrategy]);

  const renderMultiSku = resolvedStrategy === "MULTI_SKU";
  const renderOrder = editorStageOrder(renderMultiSku);
  const renderIndex = Math.max(0, renderOrder.indexOf(stage));

  const handleSaved = useCallback(
    (savedItemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      if (!active) return;

      const multi =
        (savedDetail?.variant_strategy ?? resolvedStrategy ?? "SINGLE_SKU") === "MULTI_SKU";
      if (savedDetail?.variant_strategy) {
        setResolvedStrategy(savedDetail.variant_strategy);
      }
      const order = editorStageOrder(multi);
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
    [active, onFinished, resolvedStrategy, stage]
  );

  const resetWizard = useCallback(() => {
    setStage("essentials");
    setResolvedStrategy(variantStrategy);
    navRef.current = { type: "primary" };
  }, [variantStrategy]);

  const wizard: EditorWizardChrome | undefined = active
    ? {
        stage,
        isFirst: renderIndex === 0,
        isLast: renderIndex === renderOrder.length - 1,
        onBack: () => {
          navRef.current = { type: "back" };
          submitRef.current?.();
        },
        onSkip: () => {
          navRef.current = { type: "exit" };
          submitRef.current?.();
        },
        onPrimary: () => {
          navRef.current = { type: "primary" };
          submitRef.current?.();
        },
        onSelectStage: (nextStage) => {
          navRef.current = { type: "stage", stage: nextStage };
          submitRef.current?.();
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
        navRef.current = { type: "primary" };
        submitRef.current?.();
      },
    }),
    [handleSaved, resetWizard, setStageFromParam, wizard]
  );
}
