"use client";

import { useCallback, useState, useTransition } from "react";
import { loadSubcontractAdminContext } from "@/app/procurement/subcontract/actions";
import { SubcontractAdminPanel } from "@/components/procurement/subcontract/subcontract-admin-panel";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";

type Context = Awaited<ReturnType<typeof loadSubcontractAdminContext>>;

type Props = {
  initialContext: Context;
};

export function SubcontractManagementTerminal({ initialContext }: Props) {
  const [context, setContext] = useState(initialContext);
  const [, startRefresh] = useTransition();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const next = await loadSubcontractAdminContext();
      setContext(next);
    });
  }, []);

  return (
    <ListModuleShell
      title={
        <ListModulePageTitleHeader
          title="Subcontracting"
          description="Configure vendor WIP locations and subcontract BOM lines consumed when finished goods are received."
          createLabel="Add subcontract job"
        />
      }
    >
      <SubcontractAdminPanel
        suppliers={context.suppliers}
        wipLocations={context.wipLocations}
        jobLinks={context.jobLinks}
        bomLines={context.bomLines}
        onChanged={refresh}
      />
      {context.wipLocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create a virtual stock-holding location with the Subcontract WIP flag under Settings →
          Locations, then link it to a supplier here.
        </p>
      ) : null}
    </ListModuleShell>
  );
}
