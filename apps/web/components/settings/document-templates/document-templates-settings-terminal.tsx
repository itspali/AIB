"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileOutput, FileText, Printer } from "lucide-react";
import { PresentationTemplateEditor } from "@/components/settings/document-templates/presentation-template-editor";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PRESENTATION_MODULE_DEFINITIONS,
  groupPresentationModulesByDomain,
} from "@/lib/documents/print/presentation-catalog";
import type { PresentationModuleDefinition } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

const DOMAIN_ORDER = ["PROCUREMENT", "SALES"] as const;
const MODULE_QUERY = "module";

const FIELD_LAYOUT_HREF: Record<"PROCUREMENT" | "SALES", string> = {
  PROCUREMENT: "/settings/modules/procurement",
  SALES: "/settings/modules/sales",
};

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
};

export function DocumentTemplatesSettingsTerminal({
  locations,
  canEdit,
  gstRegistered,
  deployError,
  initialModuleKey,
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
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      <header className="shrink-0">
        <div className="flex items-center gap-2">
          <FileOutput className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Document print templates</h1>
        </div>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
          Configure letterhead, sections, and PDF appearance for every document type. Field
          visibility is managed under{" "}
          <Link href="/settings/modules" className="text-primary underline-offset-4 hover:underline">
            Module settings
          </Link>
          .
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
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="h-auto w-fit shrink-0 flex-wrap gap-1 bg-muted/50 p-1">
          {DOMAIN_ORDER.map((domainKey) => (
            <TabsTrigger key={domainKey} value={domainKey} className="text-xs sm:text-sm">
              {domainKey === "PROCUREMENT" ? "Procurement" : "Sales"}
            </TabsTrigger>
          ))}
        </TabsList>

        {DOMAIN_ORDER.map((domainKey) => (
          <TabsContent
            key={domainKey}
            value={domainKey}
            className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Documents
                </p>
                {groups[domainKey].map((module) => (
                  <button
                    key={module.moduleKey}
                    type="button"
                    onClick={() => selectModule(module)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2.5 text-left transition-colors",
                      selectedModuleKey === module.moduleKey
                        ? "border-primary/40 bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                      {module.printable ? (
                        <Printer className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium leading-tight">{module.label}</span>
                        {!module.printable ? (
                          <Badge variant="administrative" className="text-[9px]">
                            Layout only
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                  </button>
                ))}
              </aside>

              <div className="min-h-0 min-w-0">
                {selectedModule ? (
                  <PresentationTemplateEditor
                    key={selectedModule.moduleKey}
                    moduleKey={selectedModule.moduleKey}
                    moduleLabel={selectedModule.label}
                    fieldLayoutHref={FIELD_LAYOUT_HREF[selectedModule.domain]}
                    initialTemplates={[]}
                    locations={locations}
                    canEdit={canEdit}
                    gstRegistered={gstRegistered}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Select a document type.</p>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
