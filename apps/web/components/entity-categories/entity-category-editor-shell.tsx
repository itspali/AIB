"use client";

import type { RefObject } from "react";
import { FolderTree, Tags } from "lucide-react";
import { AttributeTemplateBuilder } from "@/components/categories/attribute-template-builder";
import { AttributeTemplatePreview } from "@/components/categories/attribute-template-preview";
import { CategoryFormSkeleton } from "@/components/categories/category-form-skeleton";
import {
  CategoryFieldLabel,
  CategorySectionHeading,
  CategoryToggleLabel,
} from "@/components/categories/category-field-label";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
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
import { ENTITY_CATEGORY_EDITOR_FIELD_HELP } from "@/lib/entity-categories/entity-category-editor-field-help";
import type { useEntityCategoryForm } from "@/lib/entity-categories/use-entity-category-form";
import {
  CATEGORY_EDITOR_FORM_CLASS,
} from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

type FormApi = ReturnType<typeof useEntityCategoryForm>;

export const ENTITY_CATEGORY_SECTION_BASICS_ID = "entity-category-basics";
export const ENTITY_CATEGORY_SECTION_ATTRIBUTES_ID = "entity-category-attributes";

export const ENTITY_CATEGORY_DRAWER_SECTIONS = [
  { id: ENTITY_CATEGORY_SECTION_BASICS_ID, label: "Basics", shortLabel: "Basics", icon: FolderTree },
  {
    id: ENTITY_CATEGORY_SECTION_ATTRIBUTES_ID,
    label: "Attributes",
    shortLabel: "Attrs",
    icon: Tags,
  },
] as const;

type Props = {
  formApi: FormApi;
  editingCategoryId?: string | null;
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
}: {
  id?: string;
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <CategorySectionHeading title={title} help={help} />
      {children}
    </section>
  );
}

export function EntityCategoryEditorShell({
  formApi,
  editingCategoryId = null,
  readOnly = false,
  activeSection = ENTITY_CATEGORY_SECTION_BASICS_ID,
  onActiveSectionChange,
  scrollRootRef,
  chipBarRef,
}: Props) {
  const { form, setForm, error, isPending, parentOptions, inheritedPreview } = formApi;

  const isCreate = !editingCategoryId;
  const hasParent = Boolean(form.parent_id);
  const fieldsDisabled = isPending || readOnly;

  const scrollToSection = (sectionId: string) => {
    onActiveSectionChange?.(sectionId);
    const root = scrollRootRef?.current;
    const target = root?.querySelector<HTMLElement>(`#${sectionId}`);
    if (root && target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {isPending && (
        <div className="absolute inset-0 z-10 rounded-lg bg-background/80 p-4 backdrop-blur-sm">
          <CategoryFormSkeleton />
        </div>
      )}

      <div className="shrink-0 border-b border-border/80 pb-2">
        <SectionScrollChipBar
          chips={ENTITY_CATEGORY_DRAWER_SECTIONS.map((s) => ({
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

      <div
        className={cn(
          CATEGORY_EDITOR_FORM_CLASS,
          "min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-16 md:pb-6 lg:pr-1",
          readOnly && "[&_input]:border-transparent [&_input]:bg-transparent [&_input]:shadow-none",
          !readOnly && "[&_input]:border-input"
        )}
      >
        <Section
          id={ENTITY_CATEGORY_SECTION_BASICS_ID}
          title="Basics"
          help={ENTITY_CATEGORY_EDITOR_FIELD_HELP.sectionBasics}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 items-end gap-x-4 gap-y-3 md:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <CategoryFieldLabel
                  label="Name"
                  htmlFor="entity-cat-name"
                  help={ENTITY_CATEGORY_EDITOR_FIELD_HELP.name}
                />
                <Input
                  id="entity-cat-name"
                  value={form.name}
                  placeholder="e.g. Retail"
                  disabled={fieldsDisabled}
                  readOnly={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <CategoryFieldLabel
                  label="Parent category"
                  help={ENTITY_CATEGORY_EDITOR_FIELD_HELP.parent}
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
                    htmlFor="entity-inherit-parent-attributes"
                    help={ENTITY_CATEGORY_EDITOR_FIELD_HELP.inheritAttributes}
                  />
                  <Switch
                    id="entity-inherit-parent-attributes"
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
                    htmlFor="entity-cat-active"
                    help={ENTITY_CATEGORY_EDITOR_FIELD_HELP.active}
                  />
                  <Switch
                    id="entity-cat-active"
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
                help={ENTITY_CATEGORY_EDITOR_FIELD_HELP.inheritedFields}
              />
              <AttributeTemplatePreview
                templates={inheritedPreview}
                emptyMessage="Parent categories have no attributes yet."
              />
            </div>
          ) : null}
        </Section>

        <Separator />

        <Section
          id={ENTITY_CATEGORY_SECTION_ATTRIBUTES_ID}
          title="Attributes"
          help={ENTITY_CATEGORY_EDITOR_FIELD_HELP.sectionAttributes}
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
              showAdvancedOptions={false}
              onChange={(attribute_templates) =>
                setForm((f) => ({ ...f, attribute_templates }))
              }
            />
          )}
        </Section>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
