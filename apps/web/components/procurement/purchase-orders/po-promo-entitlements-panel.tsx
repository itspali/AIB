"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  loadPoPromoEntitlements,
  writeOffPromotionalEntitlement,
} from "@/app/procurement/purchase-orders/actions";
import {
  hasOpenPromoEntitlements,
  isOpenPromoEntitlement,
  promoEntitlementStatusLabel,
  resolvePromoEntitlementRemainingQty,
  type PoPromoEntitlementRow,
} from "@/lib/procurement/promo/entitlements";
import { cn } from "@/lib/utils";

type Props = {
  purchaseOrderId: string | null;
  /** When true, show write-off controls for open entitlements (issued POs). */
  allowWriteOff?: boolean;
  className?: string;
  /** Compact banner-only mode for GRN create form. */
  variant?: "banner" | "full";
  /** Prefetched rows from peek drawer — skips mount-time fetch when provided. */
  initialEntitlements?: PoPromoEntitlementRow[];
  initialLoadError?: string | null;
};

function formatQtyDisplay(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toFixed(4).replace(/\.?0+$/, "") || "0";
}

export function PoPromoEntitlementsPanel({
  purchaseOrderId,
  allowWriteOff = false,
  className,
  variant = "full",
  initialEntitlements,
  initialLoadError = null,
}: Props) {
  const usesPrefetchedData = initialEntitlements !== undefined;
  const [entitlements, setEntitlements] = useState<PoPromoEntitlementRow[]>(
    () => initialEntitlements ?? []
  );
  const [loading, setLoading] = useState(
    () => Boolean(purchaseOrderId) && !usesPrefetchedData
  );
  const [loadError, setLoadError] = useState<string | null>(
    () => initialLoadError ?? null
  );
  const [writeOffTarget, setWriteOffTarget] = useState<PoPromoEntitlementRow | null>(null);
  const [writeOffReason, setWriteOffReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(async (poId: string) => {
    setLoading(true);
    setLoadError(null);
    const result = await loadPoPromoEntitlements(poId);
    setLoading(false);
    if ("error" in result) {
      setEntitlements([]);
      setLoadError(result.error);
      return;
    }
    setEntitlements(result.entitlements);
  }, []);

  useEffect(() => {
    if (!purchaseOrderId) {
      setEntitlements([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    if (usesPrefetchedData) {
      setEntitlements(initialEntitlements ?? []);
      setLoadError(initialLoadError ?? null);
      setLoading(false);
      return;
    }
    void reload(purchaseOrderId);
  }, [initialEntitlements, initialLoadError, purchaseOrderId, reload, usesPrefetchedData]);

  const openEntitlements = useMemo(
    () => entitlements.filter(isOpenPromoEntitlement),
    [entitlements]
  );
  const showOpenBanner = hasOpenPromoEntitlements(entitlements);
  const showPanel = loading || loadError || entitlements.length > 0;

  const handleWriteOffConfirm = () => {
    if (!writeOffTarget) return;
    startTransition(async () => {
      const result = await writeOffPromotionalEntitlement({
        entitlement_id: writeOffTarget.id,
        reason: writeOffReason,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Promotional entitlement written off");
      setWriteOffTarget(null);
      setWriteOffReason("");
      if (purchaseOrderId) {
        await reload(purchaseOrderId);
      }
    });
  };

  if (!purchaseOrderId || !showPanel) return null;

  if (variant === "banner" && !showOpenBanner && !loading) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "surface-inset rounded-lg border border-border/60 p-4",
          showOpenBanner && "border-amber-500/30 bg-amber-500/5",
          className
        )}
      >
        <div className="flex items-start gap-3">
          {loading ? (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Gift
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                showOpenBanner ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              )}
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium">
                {showOpenBanner
                  ? "Free goods still expected on this order"
                  : "Promotional entitlements"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {loading
                  ? "Loading promotional fulfillment…"
                  : showOpenBanner
                    ? "Receive promotional lines on a goods receipt, or write off entitlements you will not collect."
                    : entitlements.length === 0
                      ? "No promotional entitlements on this purchase order."
                      : "All promotional entitlements are fulfilled or closed."}
              </p>
              {loadError ? (
                <p className="mt-1 text-sm text-destructive">{loadError}</p>
              ) : null}
            </div>

            {variant === "full" && entitlements.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium text-right">Expected</th>
                      <th className="px-3 py-2 font-medium text-right">Received</th>
                      <th className="px-3 py-2 font-medium text-right">Remaining</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      {allowWriteOff ? (
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {entitlements.map((entitlement) => {
                      const remaining = resolvePromoEntitlementRemainingQty(entitlement);
                      const canWriteOff =
                        allowWriteOff &&
                        isOpenPromoEntitlement(entitlement) &&
                        entitlement.status !== "WRITTEN_OFF";

                      return (
                        <tr key={entitlement.id} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{entitlement.item_name}</p>
                            {entitlement.variant_sku ? (
                              <p className="font-mono text-xs text-muted-foreground">
                                {entitlement.variant_sku}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatQtyDisplay(entitlement.expected_qty)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatQtyDisplay(entitlement.received_qty)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatQtyDisplay(String(remaining))}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                entitlement.status === "WRITTEN_OFF"
                                  ? "locked"
                                  : isOpenPromoEntitlement(entitlement)
                                    ? "action_required"
                                    : "administrative"
                              }
                              className="text-xs font-normal"
                            >
                              {promoEntitlementStatusLabel(entitlement.status)}
                            </Badge>
                            {entitlement.written_off_reason ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {entitlement.written_off_reason}
                              </p>
                            ) : null}
                          </td>
                          {allowWriteOff ? (
                            <td className="px-3 py-2 text-right">
                              {canWriteOff ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setWriteOffTarget(entitlement);
                                    setWriteOffReason("");
                                  }}
                                >
                                  Write off
                                </Button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {variant === "banner" && openEntitlements.length > 0 ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {openEntitlements.map((entitlement) => (
                  <li key={entitlement.id}>
                    <span className="font-medium text-foreground">{entitlement.item_name}</span>
                    {" — "}
                    {formatQtyDisplay(String(resolvePromoEntitlementRemainingQty(entitlement)))}{" "}
                    remaining of {formatQtyDisplay(entitlement.expected_qty)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <AlertDialog
        open={writeOffTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setWriteOffTarget(null);
            setWriteOffReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Write off free goods entitlement?</AlertDialogTitle>
            <AlertDialogDescription>
              {writeOffTarget
                ? `This closes the entitlement for ${writeOffTarget.item_name} (${formatQtyDisplay(
                    String(resolvePromoEntitlementRemainingQty(writeOffTarget))
                  )} remaining). Promo inventory tied to this entitlement will be cleared.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="promo-writeoff-reason">Reason</Label>
            <Input
              id="promo-writeoff-reason"
              value={writeOffReason}
              onChange={(event) => setWriteOffReason(event.target.value)}
              placeholder="e.g. Supplier did not ship free goods"
              disabled={isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !writeOffReason.trim()}
              onClick={(event) => {
                event.preventDefault();
                handleWriteOffConfirm();
              }}
            >
              {isPending ? "Writing off…" : "Write off"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
