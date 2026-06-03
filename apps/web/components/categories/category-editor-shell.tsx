"use client";

import { useMemo, type RefObject } from "react";
import { FolderTree, Tags } from "lucide-react";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import { AttributeTemplateBuilder } from "@/components/categories/attribute-template-builder";
import { AttributeTemplatePreview } from "@/components/categories/attribute-template-preview";
import { CategoryFormSkeleton } from "@/components/categories/category-form-skeleton";
import { EditorStepper } from "@/components/products/product-editor/editor-stepper";
import {
  CategoryFieldLabel,
  CategorySectionHeading,
  CategoryToggleLabel,
} from "@/components/categories/category-field-label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORY_EDITOR_STAGES,
  type CategoryEditorStageId,
} from "@/lib/categories/category-editor-stages";
import {
  categoryStageStatuses,
  categoryWizardPercent,
} from "@/lib/categories/category-stage-status";
import type { useCategoryForm } from "@/lib/categories/use-category-form";
import { CATEGORY_EDITOR_FIELD_HELP } from "@/lib/categories/category-editor-field-help";
import { CATEGORY_EDITOR_FORM_CLASS } from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

export type CategoryWizardChrome = {
  stage: CategoryEditorStageId;
  onSelectStage: (stage: CategoryEditorStageId) => void;
};

type FormApi = ReturnType<typeof useCategoryForm>;

export const CATEGORY_SECTION_BASICS_ID = "category-basics";
export const CATEGORY_SECTION_ATTRIBUTES_ID = "category-attributes";

export const CATEGORY_DRAWER_SECTIONS = [
  { id: CATEGORY_SECTION_BASICS_ID, label: "Basics", shortLabel: "Basics", icon: FolderTree },
  { id: CATEGORY_SECTION_ATTRIBUTES_ID, label: "Attributes", shortLabel: "Attrs", icon: Tags },
] as const;

type Props = {
  formApi: FormApi;
  editingCategoryId?: string | null;
  wizard?: CategoryWizardChrome;
  /** Stacked = all sections visible; wizard = one stage at a time (legacy). */
  layout?: "wizard" | "stacked" | "drawer";
  /** Full-page create/edit: scroll inside the form column. */
  fullPage?: boolean;
  readOnly?: boolean;
  activeSection?: string;
  onActiveSectionChange?: (id: string) => void;
  scrollRootRef?: RefObject<HTMLElement | null>;
  chipBarRef?: RefObject<HTMLDivElement | null>;
};

function Section({
  id,
  title,
  help,
  children,
  hidden,
}: {
  id?: string;
  title: string;
  help: string;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <CategorySectionHeading title={title} help={help} />
      {children}
    </section>
  );
}

