"use client";

import { useMemo, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getVisibleHeaderFields,
  normalizePoLayoutTemplate,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import { formatDate } from "@/lib/dashboard/format";
import {
  purchaseOrderStatusBadgeVariant,
  purchaseOrderStatusLabel,
} from "@/lib/procurement/purchase-orders/labels";
import { parsePurchaseOrderCustomFields } from "@/lib/procurement/purchase-orders/custom-fields";
import type { PurchaseOrderCustomFields } from "@/lib/procurement/purchase-orders/custom-fields";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { formatPoMoney } from "@/lib/procurement/purchase-orders/totals";

type Props = {
  order: PurchaseOrderRow;
  layout?: DocumentLayoutTemplate;
};

function resolvePeekHeaderValue(
  fieldId: string,
  order: PurchaseOrderRow,
  customFields: PurchaseOrderCustomFields
): ReactNode {
  switch (fieldId) {
    case "voucher_number":
      return (
        <p className="truncate font-mono text-sm font-medium">{order.voucher_number}</p>
      );
    case "supplier":
      return <p className="truncate text-sm font-medium">{order.supplier_name}</p>;
    case "destination":
      return (
        <p className="truncate text-sm font-medium">{order.destination_location_name}</p>
      );
    case "currency":
      return <p className="text-sm font-medium">{order.currency_code}</p>;
    case "document_status":
      return (
        <Badge variant={purchaseOrderStatusBadgeVariant(order.document_status)}>
          {purchaseOrderStatusLabel(order.document_status)}
        </Badge>
      );
    case "payment_terms_days":
      return <p className="text-sm">{order.payment_terms_days} days</p>;
    case "updated_at":
      return <p className="truncate text-sm">{formatDate(order.updated_at)}</p>;
    case "requisition_number":
      return (
        <p className="truncate text-sm">{customFields.requisition_number || "—"}</p>
      );
    case "expected_delivery_date":
      return (
        <p className="truncate text-sm">{customFields.expected_delivery_date || "—"}</p>
      );
    case "internal_notes":
      return <p className="text-sm">{customFields.internal_notes || "—"}</p>;
    default:
      return null;
  }
}

function PeekHeaderField({
  field,
  order,
  customFields,
}: {
  field: DocumentColumnPref;
  order: PurchaseOrderRow;
  customFields: PurchaseOrderCustomFields;
}) {
  const value = resolvePeekHeaderValue(field.id, order, customFields);
  if (value == null) return null;

  return (
    <div className="min-w-0">
      <p
        className={documentFieldTypographyClassName(
          field,
          "text-xs font-medium text-muted-foreground"
        )}
      >
        {field.label}
      </p>
      {value}
    </div>
  );
}

export function PoPeekView({ order, layout = DEFAULT_PO_SCREEN_LAYOUT }: Props) {
  const customFields = parsePurchaseOrderCustomFields(order.custom_fields);
  const resolvedLayout = useMemo(() => normalizePoLayoutTemplate(layout), [layout]);
  const headerFields = getVisibleHeaderFields(resolvedLayout);
  const gridFields = headerFields.filter((field) => field.id !== "internal_notes");
  const internalNotesField = headerFields.find((field) => field.id === "internal_notes");

  return (
    <div className="space-y-6">
      {gridFields.length > 0 ? (
        <div className="po-peek-meta-grid min-w-0">
          {gridFields.map((field) => (
            <PeekHeaderField
              key={field.id}
              field={field}
              order={order}
              customFields={customFields}
            />
          ))}
        </div>
      ) : null}

      {internalNotesField ? (
        <PeekHeaderField
          field={internalNotesField}
          order={order}
          customFields={customFields}
        />
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lines</p>
          <p className="text-sm font-semibold tabular-nums">
            Total {formatPoMoney(Number(order.total_net_amount) || 0)}
          </p>
        </div>
        <div className="po-peek-lines-table po-line-grid-scroll">
          <table className="w-full min-w-[34rem] table-fixed text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="sticky top-0 z-[5] w-10 bg-muted/95 p-2 text-center backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  #
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-left backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Item
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-right backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Ordered
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-right backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Received
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-right backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Unit price
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-right backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody>
              {(order.lines ?? []).map((line, lineIndex) => (
                <tr key={line.id} className="border-b border-border">
                  <td className="w-10 p-2 text-center tabular-nums text-xs text-muted-foreground">
                    {lineIndex + 1}
                  </td>
                  <td className="p-2">
                    <div className="text-xs font-medium">{line.item_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{line.variant_sku}</div>
                  </td>
                  <td className="p-2 text-right tabular-nums">{line.quantity_ordered}</td>
                  <td className="p-2 text-right tabular-nums">{line.quantity_received}</td>
                  <td className="p-2 text-right tabular-nums">{line.unit_price_contractual}</td>
                  <td className="p-2 text-right tabular-nums">{line.line_total_gross}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
