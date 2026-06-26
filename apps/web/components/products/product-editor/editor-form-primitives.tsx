"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabelInfo, mergeFieldLabelInfo } from "@/components/ui/field-label-info";
import { ITEM_EDITOR_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import type { UomOption } from "@/lib/products/uom-options";
import {
  editorFieldSpanFullClass,
  editorPageSectionClass,
  editorPanelScrollMarginClass,
  editorPanelSectionClass,
  editorSectionBodyClass,
  editorSectionDisclosureButtonClass,
  editorSectionDisclosureLineClass,
  editorSectionDisclosureRowClass,
  editorSectionHeadingClass,
  editorSwitchSize,
  useEditorPanelLayout,
} from "@/lib/products/editor-chrome";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import { cn } from "@/lib/utils";

export function editorCardClassName(panel: boolean, variant: "summary" | "section" = "section") {
  return panel ? editorPanelSectionClass() : editorPageSectionClass(variant);
}

export function EditorField({
  label,
  htmlFor,
  error,
  hint,
  info,
  full,
  locked,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  info?: React.ReactNode;
  full?: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const panel = useEditorPanelLayout();
  const labelInfo = mergeFieldLabelInfo(
    hint && !error ? <p>{hint}</p> : null,
    locked && !error ? <p>{ITEM_EDITOR_FIELD_HELP.lockedField}</p> : null,
    info
  );

  return (
    <div
      className={cn(
        "min-w-0",
        panel ? "space-y-1.5" : "space-y-2",
        full && editorFieldSpanFullClass(panel)
      )}
    >
      <div className="flex items-center gap-1.5">
        <Label
          htmlFor={htmlFor}
          className={cn("font-medium text-muted-foreground", panel ? "text-xs" : "text-sm")}
        >
          {label}
        </Label>
        {labelInfo ? <FieldLabelInfo label={label}>{labelInfo}</FieldLabelInfo> : null}
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
            <Lock className="h-2.5 w-2.5" aria-hidden />
            Locked
          </span>
        ) : null}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function EditorCommerceUnitField({
  label,
  stockUom,
  value,
  options,
  fieldDisabled,
  onUnitChange,
  conversionHint,
  info,
}: {
  label: string;
  stockUom: string;
  value: string;
  options: UomOption[];
  fieldDisabled: boolean;
  onUnitChange: (code: string) => void;
  conversionHint?: string;
  info?: React.ReactNode;
}) {
  const selectId = `${label.replace(/\s+/g, "-").toLowerCase()}-uom`;
  const usesAlternate = value !== stockUom;

  return (
    <EditorField
      label={label}
      hint={
        usesAlternate ? conversionHint : ITEM_EDITOR_FIELD_HELP.usingBaseUnit(stockUom)
      }
      info={info}
    >
      <Select value={value} disabled={fieldDisabled} onValueChange={onUnitChange}>
        <SelectTrigger id={selectId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.code}
              {option.name && option.name !== option.code ? ` · ${option.name}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </EditorField>
  );
}

export function EditorToggleRow({
  label,
  description,
  info,
  checked,
  disabled,
  onCheckedChange,
  variant = "grid",
}: {
  label: string;
  description?: string;
  info?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  variant?: "grid" | "inline";
}) {
  const panel = useEditorPanelLayout();
  const inline = variant === "inline";
  const labelInfo = mergeFieldLabelInfo(
    description && !panel && !inline ? <p>{description}</p> : null,
    info
  );

  return (
    <div
      className={cn(
        "editor-toggle-row flex items-center justify-between gap-2",
        !inline && panel && editorFieldSpanFullClass(panel),
        inline && "shrink-0 gap-2.5 py-0",
        !inline && panel && "py-0.5",
        !inline && !panel && "rounded-lg border border-border px-3 py-2"
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 pr-2">
        <p className={cn("font-medium leading-snug", panel ? "text-xs" : "text-sm")}>{label}</p>
        {labelInfo ? <FieldLabelInfo label={label}>{labelInfo}</FieldLabelInfo> : null}
      </div>
      <Switch
        size={editorSwitchSize}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function EditorSectionAdvanced({
  open,
  onToggle,
  panel,
  children,
  variant = "advanced",
}: {
  open: boolean;
  onToggle: () => void;
  panel: boolean;
  children: React.ReactNode;
  variant?: "advanced" | "more";
}) {
  const showLabel = variant === "more" ? "Show more" : "Show advanced";
  const hideLabel = variant === "more" ? "Hide more" : "Hide advanced";

  return (
    <div className={cn("col-span-full", panel ? "space-y-2" : "space-y-3")}>
      <div className={editorSectionDisclosureRowClass()}>
        <div className={editorSectionDisclosureLineClass()} aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={editorSectionDisclosureButtonClass(panel)}
          onClick={onToggle}
        >
          {open ? hideLabel : showLabel}
        </Button>
      </div>
      {open ? (
        <div
          className={cn(
            variant === "more"
              ? panel
                ? "flex flex-col gap-6"
                : "flex flex-col gap-8"
              : panel
                ? "space-y-4"
                : "space-y-5"
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type SectionHeaderToggleProps = {
  label: string;
  description?: string;
  info?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function SectionHeaderToggle({
  label,
  checked,
  disabled,
  onCheckedChange,
}: Pick<SectionHeaderToggleProps, "label" | "checked" | "disabled" | "onCheckedChange">) {
  return (
    <Switch
      size={editorSwitchSize}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={label}
    />
  );
}

/** Anchored section card; registers its element with the parent scroll-spy. */
export function EditorSectionBlock({
  id,
  title,
  description,
  headerToggle,
  registerRef,
  panel = false,
  hidden = false,
  hideTitle = false,
  children,
}: {
  id: EditorSectionId;
  title: string;
  description?: string;
  headerToggle?: SectionHeaderToggleProps;
  registerRef: (el: HTMLDivElement | null) => void;
  panel?: boolean;
  hidden?: boolean;
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  const titleInfo = headerToggle
    ? mergeFieldLabelInfo(
        headerToggle.description ? <p>{headerToggle.description}</p> : null,
        headerToggle.info
      )
    : null;

  return (
    <div
      ref={registerRef}
      data-section={id}
      className={cn("scroll-mt-20", panel && editorPanelScrollMarginClass())}
    >
      <section className={editorCardClassName(panel, "section")}>
        {!hideTitle ? (
          <div className={editorSectionHeadingClass(panel)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h3
                    className={cn(
                      "font-semibold",
                      panel
                        ? "text-sm text-foreground"
                        : "text-sm uppercase tracking-wide text-foreground"
                    )}
                  >
                    {title}
                  </h3>
                  {titleInfo ? <FieldLabelInfo label={title}>{titleInfo}</FieldLabelInfo> : null}
                </div>
                {description && !panel ? (
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {headerToggle ? (
                <SectionHeaderToggle
                  label={headerToggle.label}
                  checked={headerToggle.checked}
                  disabled={headerToggle.disabled}
                  onCheckedChange={headerToggle.onCheckedChange}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={cn(editorSectionBodyClass(panel), hideTitle && panel && "!pt-0")}>
          {children}
        </div>
      </section>
    </div>
  );
}
