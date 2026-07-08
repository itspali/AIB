"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { FieldErrors, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { CompositionCommitResult } from "@/components/products/product-editor/composition-editor";
import type { EditorWizardChrome } from "@/components/products/product-editor/product-editor-shell";
import type { ProductPanelMutationHeader } from "@/components/products/product-panel-form";
import type {
  ReachPersistFailures,
  VariantAssortmentMatrixHandle,
} from "@/components/products/variant-assortment-matrix";
import type { VariantOpeningStockMatrixHandle } from "@/components/products/variant-opening-stock-matrix";
import type {
  VariantMatrixCommitResult,
  VariantMatrixDraftState,
  VariantCompositionMode,
} from "@/components/products/variant-matrix-generator";
import type { EditorStageId } from "@/lib/products/editor-stages";
import {
  canEssentialsWizardFastAdvance,
  EDITOR_FIELD_SECTION,
  essentialsCreatePrimaryLabel,
  resolveEssentialsWizardAdvance,
  type ItemSavedOptions,
  type SectionId,
} from "@/lib/products/item-editor/editor-shell-shared";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import type {
  ProductCatalogContext,
  ProductDetailSnapshot,
  ProductMasterFormValues,
} from "@/lib/products/types";
import { detailToFormValues } from "@/lib/products/types";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import { SAVE_ITEM_LABEL, UPDATE_ITEM_LABEL } from "@/lib/products/product-user-labels";

