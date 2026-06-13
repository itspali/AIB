"use client";

import { useEffect, useState } from "react";
import { loadOpenGitVouchersForPo } from "@/app/procurement/goods-in-transit/actions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GoodsInTransitRow } from "@/lib/procurement/git/types";

type Props = {
  purchaseOrderId: string | null;
  value: string | null;
  onChange: (gitVoucherId: string | null) => void;
  className?: string;
};

export function GrnGitLinkPanel({ purchaseOrderId, value, onChange, className }: Props) {
  const [vouchers, setVouchers] = useState<GoodsInTransitRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!purchaseOrderId) {
      setVouchers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadOpenGitVouchersForPo(purchaseOrderId).then((rows) => {
      if (cancelled) return;
      setVouchers(rows);
      setLoading(false);
      if (rows.length === 1) onChange(rows[0].id);
    });

    return () => {
      cancelled = true;
    };
  }, [purchaseOrderId, onChange]);

  if (!purchaseOrderId || (!loading && vouchers.length === 0)) return null;

  return (
    <section className={className}>
      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
        <Label>Clear goods in transit</Label>
        <p className="text-xs text-muted-foreground">
          Link a posted GIT voucher to release in-transit stock when this receipt is posted.
        </p>
        <Select
          value={value ?? "none"}
          onValueChange={(next) => onChange(next === "none" ? null : next)}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading GIT vouchers…" : "Select GIT voucher"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No GIT clearance</SelectItem>
            {vouchers.map((voucher) => (
              <SelectItem key={voucher.id} value={voucher.id}>
                {voucher.voucher_number} · {voucher.line_count} lines
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
