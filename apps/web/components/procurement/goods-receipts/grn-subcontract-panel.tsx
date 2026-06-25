"use client";

import Link from "next/link";
import type { GrnSubcontractPreview } from "@/lib/procurement/subcontract/grn-preview";
import { INVENTORY_STOCK_HREF, PROCUREMENT_SUBCONTRACT_HREF } from "@/lib/procurement/navigation";

type Props = {
  preview: GrnSubcontractPreview | null;
  loading?: boolean;
};

export function GrnSubcontractPanel({ preview, loading = false }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        Loading subcontract backflush preview…
      </div>
    );
  }

  if (!preview?.is_subcontract_job) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium">Subcontract backflush</h3>
        <p className="text-sm text-muted-foreground">
          Components will be consumed from{" "}
          <span className="font-medium text-foreground">
            {preview.wip_location_name ?? "vendor WIP"}
          </span>{" "}
          when this receipt posts.
        </p>
      </div>

      {!preview.wip_location_id ? (
        <p className="text-sm text-destructive">
          No active subcontract WIP link exists for this supplier. Configure it under Procurement →
          Subcontracting.
        </p>
      ) : null}

      {preview.bom_lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No subcontract BOM lines match the finished goods on this receipt.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {preview.bom_lines.map((line) => (
            <li
              key={`${line.parent_item_id}:${line.component_item_id}`}
              className={line.sufficient ? "text-foreground" : "text-destructive"}
            >
              <span className="font-medium">{line.component_variant_sku ?? line.component_item_name}</span>
              {" · "}
              need {line.required_qty} (WIP on hand {line.wip_on_hand})
              {" · "}
              {line.quantity_per} × {line.accepted_qty} {line.parent_variant_sku}
            </li>
          ))}
        </ul>
      )}

      {preview.has_insufficient_wip ? (
        <div className="space-y-2 text-sm text-destructive">
          <p>Insufficient component stock at the subcontract WIP location. Posting will be blocked.</p>
          <div className="flex flex-wrap gap-3">
            <Link href={INVENTORY_STOCK_HREF} className="underline underline-offset-2">
              Review stock balances
            </Link>
            <Link href={PROCUREMENT_SUBCONTRACT_HREF} className="underline underline-offset-2">
              Subcontracting setup
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
