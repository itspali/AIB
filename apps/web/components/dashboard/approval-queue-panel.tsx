import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { HubPanel, HubSectionHeading } from "@/components/dashboard/hub-panel";
import { formatDate } from "@/lib/dashboard/format";
import { formatMoneyDetail } from "@/lib/procurement/math";
import type { PendingPurchaseOrderApprovalRow } from "@/lib/dashboard/queries";
import { poListReturnHref } from "@/lib/procurement/navigation";

type Props = {
  pendingPurchaseOrders: PendingPurchaseOrderApprovalRow[];
};

export function ApprovalQueuePanel({ pendingPurchaseOrders }: Props) {
  if (pendingPurchaseOrders.length === 0) return null;

  return (
    <section className="mb-10">
      <HubSectionHeading
        step="!"
        title="Approval queue"
        description="Purchase orders awaiting approval before issue."
      />
      <HubPanel accent="amber" icon={ClipboardCheck} className="p-5 md:p-6">
        <div className="surface-inset table-chrome-frame overflow-x-auto">
          <table
            data-header-tone="subtle"
            className="table-chrome w-full border-separate border-spacing-0 text-sm"
          >
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">PO number</th>
                <th className="p-3 font-medium text-muted-foreground">Supplier</th>
                <th className="p-3 font-medium text-muted-foreground">Amount</th>
                <th className="p-3 font-medium text-muted-foreground">Submitted</th>
                <th className="p-3 font-medium text-muted-foreground">Submitter</th>
              </tr>
            </thead>
            <tbody>
              {pendingPurchaseOrders.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <Link
                      href={poListReturnHref(row.id)}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.voucher_number}
                    </Link>
                  </td>
                  <td className="p-3">{row.supplier_name ?? "—"}</td>
                  <td className="p-3 tabular-nums">
                    {formatMoneyDetail(row.total_net_amount, row.currency_code)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.submitted_at ? formatDate(row.submitted_at) : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">{row.submitted_by_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HubPanel>
    </section>
  );
}