export type UseItemEditorSaveOrchestrationInput = {
  mode: ProductFormMode;
  isPanelLayout: boolean;
  readOnly: boolean;
  wizard?: EditorWizardChrome;
  wizardSteps: boolean;
  activeWizardStage: EditorStageId | null;
  variantCompositionMode: VariantCompositionMode;
  isMultiSku: boolean;
  hasComposition: boolean;
  isDirty: boolean;
  isPending: boolean;
  isNavigatePending?: boolean;
  itemId: string | null;
  detail?: ProductDetailSnapshot | null;
  catalogContext: ProductCatalogContext;
  form: UseFormReturn<ProductMasterFormValues>;
  getValues: UseFormReturn<ProductMasterFormValues>["getValues"];
  setValue: UseFormReturn<ProductMasterFormValues>["setValue"];
  handleSubmit: UseFormReturn<ProductMasterFormValues>["handleSubmit"];
  onSubmit: (values: ProductMasterFormValues) => void | Promise<void>;
  onSaved: (
    itemId: string,
    detail?: ProductDetailSnapshot | null,
    options?: ItemSavedOptions
  ) => void;
  onCancel: () => void;
  onMutationHeaderChange?: (header: ProductPanelMutationHeader | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  compositionDraft: VariantMatrixDraftState | null;
  compositionSectionDirty: boolean;
  trackInventory: boolean;
  trackingMode: ProductMasterFormValues["tracking_mode"];
  scrollToSection: (id: SectionId) => void;
  scrollToSectionRef: RefObject<(id: SectionId) => void>;
  itemSavedHandlerRef: RefObject<
    (
      savedId: string,
      savedDetail?: ProductDetailSnapshot | null,
      options?: ItemSavedOptions
    ) => Promise<boolean>
  >;
  pendingSaveOptionsRef: RefObject<ItemSavedOptions | undefined>;
  locationMatrixRef: RefObject<VariantAssortmentMatrixHandle | null>;
  openingStockMatrixRef: RefObject<VariantOpeningStockMatrixHandle | null>;
  variantCommitRef: RefObject<(() => Promise<VariantMatrixCommitResult>) | null>;
  compositionCommitRef: RefObject<(() => Promise<CompositionCommitResult>) | null>;
};

export function useItemEditorSaveOrchestration({
  mode,
  isPanelLayout,
  readOnly,
  wizard,
  wizardSteps,
  activeWizardStage,
  variantCompositionMode,
  isMultiSku,
  hasComposition,
  isDirty,
  isPending,
  isNavigatePending = false,
  itemId,
  detail,
  catalogContext,
  form,
  getValues,
  setValue,
  handleSubmit,
  onSubmit,
  onSaved,
  onCancel,
  onMutationHeaderChange,
  onDirtyChange,
  compositionDraft,
  compositionSectionDirty,
  trackInventory,
  trackingMode,
  scrollToSection,
  scrollToSectionRef,
  itemSavedHandlerRef,
  pendingSaveOptionsRef,
  locationMatrixRef,
  openingStockMatrixRef,
  variantCommitRef,
  compositionCommitRef,
}: UseItemEditorSaveOrchestrationInput) {
  const [reachSaveErrors, setReachSaveErrors] = useState<ReachPersistFailures | null>(null);
  const [wizardSubmitPending, setWizardSubmitPending] = useState(false);
  const onSavedParentRef = useRef(onSaved);
  onSavedParentRef.current = onSaved;

  const itemSaveLabel = mode === "edit" ? UPDATE_ITEM_LABEL : SAVE_ITEM_LABEL;

  itemSavedHandlerRef.current = async (savedId, savedDetail, options) => {
    setReachSaveErrors(null);
    if (savedId && locationMatrixRef.current) {
      const persistResult = await locationMatrixRef.current.persist({
        storefrontVisibility: getValues("storefront_visibility"),
      });
      if (!persistResult.ok) {
        setReachSaveErrors(persistResult.failures);
        scrollToSectionRef.current("visibility");
        onSavedParentRef.current?.(savedId, savedDetail ?? null, options);
        return false;
      }
    }
    if (
      savedId &&
      trackInventory &&
      trackingMode === "NONE" &&
      openingStockMatrixRef.current
    ) {
      const openingResult = await openingStockMatrixRef.current.persist();
      if (!openingResult.ok) {
        setReachSaveErrors(openingResult.failures);
        scrollToSectionRef.current("visibility");
        onSavedParentRef.current?.(savedId, savedDetail ?? null, options);
        return false;
      }
    }
    const resolved = options ?? pendingSaveOptionsRef.current;
    pendingSaveOptionsRef.current = undefined;
    onSavedParentRef.current?.(savedId, savedDetail ?? null, resolved);
    return true;
  };

  const onInvalid = useCallback(
    (formErrors: FieldErrors<ProductMasterFormValues>) => {
      const firstField = Object.keys(formErrors)[0] as
        | keyof ProductMasterFormValues
        | undefined;
      const target = firstField ? EDITOR_FIELD_SECTION[firstField] : undefined;
      if (target) scrollToSection(target);
      toast.error("Please fix the highlighted fields before saving.");
    },
    [scrollToSection]
  );

  const handleSave = useMemo(
    () => handleSubmit(onSubmit, onInvalid),
    [handleSubmit, onSubmit, onInvalid]
  );

  const submitRef = useRef(handleSave);
  submitRef.current = handleSave;

  const submitPending = isPending || wizardSubmitPending;

  const essentialsAdvanceInput = useMemo(
    () => ({
      itemId,
      isDirty,
      compositionDraftDirty: compositionDraft?.isDirty,
      compositionSectionDirty,
    }),
    [compositionDraft?.isDirty, compositionSectionDirty, isDirty, itemId]
  );

  const wizardPrimaryLabel = useMemo(() => {
    const essentialsLabel = essentialsCreatePrimaryLabel({
      createEssentialsWizard: wizardSteps,
      activeWizardStage,
      itemId,
      isDirty,
      compositionDraftDirty: compositionDraft?.isDirty,
      submitPending,
    });
    if (essentialsLabel) return essentialsLabel;

    if (submitPending) {
      if (activeWizardStage === "essentials" && variantCompositionMode === "draft") {
        return "Saving variants…";
      }
      if (activeWizardStage === "composition") {
        return "Saving composition…";
      }
      return "Saving…";
    }
    if (!wizard) return itemSaveLabel;
    if (wizard.isLast) return "Finish";
    if (mode === "create") return "Next";
    if (wizard.isFirst) return "Save & continue";
    return "Continue";
  }, [
    activeWizardStage,
    isDirty,
    itemId,
    itemSaveLabel,
    mode,
    submitPending,
    variantCompositionMode,
    wizard,
    wizardSteps,
    compositionDraft?.isDirty,
  ]);

  useEffect(() => {
    wizard?.registerSubmit((nav) => {
      void (async () => {
        setWizardSubmitPending(true);
        try {
          if (nav.type === "back" && !isDirty && itemId) {
            onSaved(itemId, detail);
            return;
          }

          const essentialsAdvance =
            nav.type === "primary" &&
            wizardSteps &&
            activeWizardStage === "essentials" &&
            resolveEssentialsWizardAdvance(essentialsAdvanceInput);

          if (
            nav.type === "primary" &&
            wizardSteps &&
            activeWizardStage === "essentials" &&
            itemId &&
            canEssentialsWizardFastAdvance(essentialsAdvanceInput)
          ) {
            onSaved(itemId, detail, { advanceWizard: true });
            return;
          }

          pendingSaveOptionsRef.current = {
            advanceWizard: essentialsAdvance,
          };

          const shouldPersistProfileBeforeVariantCommit =
            nav.type === "primary" &&
            activeWizardStage === "essentials" &&
            variantCompositionMode === "draft" &&
            Boolean(variantCommitRef.current) &&
            itemId &&
            isDirty;

          let profilePersistedBeforeVariants = false;
          if (shouldPersistProfileBeforeVariantCommit) {
            const resumeAdvance = pendingSaveOptionsRef.current;
            pendingSaveOptionsRef.current = { advanceWizard: false };
            await handleSave();
            profilePersistedBeforeVariants = true;
            pendingSaveOptionsRef.current = resumeAdvance;
          }

          let committedDetail: ProductDetailSnapshot | undefined;

          if (
            activeWizardStage === "essentials" &&
            variantCompositionMode === "draft" &&
            variantCommitRef.current
          ) {
            const result = await variantCommitRef.current();
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            if (result.updatedAt) {
              setValue("updated_at", result.updatedAt, { shouldDirty: false });
            }
            committedDetail = result.detail;
          }

          if (
            nav.type === "primary" &&
            activeWizardStage === "composition" &&
            hasComposition &&
            compositionCommitRef.current
          ) {
            const result = await compositionCommitRef.current();
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            if (!isDirty && itemId) {
              onSaved(itemId, detail);
              return;
            }
          }

          const skipProfileSave =
            nav.type === "primary" &&
            activeWizardStage === "essentials" &&
            variantCompositionMode === "draft" &&
            Boolean(committedDetail) &&
            itemId &&
            (!isDirty || profilePersistedBeforeVariants);

          if (skipProfileSave && committedDetail) {
            const hydrated = {
              ...detailToFormValues(committedDetail),
              storefront_visibility: mergeStorefrontVisibility(
                catalogContext.storefronts,
                detailToFormValues(committedDetail).storefront_visibility
              ),
            };
            form.reset(hydrated);
            const navOptions = pendingSaveOptionsRef.current;
            pendingSaveOptionsRef.current = undefined;
            onSaved(itemId, committedDetail, navOptions);
            return;
          }

          await handleSave();
        } finally {
          setWizardSubmitPending(false);
        }
      })();
    });
  }, [
    activeWizardStage,
    wizard,
    catalogContext.storefronts,
    detail,
    form,
    handleSave,
    hasComposition,
    wizardSteps,
    compositionDraft,
    compositionSectionDirty,
    isDirty,
    isMultiSku,
    itemId,
    mode,
    onSaved,
    pendingSaveOptionsRef,
    setValue,
    variantCompositionMode,
    variantCommitRef,
    compositionCommitRef,
    essentialsAdvanceInput,
  ]);

  useEffect(() => {
    if (!onMutationHeaderChange || !isPanelLayout || readOnly) {
      onMutationHeaderChange?.(null);
      return;
    }

    if (wizard && wizardSteps) {
      onMutationHeaderChange({
        variant: "wizard",
        isFirst: wizard.isFirst,
        isLast: wizard.isLast,
        onBack: wizard.onBack,
        onCancel,
        onSkip: wizard.onSkip,
        onPrimary: wizard.onPrimary,
        isPending: submitPending,
        isNavigatePending,
        primaryLabel: wizardPrimaryLabel,
      });
      return () => onMutationHeaderChange(null);
    }

    onMutationHeaderChange({
      variant: "edit",
      onCancel,
      onSave: () => {
        void handleSave();
      },
      isPending: submitPending,
      isNavigatePending,
      saveLabel: submitPending ? "Saving…" : itemSaveLabel,
    });
    return () => onMutationHeaderChange(null);
  }, [
    itemSaveLabel,
    onMutationHeaderChange,
    isPanelLayout,
    readOnly,
    wizard,
    wizardSteps,
    onCancel,
    handleSave,
    submitPending,
    isNavigatePending,
    wizardPrimaryLabel,
  ]);

  const panelPrimaryAction = useMemo(() => {
    if (readOnly || !isPanelLayout) return null;
    if (wizard && wizardSteps) return null;
    return {
      label: submitPending ? "Saving…" : itemSaveLabel,
      onClick: () => {
        void handleSave();
      },
    };
  }, [
    itemSaveLabel,
    readOnly,
    isPanelLayout,
    wizard,
    wizardSteps,
    submitPending,
    handleSave,
  ]);

  useEffect(() => {
    onDirtyChange?.(
      isDirty || Boolean(compositionDraft?.isDirty) || compositionSectionDirty
    );
  }, [compositionDraft?.isDirty, compositionSectionDirty, isDirty, onDirtyChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (readOnly) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void submitRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly]);

  const reachLocationsPersistErrorMessage = useMemo(() => {
    if (!reachSaveErrors) return undefined;
    const parts = [
      reachSaveErrors.locations,
      reachSaveErrors.reorder,
      reachSaveErrors.channels,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : undefined;
  }, [reachSaveErrors]);

  const reachOpeningPersistErrorMessage = reachSaveErrors?.opening;
  const reachOpeningPersistErrorAction = reachSaveErrors?.openingAction;

  return {
    handleSave,
    submitPending,
    wizardPrimaryLabel,
    panelPrimaryAction,
    reachLocationsPersistErrorMessage,
    reachOpeningPersistErrorMessage,
    reachOpeningPersistErrorAction,
  };
}
