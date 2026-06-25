"use client";

import { useCallback, useState, useTransition } from "react";
import { loadSubcontractAdminContext } from "@/app/procurement/subcontract/actions";
import { SubcontractAdminPanel } from "@/components/procurement/subcontract/subcontract-admin-panel";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListWorkspaceLayoutToggleControl } from "@/components/layout/list-workspace-layout-toggle-control";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";

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

  const peekOpen = false;
  const { layout } = useListWorkspaceCatalogLayout();

  const listContent = (
    <>
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
    </>
  );

  return (
    <ListWorkspaceModuleFrame peekOpen={peekOpen}>
      <ListModuleShell
        surface="classic"
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title="Subcontracting"
            layout={layout}
            controls={<ListWorkspaceLayoutToggleControl />}
          />
        }
      >
        <ListWorkspaceCatalogBody
          peekOpen={peekOpen}
          splitEmptyTitle="Select a subcontract job"
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listContent}
          splitListContent={listContent}
        />
      </ListModuleShell>
    </ListWorkspaceModuleFrame>
  );
}
