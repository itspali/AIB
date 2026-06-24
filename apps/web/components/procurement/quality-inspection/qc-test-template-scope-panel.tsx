"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  useTransition,
  type Ref,
} from "react";
import { toast } from "sonner";
import {
  loadQcTestTemplateForScope,
  saveQcTestTemplateForScope,
} from "@/app/(workspace)/procurement/quality-inspection/actions";
import { QcTestTemplateEditor } from "@/components/procurement/quality-inspection/qc-test-template-editor";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  defaultQcTestTemplateFormState,
  qcTestTemplateFormFromTemplate,
  resolveQcTestTemplateFormForSave,
  validateQcTestTemplateForm,
  type QcTestTemplateFormState,
} from "@/lib/procurement/quality-inspection/template-form";
import type { QcTestTemplateScope } from "@/lib/procurement/quality-inspection/template-queries";
import { cn } from "@/lib/utils";

type Props = {
  scopeType: QcTestTemplateScope;
  scopeReferenceId: string | null | undefined;
  scopeLabel: string;
  readOnly?: boolean;
  className?: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** Used when template name is blank but tests are defined (e.g. category/item name). */
  defaultTemplateName?: string | null;
};

export type QcTestTemplateScopePanelHandle = {
  isDirty: () => boolean;
  saveIfDirty: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

export const QcTestTemplateScopePanel = forwardRef(function QcTestTemplateScopePanel(
  {
    scopeType,
    scopeReferenceId,
    scopeLabel,
    readOnly = false,
    className,
    onDirtyChange,
    defaultTemplateName,
  }: Props,
  ref: Ref<QcTestTemplateScopePanelHandle>
) {
  const [form, setForm] = useState<QcTestTemplateFormState>(() => defaultQcTestTemplateFormState());
  const [initialForm, setInitialForm] = useState<QcTestTemplateFormState>(() =>
    defaultQcTestTemplateFormState()
  );
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!scopeReferenceId) {
      setForm(defaultQcTestTemplateFormState());
      setInitialForm(defaultQcTestTemplateFormState());
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadQcTestTemplateForScope(scopeType, scopeReferenceId)
      .then((result) => {
        if (cancelled) return;
        const next = qcTestTemplateFormFromTemplate(result.template);
        setForm(next);
        setInitialForm(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        toast.error("Could not load inspection tests.");
      });

    return () => {
      cancelled = true;
    };
  }, [scopeReferenceId, scopeType]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const persistTemplate = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    if (!scopeReferenceId) {
      return { ok: false, error: "Save the record before defining inspection tests." };
    }

    const formToSave = resolveQcTestTemplateFormForSave(form, { defaultTemplateName });

    const validationError = validateQcTestTemplateForm(formToSave);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const result = await saveQcTestTemplateForScope(scopeType, scopeReferenceId, formToSave);
    if ("error" in result) {
      return { ok: false, error: result.error ?? "Could not save inspection tests." };
    }

    const next = qcTestTemplateFormFromTemplate(result.template);
    setForm(next);
    setInitialForm(next);
    return { ok: true };
  }, [defaultTemplateName, form, scopeReferenceId, scopeType]);

  const saveIfDirty = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    if (!isDirty) return { ok: true };
    return persistTemplate();
  }, [isDirty, persistTemplate]);

  useImperativeHandle(
    ref,
    () => ({
      isDirty: () => isDirty,
      saveIfDirty,
    }),
    [isDirty, saveIfDirty]
  );

  if (!scopeReferenceId) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border/80 bg-muted/20 p-4", className)}>
        <p className="text-sm font-medium">Inspection tests</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Save this {scopeLabel} first, then define inspection tests here.
        </p>
      </div>
    );
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await persistTemplate();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Inspection tests saved.");
      } catch {
        toast.error("Could not save inspection tests.");
      }
    });
  };

  return (
    <div className={cn("space-y-3 rounded-lg border border-border bg-muted/15 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Inspection tests</p>
            {!readOnly && isDirty ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Unsaved
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Tests defined here apply during quality inspection for this {scopeLabel}.
            {scopeType === "ITEM"
              ? " Item templates override category templates."
              : " Category templates inherit up the tree when no item template exists."}
            {!readOnly ? " Saved with Save template or Save changes." : null}
          </p>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            disabled={loading || isPending || !isDirty}
            onClick={handleSave}
          >
            {isPending ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5" />
                Saving…
              </>
            ) : (
              "Save template"
            )}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Loading template…
        </div>
      ) : (
        <QcTestTemplateEditor
          value={form}
          onChange={setForm}
          readOnly={readOnly}
          disabled={isPending}
        />
      )}
    </div>
  );
});
