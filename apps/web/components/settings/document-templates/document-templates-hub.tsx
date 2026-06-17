"use client";

import Link from "next/link";
import { FileText, Printer } from "lucide-react";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Badge } from "@/components/ui/badge";
import { groupPresentationModulesByDomain } from "@/lib/documents/print/presentation-catalog";
import { cn } from "@/lib/utils";

type Props = {
  deployError?: string;
};

export function DocumentTemplatesHub({ deployError }: Props) {
  const groups = groupPresentationModulesByDomain();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">Document print templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure letterhead, sections, and appearance for print and PDF output across modules.
          Field visibility is managed under{" "}
          <Link href="/settings/modules" className="text-primary underline-offset-4 hover:underline">
            Module settings
          </Link>
          .
        </p>
      </div>

      {deployError ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {deployError}
        </div>
      ) : null}

      {(["PROCUREMENT", "SALES"] as const).map((domain) => (
        <OrgSettingsSection
          key={domain}
          title={domain === "PROCUREMENT" ? "Procurement" : "Sales"}
          description="Appearance templates for operational documents in this domain."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {groups[domain].map((module) => (
              <Link
                key={module.moduleKey}
                href={`/settings/documents/templates/${module.moduleKey}`}
                className={cn(
                  "surface-inset flex items-start gap-3 rounded-lg p-4 transition-colors",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <div className="mt-0.5 rounded-md bg-muted p-2">
                  {module.printable ? (
                    <Printer className="h-4 w-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{module.label}</span>
                    {!module.printable ? (
                      <Badge variant="administrative" className="text-[10px]">
                        Layout only
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {module.printable
                      ? "Print and email attachment appearance"
                      : "Prepare appearance before print is enabled"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </OrgSettingsSection>
      ))}
    </div>
  );
}
