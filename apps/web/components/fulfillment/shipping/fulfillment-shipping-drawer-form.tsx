"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  loadSalesShipmentDetail,
  loadShippableSalesOrder,
  postSalesShipment,
} from "@/app/fulfillment/shipping/actions";
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
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import { RightDrawer } from "@/components/ui/right-drawer";
import { formatDate } from "@/lib/dashboard/format";
import {
  SHIPPING_CARRIER_OPTIONS,
  shippingCarrierLabel,
} from "@/lib/fulfillment/shipping/labels";
import { SHIPMENT_DRAWER_SO_PARAM } from "@/lib/fulfillment/shipping/navigation";
import type {
  SalesShipmentRow,
  ShippableSalesOrder,
  ShippingCarrierProvider,
} from "@/lib/fulfillment/shipping/types";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";

type Surface = "create" | "peek";

type Props = {
  open: boolean;
  surface: Surface;
  shipmentId: string | null;
  prefillSalesOrderId: string | null;
  onClose: () => void;
  onAfterPost: (shipmentId: string) => void;
};

type ShipLineDraft = {
  sales_order_item_id: string;
  item_name: string;
  variant_sku: string;
  open_quantity: string;
  quantity_shipped: string;
};

export function FulfillmentShippingDrawerForm({
  open,
  surface,
  shipmentId,
  prefillSalesOrderId,
  onClose,
  onAfterPost,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isPending, startTransition] = useTransition();
  const [shipment, setShipment] = useState<SalesShipmentRow | null>(null);
  const [order, setOrder] = useState<ShippableSalesOrder | null>(null);
  const [carrier, setCarrier] = useState<ShippingCarrierProvider>("FEDEX");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [lines, setLines] = useState<ShipLineDraft[]>([]);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setErrorAction(null);

    if (surface === "peek" && shipmentId) {
      void loadSalesShipmentDetail(shipmentId).then((result) => {
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setShipment(result.shipment);
        setOrder(null);
      });
      return;
    }

    if (surface === "create" && prefillSalesOrderId) {
      void loadShippableSalesOrder(prefillSalesOrderId).then((result) => {
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setOrder(result.order);
        setShipment(null);
        setLines(
          result.order.lines
            .filter((line) => Number(line.open_quantity) > 0)
            .map((line) => ({
              sales_order_item_id: line.id,
              item_name: line.item_name,
              variant_sku: line.variant_sku,
              open_quantity: line.open_quantity,
              quantity_shipped: line.open_quantity,
            }))
        );
      });
    }
  }, [open, prefillSalesOrderId, shipmentId, surface]);

  const handlePost = useCallback(() => {
    if (!order) return;
    setError(null);
    setErrorAction(null);

    startTransition(async () => {
      const payloadLines = lines
        .map((line) => ({
          sales_order_item_id: line.sales_order_item_id,
          quantity_shipped: line.quantity_shipped.trim(),
        }))
        .filter((line) => Number(line.quantity_shipped) > 0);

      const result = await postSalesShipment({
        sales_order_id: order.id,
        carrier_provider: carrier,
        tracking_number: trackingNumber,
        lines: payloadLines,
      });

      if ("error" in result) {
        setError(result.error ?? "Unable to post shipment.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      onAfterPost(result.shipmentId);
    });
  }, [carrier, lines, onAfterPost, order, trackingNumber]);

  const title =
    surface === "peek"
      ? shipment?.tracking_number
        ? `Shipment ${shipment.tracking_number}`
        : "Shipment"
      : order
        ? `Ship ${order.voucher_number}`
        : "New shipment";

  return (
    <RightDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      onRequestClose={onClose}
      title={title}
      headerActions={
        surface === "create" && order ? (
          <Button type="button" size="sm" disabled={isPending} onClick={handlePost}>
            {isPending ? "Posting…" : "Post shipment"}
          </Button>
        ) : null
      }
    >
      {error ? (
        <UserFacingErrorMessage
          message={error}
          action={errorAction ?? undefined}
          className="mb-4"
        />
      ) : null}

      {surface === "peek" && shipment ? (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Sales order</p>
              <p className="font-mono">{shipment.sales_order_voucher}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p>{shipment.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Carrier</p>
              <p>{shippingCarrierLabel(shipment.carrier_provider)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dispatched</p>
              <p>{formatDate(shipment.dispatched_at)}</p>
            </div>
          </div>
          {shipment.lines?.length ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[24rem] text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-right">Shipped</th>
                  </tr>
                </thead>
                <tbody>
                  {shipment.lines.map((line) => (
                    <tr key={line.id} className="border-t border-border">
                      <td className="p-2">
                        <div>{line.item_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {line.variant_sku}
                        </div>
                      </td>
                      <td className="p-2 text-right tabular-nums">{line.quantity_shipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {surface === "create" && order ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="text-sm font-medium">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ship from</p>
              <p className="text-sm font-medium">{order.shipping_location_name}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shipment-carrier">Carrier</Label>
              <Select value={carrier} onValueChange={(value) => setCarrier(value as ShippingCarrierProvider)}>
                <SelectTrigger id="shipment-carrier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIPPING_CARRIER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {shippingCarrierLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shipment-tracking">Tracking number</Label>
              <Input
                id="shipment-tracking"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Tracking #"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-right">Open</th>
                  <th className="p-2 text-right">Ship qty</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.sales_order_item_id} className="border-t border-border">
                    <td className="p-2">
                      <div>{line.item_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{line.variant_sku}</div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{line.open_quantity}</td>
                    <td className="p-2 text-right">
                      <Input
                        className="ml-auto h-8 w-24 text-right tabular-nums"
                        value={line.quantity_shipped}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((row) =>
                              row.sales_order_item_id === line.sales_order_item_id
                                ? { ...row, quantity_shipped: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {surface === "create" && !order && !error ? (
        <p className="text-sm text-muted-foreground">
          Open this drawer from a confirmed sales order or add `?action=new&amp;{SHIPMENT_DRAWER_SO_PARAM}=…` to the URL.
        </p>
      ) : null}
    </RightDrawer>
  );
}
