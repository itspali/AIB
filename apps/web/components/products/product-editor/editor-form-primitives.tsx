"use client";

import { ChevronDown, Lock } from "lucide-react";
import { useState } from "react";
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
import {
  EditorFieldInlineHint,
  useEditorFieldHelp,
} from "@/components/products/product-editor/editor-field-help";
import { ITEM_EDITOR_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import type { UomOption } from "@/lib/products/uom-options";
import {
  editorCardClassName,
  editorFieldLabelClass,
  editorFieldSpanFullClass,
  editorGlassSectionBodyClass,
  editorPanelScrollMarginClass,
  editorSectionBodyClass,
  editorSectionDisclosureButtonClass,
  editorSectionDisclosureLineClass,
  editorSectionDisclosureRowClass,
  editorSectionHeadingClass,
  editorSwitchSize,
  useEditorGlassSections,
  useEditorPanelLayout,
} from "@/lib/products/editor-chrome";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import { cn } from "@/lib/utils";

export { editorCardClassName } from "@/lib/products/editor-chrome";

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
  const showFieldHelp = useEditorFieldHelp();
  const labelInfo = mergeFieldLabelInfo(
    hint && !error && !showFieldHelp && !info ? <p>{hint}</p> : null,
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
        <Label htmlFor={htmlFor} className={editorFieldLabelClass(panel)}>
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
      {showFieldHelp && hint && !error ? <EditorFieldInlineHint>{hint}</EditorFieldInlineHint> : null}
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
  const showFieldHelp = useEditorFieldHelp();
  const inline = variant === "inline";
  const labelInfo = mergeFieldLabelInfo(
    description && !panel && !inline && !showFieldHelp ? <p>{description}</p> : null,
    info
  );

  return (
    <div
      className={cn(
        "editor-toggle-row flex items-start justify-between gap-2",
        !inline && panel && editorFieldSpanFullClass(panel),
        inline && "shrink-0 items-center gap-2.5 py-0",
        !inline && panel && "py-0.5",
        !inline && !panel && "rounded-lg border border-border px-3 py-2"
      )}
    >
      <div className="min-w-0 flex-1 pr-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className={cn("font-medium leading-snug", panel ? "text-xs" : "text-sm")}>{label}</p>
          {labelInfo ? <FieldLabelInfo label={label}>{labelInfo}</FieldLabelInfo> : null}
        </div>
        {showFieldHelp && description ? (
          <EditorFieldInlineHint className={inline ? "mt-0.5" : "mt-1"}>{description}</EditorFieldInlineHint>
        ) : null}
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

/** Always-visible grouped panel (pricing, inventory, purchasing) — no extra click to expand. */
export function EditorGroupedPanel({
  title,
  description,
  headerAside,
  children,
  className,
}: {
  title: string;
  description?: string;
  headerAside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const panel = useEditorPanelLayout();
  const glass = useEditorGlassSections();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60",
        glass && panel ? "bg-muted/15 dark:bg-muted/10" : "bg-muted/20 dark:bg-muted/15",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/50 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="text-xs leading-snug text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
      </div>
      <div className="space-y-3 px-3 py-3 sm:px-4">{children}</div>
    </div>
  );
}

/** Collapsible inset card for optional Essentials groups (units, tax, pricing, etc.). */
export function EditorExpandableCard({
  title,
  description,
  defaultOpen = false,
  headerAside,
  children,
  className,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  headerAside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panel = useEditorPanelLayout();
  const glass = useEditorGlassSections();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60",
        glass && panel ? "bg-muted/15 dark:bg-muted/10" : "bg-muted/20 dark:bg-muted/15",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/50 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description ? (
              <p className="text-xs leading-snug text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </button>
        {headerAside ? (
          <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
            {headerAside}
          </div>
        ) : null}
      </div>
      {open ? <div className="space-y-3 px-3 py-3 sm:px-4">{children}</div> : null}
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
  const glassSections = useEditorGlassSections();
  const useGlassCard = panel && glassSections;

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
      <section className={editorCardClassName(panel, "section", { glass: useGlassCard })}>
        {!hideTitle && useGlassCard ? (
          <div className="space-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h3 className="text-sm font-medium text-foreground">{title}</h3>
                  {titleInfo ? <FieldLabelInfo label={title}>{titleInfo}</FieldLabelInfo> : null}
                </div>
                {description ? (
                  <p className="text-xs text-muted-foreground">{description}</p>
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
        ) : !hideTitle ? (
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
        <div
          className={cn(
            useGlassCard ? editorGlassSectionBodyClass() : editorSectionBodyClass(panel),
            hideTitle && panel && !useGlassCard && "!pt-0"
          )}
        >
          {children}
        </div>
      </section>
    </div>
  );
}
