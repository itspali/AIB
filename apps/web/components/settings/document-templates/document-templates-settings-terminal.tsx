"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileOutput, FileText, Printer } from "lucide-react";
import { DocumentDesignerWorkspace } from "@/components/settings/document-templates/document-designer-workspace";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PRESENTATION_MODULE_DEFINITIONS,
  groupPresentationModulesByDomain,
} from "@/lib/documents/print/presentation-catalog";
import type { PresentationModuleDefinition } from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import { cn } from "@/lib/utils";

const DOMAIN_ORDER = ["PROCUREMENT", "SALES"] as const;
const MODULE_QUERY = "module";

const VALID_MODULE_KEYS = new Set<DocumentModuleKey>(
  PRESENTATION_MODULE_DEFINITIONS.map((row) => row.moduleKey)
);

function parseModuleKey(raw: string | null): DocumentModuleKey | null {
  if (!raw || !VALID_MODULE_KEYS.has(raw as DocumentModuleKey)) return null;
  return raw as DocumentModuleKey;
}

type Props = {
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered: boolean;
  deployError?: string;
  initialModuleKey?: DocumentModuleKey | null;
  initialLayouts: Record<DocumentModuleKey, DocumentLayoutTemplate>;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
};

export function DocumentTemplatesSettingsTerminal({
  locations,
  canEdit,
  gstRegistered,
  deployError,
  initialModuleKey,
  initialLayouts,
  catalogFieldSuggestions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groups = useMemo(() => groupPresentationModulesByDomain(), []);

  const queryModule = parseModuleKey(searchParams.get(MODULE_QUERY));
  const [domain, setDomain] = useState<"PROCUREMENT" | "SALES">(() => {
    const key = queryModule ?? initialModuleKey ?? "PURCHASE_ORDER";
    const definition = PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === key);
    return definition?.domain ?? "PROCUREMENT";
  });

  useEffect(() => {
    if (!queryModule) return;
    const definition = PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === queryModule);
    if (definition && definition.domain !== domain) {
      setDomain(definition.domain);
    }
  }, [queryModule, domain]);

  const selectedModuleKey = useMemo(() => {
    const fromQuery = queryModule;
    if (fromQuery) {
      const definition = PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === fromQuery);
      if (definition?.domain === domain) return fromQuery;
    }
    return groups[domain][0]?.moduleKey ?? "PURCHASE_ORDER";
  }, [queryModule, domain, groups]);

  const selectedModule = useMemo(
    () => PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === selectedModuleKey) ?? null,
    [selectedModuleKey]
  );

  const selectModule = useCallback(
    (module: PresentationModuleDefinition) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(MODULE_QUERY, module.moduleKey);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      if (module.domain !== domain) {
        setDomain(module.domain);
      }
    },
    [domain, pathname, router, searchParams]
  );

  const handleDomainChange = (nextDomain: "PROCUREMENT" | "SALES") => {
    setDomain(nextDomain);
    const first = groups[nextDomain][0];
    if (first) selectModule(first);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <header className="shrink-0">
        <div className="flex items-center gap-2">
          <FileOutput className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Document print templates</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Design print and email PDF output — fields, appearance, and live preview. On-screen drawer
          layouts stay in module settings.
        </p>
      </header>

      {deployError ? (
        <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {deployError}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="shrink-0 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access. Organization owners or delegates can edit templates.
        </div>
      ) : null}

      <Tabs
        value={domain}
        onValueChange={(value) => handleDomainChange(value as "PROCUREMENT" | "SALES")}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <TabsList className="h-8 shrink-0 bg-muted/50 p-0.5">
            {DOMAIN_ORDER.map((domainKey) => (
              <TabsTrigger key={domainKey} value={domainKey} className="h-7 px-3 text-xs">
                {domainKey === "PROCUREMENT" ? "Procurement" : "Sales"}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {DOMAIN_ORDER.map((domainKey) => (
          <TabsContent
            key={domainKey}
            value={domainKey}
            className="mt-0 flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden"
          >
            <Tabs
              value={selectedModuleKey}
              onValueChange={(value) => {
                const module = groups[domainKey].find((row) => row.moduleKey === value);
                if (module) selectModule(module);
              }}
            >
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
                {groups[domainKey].map((module) => (
                  <TabsTrigger
                    key={module.moduleKey}
                    value={module.moduleKey}
                    className={cn(
                      "h-8 shrink-0 gap-1.5 rounded-md border border-transparent px-3 text-xs data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                    )}
                  >
                    {module.printable ? (
                      <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    {module.label}
                    {!module.printable ? (
                      <Badge variant="administrative" className="ml-0.5 text-[9px]">
                        Layout
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="min-h-0 min-w-0 flex-1">
              {selectedModule && selectedModule.domain === domainKey ? (
                <DocumentDesignerWorkspace
                  key={selectedModule.moduleKey}
                  moduleKey={selectedModule.moduleKey}
                  moduleLabel={selectedModule.label}
                  moduleDomain={selectedModule.domain}
                  initialLayout={initialLayouts[selectedModule.moduleKey]}
                  locations={locations}
                  canEdit={canEdit}
                  gstRegistered={gstRegistered}
                  catalogFieldSuggestions={
                    selectedModule.domain === "PROCUREMENT" ? catalogFieldSuggestions : undefined
                  }
                />
              ) : null}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
