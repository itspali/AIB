"use client";

import { useCallback, useState, useTransition } from "react";
import { loadGoodsReceipts } from "@/app/procurement/goods-receipts/actions";
import { loadPurchaseBills } from "@/app/procurement/bills/actions";
import { BillDrawerForm } from "@/components/procurement/bills/bill-drawer-form";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { formatDate } from "@/lib/dashboard/format";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";

type Props = {
  initialBills: PurchaseBillRow[];
  suppliers: ProcurementSupplierOption[];
  locations: ProcurementLocationOption[];
  receivableOrders: ReceivablePurchaseOrderOption[];
  initialGoodsReceipts: GoodsReceiptRow[];
};

export function BillManagementTerminal({
  initialBills,
  suppliers,
  locations,
  receivableOrders,
  initialGoodsReceipts,
}: Props) {
  const [bills, setBills] = useState(initialBills);
  const [goodsReceipts, setGoodsReceipts] = useState(initialGoodsReceipts);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [peekBill, setPeekBill] = useState<PurchaseBillRow | null>(null);
  const [, startRefresh] = useTransition();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const [nextBills, nextGrns] = await Promise.all([loadPurchaseBills(), loadGoodsReceipts()]);
      setBills(nextBills);
      setGoodsReceipts(nextGrns);
    });
  }, []);

  const openCreate = () => {
    setPeekBill(null);
    setDrawerOpen(true);
  };

  const openPeek = (bill: PurchaseBillRow) => {
    setPeekBill(bill);
    setDrawerOpen(true);
  };

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Supplier bills"
            description="Record vendor invoices, link goods receipts, and run three-way matching."
            createLabel="New bill"
            onCreate={openCreate}
          />
        }
      >
        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No supplier bills yet. Create your first bill.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {bills.map((bill) => (
              <li key={bill.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-muted/40"
                  onClick={() => openPeek(bill)}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{bill.system_voucher_number}</p>
                    <p className="font-medium">{bill.invoice_number_vendor}</p>
                    <p className="text-xs text-muted-foreground">{bill.supplier_name}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p>{bill.match_status ?? "MATCHED"}</p>
                    <p className="font-medium">{bill.total_liability_amount}</p>
                    <p className="text-muted-foreground">{formatDate(bill.created_at)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ListModuleShell>

      <BillDrawerForm
        open={drawerOpen}
        suppliers={suppliers}
        locations={locations}
        receivableOrders={receivableOrders}
        goodsReceipts={goodsReceipts}
        peekBill={peekBill}
        onClose={() => setDrawerOpen(false)}
        onAfterSave={refresh}
      />
    </>
  );
}
