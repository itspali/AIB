"use client";

import { useCallback, useState, useTransition } from "react";
import { loadGoodsInTransitVouchers } from "@/app/procurement/goods-in-transit/actions";
import { GitDrawerForm, GitVoucherList } from "@/components/procurement/goods-in-transit/git-drawer-form";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import type { GoodsInTransitRow } from "@/lib/procurement/git/types";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";

type Props = {
  initialVouchers: GoodsInTransitRow[];
  sourceLocations: ProcurementLocationOption[];
  gitLocations: Array<{ id: string; name: string; code: string }>;
  receivableOrders: ReceivablePurchaseOrderOption[];
};

export function GitManagementTerminal({
  initialVouchers,
  sourceLocations,
  gitLocations,
  receivableOrders,
}: Props) {
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, startRefresh] = useTransition();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const next = await loadGoodsInTransitVouchers();
      setVouchers(next);
    });
  }, []);

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Goods in transit"
            description="Move stock from a warehouse to a GIT holding node while import shipments are on the water or in customs."
            createLabel="Post GIT"
            onCreate={() => setDrawerOpen(true)}
          />
        }
      >
        <GitVoucherList vouchers={vouchers} onRefresh={refresh} />
      </ListModuleShell>

      <GitDrawerForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        sourceLocations={sourceLocations}
        gitLocations={gitLocations}
        receivableOrders={receivableOrders}
        onPosted={refresh}
      />
    </>
  );
}
