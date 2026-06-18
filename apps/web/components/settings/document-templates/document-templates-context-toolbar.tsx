"use client";

import { FileText, Printer } from "lucide-react";
import {
  DocumentLayoutScopeSelect,
  type DocumentLayoutLocationOption,
} from "@/components/settings/document-layout/document-layout-scope-select";
import type { DocumentLayoutEmbeddedToolbarActions } from "@/components/settings/document-layout/document-layout-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PresentationModuleDefinition } from "@/lib/documents/print/types";
import type { DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

export type TemplateDesignerViewContext = DocumentViewContext;

const OUTPUT_CONTEXT_TABS: { id: TemplateDesignerViewContext; label: string }[] = [
  { id: "SCREEN_GRID", label: "On-screen" },
  { id: "PDF_PRINT", label: "Print" },
  { id: "EMAIL_HTML", label: "Email PDF" },
];

const DESIGNER_TABS = [
  { id: "fields" as const, label: "Fields" },
  { id: "appearance" as const, label: "Appearance" },
];

const TOOLBAR_SEGMENT_LIST =
  "h-8 w-auto shrink-0 flex-nowrap rounded-lg border border-border/60 bg-muted/25 p-0.5 shadow-none";

const TOOLBAR_SEGMENT_TRIGGER =
  "h-7 rounded-md border border-transparent px-2.5 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary/35 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-primary/20";

const TOOLBAR_SELECT_TRIGGER =
  "border-primary/35 bg-primary/10 font-medium text-primary shadow-none hover:bg-primary/15 focus:border-primary/45 focus:ring-primary/20 disabled:border-border/60 disabled:bg-muted/30 disabled:font-normal disabled:text-muted-foreground";

function ToolbarDivider() {
  return <div className="h-5 w-px shrink-0 bg-border/80" aria-hidden />;
}

type Props = {
  modules: PresentationModuleDefinition[];
  selectedModuleKey: DocumentModuleKey;
  onModuleChange: (moduleKey: DocumentModuleKey) => void;
  viewContext: TemplateDesignerViewContext;
  onViewContextChange: (viewContext: TemplateDesignerViewContext) => void;
  scope: DocumentLayoutScope;
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  onScopeChange: (scope: DocumentLayoutScope) => void;
  designerTab: "fields" | "appearance";
  onDesignerTabChange: (tab: "fields" | "appearance") => void;
  fieldToolbarActions: DocumentLayoutEmbeddedToolbarActions | null;
};

function ModuleTabIcon({ printable }: { printable: boolean }) {
  return printable ? (
    <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden />
  ) : (
    <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
  );
}

function FieldToolbarButtons({
  actions,
}: {
  actions: DocumentLayoutEmbeddedToolbarActions | null;
}) {
  if (!actions) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={actions.disabled}
        onClick={actions.onReset}
      >
        Reset
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-7 px-2.5 text-xs"
        disabled={actions.disabled}
        onClick={actions.onSave}
      >
        {actions.saveLabel}
      </Button>
    </div>
  );
}