export function CategoryEditorShell({
  formApi,
  editingCategoryId = null,
  wizard,
  layout = wizard ? "wizard" : "stacked",
  fullPage = false,
  readOnly = false,
  activeSection = CATEGORY_SECTION_BASICS_ID,
  onActiveSectionChange,
  scrollRootRef,
  chipBarRef,
}: Props) {
  const { form, setForm, error, isPending, parentOptions, inheritedPreview } = formApi;

  const isWizard = layout === "wizard" && Boolean(wizard);
  const isDrawer = layout === "drawer";
  const isCreate = !editingCategoryId;
  const activeStage = wizard?.stage ?? "basics";
  const hasParent = Boolean(form.parent_id);
  const fieldsDisabled = isPending || readOnly;

  const stageVisible = (stage: CategoryEditorStageId) =>
    !isWizard || activeStage === stage;

  const scrollableForm = fullPage || isWizard || isDrawer;
  const scrollToSection = (sectionId: string) => {
    onActiveSectionChange?.(sectionId);
    const root = scrollRootRef?.current;
    const target = root?.querySelector<HTMLElement>(`#${sectionId}`);
    if (root && target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const statuses = useMemo(() => categoryStageStatuses(form), [form]);
  const percent = useMemo(() => categoryWizardPercent(statuses), [statuses]);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col",
        scrollableForm && "h-full min-h-0 flex-1 overflow-hidden"
      )}
    >
      {isPending && (
        <div className="absolute inset-0 z-10 rounded-lg bg-background/80 p-4 backdrop-blur-sm">
          <CategoryFormSkeleton />
        </div>
      )}

      {isWizard ? (
        <div className="shrink-0 lg:hidden">
          <EditorStepper
            stages={CATEGORY_EDITOR_STAGES}
            activeStage={activeStage}
            statuses={statuses}
            percent={percent}
            onSelect={wizard?.onSelectStage}
            compact
            showDescription={false}
          />
        </div>
      ) : null}

      {isDrawer ? (
        <div className="shrink-0 border-b border-border/80 pb-2">
          <SectionScrollChipBar
            chips={CATEGORY_DRAWER_SECTIONS.map((s) => ({
              id: s.id,
              label: s.shortLabel,
              leading: <s.icon className="h-3.5 w-3.5" />,
            }))}
            activeId={activeSection}
            onSelect={scrollToSection}
            barRef={chipBarRef}
            embedded
            dense
          />
        </div>
      ) : null}

      <div
        className={cn(
          scrollableForm && "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          isWizard &&
            "gap-2 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-4"
        )}
      >
        {isWizard ? (
          <aside className="hidden shrink-0 lg:block">
            <div className="rounded-lg border border-border/60 bg-background/70 p-2">
              <EditorStepper
                stages={CATEGORY_EDITOR_STAGES}
                activeStage={activeStage}
                statuses={statuses}
                percent={percent}
                onSelect={wizard?.onSelectStage}
                vertical
                compact
                showDescription={false}
              />
            </div>
          </aside>
        ) : null}

        <div
          className={cn(
            CATEGORY_EDITOR_FORM_CLASS,
            "min-w-0 space-y-6",
            scrollableForm &&
              "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-16 md:pb-6 lg:pr-1",
            isDrawer && readOnly && "[&_input]:border-transparent [&_input]:bg-transparent [&_input]:shadow-none",
            isDrawer && !readOnly && "[&_input]:border-input"
          )}
        >
          <Section
            id={isDrawer ? CATEGORY_SECTION_BASICS_ID : undefined}
            title="Basics"
            help={CATEGORY_EDITOR_FIELD_HELP.sectionBasics}
            hidden={!stageVisible("basics")}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 items-end gap-x-4 gap-y-3 md:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <CategoryFieldLabel
                    label="Name"
                    htmlFor="cat-name"
                    help={CATEGORY_EDITOR_FIELD_HELP.name}
                  />
                  <Input
                    id="cat-name"
                    value={form.name}
                    placeholder="e.g. Shirts"
                    disabled={fieldsDisabled}
                    readOnly={readOnly}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="min-w-0 space-y-1.5">
                  <CategoryFieldLabel
                    label="Parent category"
                    help={CATEGORY_EDITOR_FIELD_HELP.parent}
                  />
                  <Select
                    value={form.parent_id ?? "root"}
                    disabled={fieldsDisabled}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, parent_id: value === "root" ? null : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None (top level)" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentOptions.map((opt) => (
                        <SelectItem key={opt.id ?? "root"} value={opt.id ?? "root"}>
                          {"—".repeat(opt.depth)}
                          {opt.depth > 0 ? " " : ""}
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 items-end gap-x-4 gap-y-3 md:grid-cols-2">
                {hasParent ? (
                  <div className="flex h-9 items-center justify-between gap-2">
                    <CategoryToggleLabel
                      label="Inherit attributes"
                      htmlFor="inherit-parent-attributes"
                      help={CATEGORY_EDITOR_FIELD_HELP.inheritAttributes}
                    />
                    <Switch
                      id="inherit-parent-attributes"
                      checked={form.inherit_parent_attributes}
                      disabled={fieldsDisabled}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({ ...f, inherit_parent_attributes: checked }))
                      }
                    />
                  </div>
                ) : null}

                {!isCreate ? (
                  <div className="flex h-9 items-center justify-between gap-2">
                    <CategoryToggleLabel
                      label="Active"
                      htmlFor="cat-active"
                      help={CATEGORY_EDITOR_FIELD_HELP.active}
                    />
                    <Switch
                      id="cat-active"
                      checked={form.is_active}
                      disabled={fieldsDisabled}
                      onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {hasParent && form.inherit_parent_attributes ? (
              <div className="mt-4 space-y-1.5">
                <CategoryFieldLabel
                  label="Inherited fields"
                  help={CATEGORY_EDITOR_FIELD_HELP.inheritedFields}
                />
                <AttributeTemplatePreview
                  templates={inheritedPreview}
                  emptyMessage="Parent categories have no attributes yet."
                />
              </div>
            ) : null}
          </Section>

          {!isWizard ? <Separator /> : null}

          <Section
            id={isDrawer ? CATEGORY_SECTION_ATTRIBUTES_ID : undefined}
            title="Attributes"
            help={CATEGORY_EDITOR_FIELD_HELP.sectionAttributes}
            hidden={!stageVisible("attributes")}
          >
            {readOnly ? (
              <AttributeTemplatePreview
                templates={form.attribute_templates}
                emptyMessage="No attribute templates defined."
              />
            ) : (
              <AttributeTemplateBuilder
                key={editingCategoryId ?? "create"}
                rows={form.attribute_templates}
                showAdvancedOptions
                onChange={(attribute_templates) =>
                  setForm((f) => ({ ...f, attribute_templates }))
                }
              />
            )}
          </Section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
