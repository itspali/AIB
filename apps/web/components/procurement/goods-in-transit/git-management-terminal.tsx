"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  cancelGoodsInTransit,
  loadGoodsInTransitDetail,
  loadGoodsInTransitVouchers,
} from "@/app/procurement/goods-in-transit/actions";
import { GitDrawerForm, GitVoucherList } from "@/components/procurement/goods-in-transit/git-drawer-form";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GoodsInTransitRow, GoodsInTransitStatus } from "@/lib/procurement/git/types";
import { PROCUREMENT_GIT_HREF } from "@/lib/procurement/navigation";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
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
  const [search, setSearch] = useState("");
  const [, startRefresh] = useTransition();
  const [, startCancel] = useTransition();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const next = await loadGoodsInTransitVouchers();
      setVouchers(next);
    });
  }, []);

  const filteredVouchers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      if (statusFilter !== "ALL" && voucher.status !== statusFilter) return false;
      if (poFilter !== "ALL" && voucher.purchase_order_id !== poFilter) return false;
      if (!needle) return true;
      return (
        voucher.voucher_number.toLowerCase().includes(needle) ||
        (voucher.purchase_order_number ?? "").toLowerCase().includes(needle)
      );
    });
  }, [poFilter, search, statusFilter, vouchers]);

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

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Goods in transit"
            description="Import-only in-transit custody. Use stock transfers for domestic warehouse moves."
            createLabel="Post GIT"
            onCreate={drawer.openCreate}
          />
        }
        toolbar={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as GoodsInTransitStatus | "ALL")
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Purchase order</Label>
              <Select value={poFilter} onValueChange={setPoFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Search</Label>
              <Input
                className="w-[200px]"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Voucher or PO #"
              />
            </div>
          </div>
        }
      >
        <GitVoucherList
          vouchers={filteredVouchers}
          selectedId={selectedId}
          onSelect={handleSelect}
          onRefresh={refresh}
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
  );
}