function ModuleSelect({
  modules,
  selectedModuleKey,
  onModuleChange,
  className,
}: {
  modules: PresentationModuleDefinition[];
  selectedModuleKey: DocumentModuleKey;
  onModuleChange: (moduleKey: DocumentModuleKey) => void;
  className?: string;
}) {
  const selectedModule =
    modules.find((module) => module.moduleKey === selectedModuleKey) ?? modules[0] ?? null;

  return (
    <Select
      value={selectedModuleKey}
      onValueChange={(value) => onModuleChange(value as DocumentModuleKey)}
    >
      <SelectTrigger
        className={cn("h-8 min-w-0 text-xs", TOOLBAR_SELECT_TRIGGER, className)}
        aria-label="Document type"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {selectedModule ? <ModuleTabIcon printable={selectedModule.printable} /> : null}
          <span className="truncate">{selectedModule?.label ?? "Document"}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {modules.map((module) => (
          <SelectItem key={module.moduleKey} value={module.moduleKey}>
            <span className="flex items-center gap-1.5">
              <ModuleTabIcon printable={module.printable} />
              {module.label}
              {!module.printable ? (
                <Badge variant="administrative" className="text-[9px]">
                  Layout
                </Badge>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function OutputContextTabs({
  viewContext,
  onViewContextChange,
}: {
  viewContext: TemplateDesignerViewContext;
  onViewContextChange: (viewContext: TemplateDesignerViewContext) => void;
}) {
  return (
    <Tabs
      value={viewContext}
      onValueChange={(value) => onViewContextChange(value as TemplateDesignerViewContext)}
      className="shrink-0"
    >
      <TabsList className={cn(TOOLBAR_SEGMENT_LIST, "bg-background/60")}>
        {OUTPUT_CONTEXT_TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className={TOOLBAR_SEGMENT_TRIGGER}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function DesignerTabs({
  designerTab,
  onDesignerTabChange,
}: {
  designerTab: "fields" | "appearance";
  onDesignerTabChange: (tab: "fields" | "appearance") => void;
}) {
  return (
    <Tabs
      value={designerTab}
      onValueChange={(value) => onDesignerTabChange(value as "fields" | "appearance")}
      className="shrink-0"
    >
      <TabsList className={cn(TOOLBAR_SEGMENT_LIST, "bg-background/60")}>
        {DESIGNER_TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className={TOOLBAR_SEGMENT_TRIGGER}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function DocumentTemplatesContextToolbar({
  modules,
  selectedModuleKey,
  onModuleChange,
  viewContext,
  onViewContextChange,
  scope,
  locations,
  canEdit,
  onScopeChange,
  designerTab,
  onDesignerTabChange,
  fieldToolbarActions,
}: Props) {
  const isScreenLayout = viewContext === "SCREEN_GRID";
  const showFieldActions = designerTab === "fields";
  const showAppearanceTab = !isScreenLayout;

  return (
    <div className="shrink-0 space-y-2">
      <div className="document-templates-toolbar-wide min-w-0 flex-nowrap items-center gap-2 rounded-lg border border-border/50 bg-muted/15 px-2 py-1.5">
        <ModuleSelect
          modules={modules}
          selectedModuleKey={selectedModuleKey}
          onModuleChange={onModuleChange}
          className="w-[11rem] shrink-0"
        />
        <ToolbarDivider />
        <OutputContextTabs viewContext={viewContext} onViewContextChange={onViewContextChange} />
        <DocumentLayoutScopeSelect
          scope={scope}
          locations={locations}
          disabled={!canEdit}
          compact
          className="w-auto min-w-[7.5rem] max-w-[10rem] shrink-0"
          triggerClassName={cn(TOOLBAR_SELECT_TRIGGER, "h-8")}
          onScopeChange={onScopeChange}
        />
        <ToolbarDivider />
        {showAppearanceTab ? (
          <DesignerTabs designerTab={designerTab} onDesignerTabChange={onDesignerTabChange} />
        ) : null}
        {showFieldActions ? (
          <FieldToolbarButtons actions={fieldToolbarActions} />
        ) : null}
      </div>

      <div className="document-templates-toolbar-compact min-w-0 flex-col gap-2 rounded-lg border border-border/50 bg-muted/15 p-2">
        <div className="flex min-w-0 items-center gap-2">
          <DocumentLayoutScopeSelect
            scope={scope}
            locations={locations}
            disabled={!canEdit}
            compact
            className="min-w-0 flex-1"
            triggerClassName={cn(TOOLBAR_SELECT_TRIGGER, "h-8")}
            onScopeChange={onScopeChange}
          />
          <ModuleSelect
            modules={modules}
            selectedModuleKey={selectedModuleKey}
            onModuleChange={onModuleChange}
            className="min-w-0 flex-1"
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Select
            value={viewContext}
            onValueChange={(value) => onViewContextChange(value as TemplateDesignerViewContext)}
          >
            <SelectTrigger
              className={cn("h-8 w-[6.75rem] shrink-0 text-xs", TOOLBAR_SELECT_TRIGGER)}
              aria-label="Output format"
            >
              <SelectValue>
                {OUTPUT_CONTEXT_TABS.find((tab) => tab.id === viewContext)?.label ?? "Print"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_CONTEXT_TABS.map((tab) => (
                <SelectItem key={tab.id} value={tab.id}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showAppearanceTab ? (
            <Select
              value={designerTab}
              onValueChange={(value) => onDesignerTabChange(value as "fields" | "appearance")}
            >
              <SelectTrigger
                className={cn("h-8 w-[7.5rem] shrink-0 text-xs", TOOLBAR_SELECT_TRIGGER)}
                aria-label="Designer panel"
              >
                <SelectValue>
                  {DESIGNER_TABS.find((tab) => tab.id === designerTab)?.label ?? "Fields"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DESIGNER_TABS.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {showFieldActions ? (
            <FieldToolbarButtons actions={fieldToolbarActions} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
