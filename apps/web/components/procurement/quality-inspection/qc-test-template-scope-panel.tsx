"use client";

import { useEffect, useState, useTransition } from "react";
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
};

export function QcTestTemplateScopePanel({
  scopeType,
  scopeReferenceId,
  scopeLabel,
  readOnly = false,
  className,
}: Props) {
  const [form, setForm] = useState<QcTestTemplateFormState>(defaultQcTestTemplateFormState);
  const [initialForm, setInitialForm] = useState<QcTestTemplateFormState>(
    defaultQcTestTemplateFormState
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

    void loadQcTestTemplateForScope(scopeType, scopeReferenceId).then((result) => {
      if (cancelled) return;
      const next = qcTestTemplateFormFromTemplate(result.template);
      setForm(next);
      setInitialForm(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [scopeReferenceId, scopeType]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  if (!scopeReferenceId) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border/80 bg-muted/20 p-4", className)}>
        <p className="text-sm font-medium">QC test template</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Save this {scopeLabel} first, then define inspection tests here.
        </p>
      </div>
    );
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveQcTestTemplateForScope(scopeType, scopeReferenceId, form);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const next = qcTestTemplateFormFromTemplate(result.template);
      setForm(next);
      setInitialForm(next);
      toast.success("QC test template saved.");
    });
  };

  return (
    <div className={cn("space-y-3 rounded-lg border border-border bg-muted/15 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">QC test template</p>
          <p className="text-xs text-muted-foreground">
            Tests defined here apply during quality inspection for this {scopeLabel}.
            {scopeType === "ITEM"
              ? " Item templates override category templates."
              : " Category templates inherit up the tree when no item template exists."}
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
}
