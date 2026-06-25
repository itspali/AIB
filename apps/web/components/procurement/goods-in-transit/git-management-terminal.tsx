"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  cancelGoodsInTransit,
  loadGoodsInTransitDetail,
  loadGoodsInTransitVouchers,
} from "@/app/procurement/goods-in-transit/actions";
import { GitDrawerForm, GitVoucherList } from "@/components/procurement/goods-in-transit/git-drawer-form";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListWorkspaceLayoutToggleControl } from "@/components/layout/list-workspace-layout-toggle-control";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listToolbarSelectClass } from "@/lib/layout/list-toolbar-chrome";
import type { GoodsInTransitRow, GoodsInTransitStatus } from "@/lib/procurement/git/types";
import { gitVoucherStatusLabel } from "@/lib/procurement/git/types";
import { cn } from "@/lib/utils";
import { PROCUREMENT_GIT_HREF } from "@/lib/procurement/navigation";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapGoodsInTransitRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";
import { toast } from "sonner";

const GIT_STATUS_FILTER_VALUES: GoodsInTransitStatus[] = [
  "POSTED",
  "CLEARED",
  "CANCELLED",
  "DRAFT",
];

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
  const drawer = useModuleDrawerUrl(PROCUREMENT_GIT_HREF);
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [peekVoucher, setPeekVoucher] = useState<GoodsInTransitRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<GoodsInTransitStatus | "ALL">("ALL");
  const [poFilter, setPoFilter] = useState<string>("ALL");
  const [, startRefresh] = useTransition();
  const [, startCancel] = useTransition();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const next = await loadGoodsInTransitVouchers();
      setVouchers(next);
    });
  }, []);

  const toolbarFilteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (statusFilter !== "ALL" && voucher.status !== statusFilter) return false;
      if (poFilter !== "ALL" && voucher.purchase_order_id !== poFilter) return false;
      return true;
    });
  }, [poFilter, statusFilter, vouchers]);

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: toolbarFilteredVouchers,
    extractSearchable: (row) => [
      row.voucher_number,
      row.purchase_order_number,
      row.source_location_name,
      row.git_holding_location_name,
      row.destination_location_name,
      gitVoucherStatusLabel(row.status),
      row.notes,
    ],
  });

  const filteredVouchers = feedFilteredRows;

  const selectedId = drawer.recordId;
  const createOpen = drawer.surface === "create";

  useEffect(() => {
    if (!selectedId || drawer.surface !== "peek") {
      setPeekVoucher(null);
      return;
    }
    void loadGoodsInTransitDetail(selectedId).then((result) => {
      if ("voucher" in result) setPeekVoucher(result.voucher);
    });
  }, [drawer.surface, selectedId]);

  const handleSelect = useCallback(
    (voucherId: string) => {
      drawer.openPeek(voucherId);
    },
    [drawer]
  );

  const handleCancel = useCallback(() => {
    if (!peekVoucher || peekVoucher.status !== "POSTED") return;
    startCancel(async () => {
      const result = await cancelGoodsInTransit(peekVoucher.id, "Cancelled from GIT module");
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("GIT voucher cancelled");
      refresh();
      drawer.close();
      setPeekVoucher(null);
    });
  }, [drawer, peekVoucher, refresh]);

  const hasAnyData = vouchers.length > 0;
  const peekOpen = drawer.isOpen && drawer.surface === "peek";
  const { layout } = useListWorkspaceCatalogLayout();

  const listPrimary = (
    <GitVoucherList
      vouchers={filteredVouchers}
      selectedId={selectedId}
      onSelect={handleSelect}
      onRefresh={refresh}
    />
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: filteredVouchers,
    selectedId,
    onSelect: handleSelect,
    mapRow: mapGoodsInTransitRowToSplitFeed,
    hasAnyData,
    emptyMessage: "No GIT vouchers match the current filters.",
  });

  return (
    <ListWorkspaceModuleFrame peekOpen={peekOpen}>
      <>
      <ListModuleShell
        surface="classic"
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title="Goods in transit"
            count={
              hasAnyData ? `${filteredVouchers.length}/${vouchers.length}` : undefined
            }
            onNew={drawer.openCreate}
            newAriaLabel="Post GIT"
            layout={layout}
            feedFilter={feedFilterProps}
            controls={
              hasAnyData ? (
                <>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as GoodsInTransitStatus | "ALL")
                    }
                  >
                    <SelectTrigger className={cn(listToolbarSelectClass(), "w-[9.5rem]")}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      {GIT_STATUS_FILTER_VALUES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={poFilter} onValueChange={setPoFilter}>
                    <SelectTrigger className={cn(listToolbarSelectClass(), "w-[11rem]")}>
                      <SelectValue placeholder="Purchase order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All POs</SelectItem>
                      {receivableOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.voucher_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ListWorkspaceLayoutToggleControl />
                </>
              ) : undefined
            }
          />
        }
      >
        <ListWorkspaceCatalogBody
          peekOpen={peekOpen}
          splitEmptyTitle="Select a GIT voucher"
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      <GitDrawerForm
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) drawer.close();
        }}
        sourceLocations={sourceLocations}
        gitLocations={gitLocations}
        receivableOrders={receivableOrders.filter(
          (order) => order.tax_supply_nature === "IMPORT_GOODS"
        )}
        onPosted={() => {
          refresh();
          drawer.close();
        }}
      />

      {drawer.surface === "peek" && peekVoucher ? (
        <GitDrawerForm
          open
          onOpenChange={(open) => {
            if (!open) {
              drawer.close();
              setPeekVoucher(null);
            }
          }}
          sourceLocations={sourceLocations}
          gitLocations={gitLocations}
          receivableOrders={receivableOrders}
          peekVoucher={peekVoucher}
          headerActions={
            peekVoucher.status === "POSTED" ? (
              <Button type="button" size="sm" variant="destructive" onClick={handleCancel}>
                Cancel voucher
              </Button>
            ) : null
          }
          onPosted={refresh}
        />
      ) : null}
      </>
    </ListWorkspaceModuleFrame>
  );
}
