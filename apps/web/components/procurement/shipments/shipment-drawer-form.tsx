"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  allocatePoLinesToShipment,
  issueImportShipment,
  loadImportShipmentDetail,
  saveImportShipment,
  updateImportShipmentStatus,
} from "@/app/(workspace)/procurement/shipments/actions";
import { Badge } from "@/components/ui/badge";
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
import { RightDrawer } from "@/components/ui/right-drawer";
import { formatDate } from "@/lib/dashboard/format";
import type {
  AllocatableImportPurchaseOrderOption,
  ImportShipmentLineDraft,
  ImportShipmentRow,
  ImportShipmentStatus,
} from "@/lib/procurement/shipments/types";
import { importShipmentStatusLabel } from "@/lib/procurement/shipments/types";
import type { ProcurementLocationOption, ProcurementSupplierOption } from "@/lib/procurement/shared/types";

const NEXT_STATUS: Partial<Record<ImportShipmentStatus, ImportShipmentStatus>> = {
  BOOKED: "IN_TRANSIT",
  IN_TRANSIT: "AT_STAGING",
  AT_STAGING: "CUSTOMS_PENDING",
  CUSTOMS_PENDING: "CLEARED",
  CLEARED: "CLOSED",
};

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string | null;
  suppliers: ProcurementSupplierOption[];
  locations: ProcurementLocationOption[];
  allocatableOrders: AllocatableImportPurchaseOrderOption[];
  onSaved: () => void;
};

export function ShipmentDrawerForm({
  open,
  onOpenChange,
  shipmentId,
  suppliers,
  locations,
  allocatableOrders,
  onSaved,
}: DrawerProps) {
  const [supplierId, setSupplierId] = useState("");
  const [forwarderEntityId, setForwarderEntityId] = useState<string | null>(null);
  const [stagingLocationId, setStagingLocationId] = useState<string | null>(null);
  const [ultimateDestinationLocationId, setUltimateDestinationLocationId] = useState<string | null>(
    null
  );
  const [incotermsCode, setIncotermsCode] = useState("");
  const [billOfLading, setBillOfLading] = useState("");
  const [containerInput, setContainerInput] = useState("");
  const [awb, setAwb] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [portOfLoading, setPortOfLoading] = useState("");
  const [portOfDischarge, setPortOfDischarge] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [billOfEntryNumber, setBillOfEntryNumber] = useState("");
  const [billOfEntryDate, setBillOfEntryDate] = useState("");
  const [portCode, setPortCode] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [assessableValue, setAssessableValue] = useState("0");
  const [customsDutyAmount, setCustomsDutyAmount] = useState("0");
  const [importIgstAmount, setImportIgstAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [lines, setLines] = useState<ImportShipmentLineDraft[]>([]);
  const [savedShipmentId, setSavedShipmentId] = useState<string | null>(null);
  const [status, setStatus] = useState<ImportShipmentStatus>("DRAFT");
  const [shipmentNumber, setShipmentNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeShipmentId = savedShipmentId ?? shipmentId;
  const isDraft = status === "DRAFT";
  const selectedPo = useMemo(
    () => allocatableOrders.find((order) => order.id === selectedPoId) ?? null,
    [allocatableOrders, selectedPoId]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSavedShipmentId(shipmentId);
    setSelectedPoId(null);
    setLines([]);

    if (!shipmentId) {
      setSupplierId(suppliers[0]?.id ?? "");
      setForwarderEntityId(null);
      setStagingLocationId(null);
      setUltimateDestinationLocationId(locations[0]?.id ?? null);
      setIncotermsCode("");
      setBillOfLading("");
      setContainerInput("");
      setAwb("");
      setVesselName("");
      setPortOfLoading("");
      setPortOfDischarge("");
      setEtd("");
      setEta("");
      setBillOfEntryNumber("");
      setBillOfEntryDate("");
      setPortCode("");
      setExchangeRate("1");
      setAssessableValue("0");
      setCustomsDutyAmount("0");
      setImportIgstAmount("0");
      setNotes("");
      setStatus("DRAFT");
      setShipmentNumber(null);
      return;
    }

    startTransition(async () => {
      const result = await loadImportShipmentDetail(shipmentId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const { shipment, lines: existingLines } = result;
      setSupplierId(shipment.supplier_id ?? "");
      setForwarderEntityId(shipment.forwarder_entity_id);
      setStagingLocationId(shipment.staging_location_id);
      setUltimateDestinationLocationId(shipment.ultimate_destination_location_id);
      setIncotermsCode(shipment.incoterms_code ?? "");
      setBillOfLading(shipment.bill_of_lading ?? "");
      setContainerInput(shipment.container_numbers.join(", "));
      setAwb(shipment.awb ?? "");
      setVesselName(shipment.vessel_name ?? "");
      setPortOfLoading(shipment.port_of_loading ?? "");
      setPortOfDischarge(shipment.port_of_discharge ?? "");
      setEtd(shipment.etd ?? "");
      setEta(shipment.eta ?? "");
      setBillOfEntryNumber(shipment.bill_of_entry_number ?? "");
      setBillOfEntryDate(shipment.bill_of_entry_date ?? "");
      setPortCode(shipment.port_code ?? "");
      setExchangeRate(shipment.exchange_rate);
      setAssessableValue(shipment.assessable_value);
      setCustomsDutyAmount(shipment.customs_duty_amount);
      setImportIgstAmount(shipment.import_igst_amount);
      setNotes(shipment.notes ?? "");
      setStatus(shipment.status);
      setShipmentNumber(shipment.shipment_number);
      setLines(
        existingLines.map((line) => ({
          purchase_order_id: line.purchase_order_id,
          po_item_id: line.po_item_id,
          variant_id: line.variant_id,
          quantity_shipped: line.quantity_shipped,
          label: `${line.item_name} · ${line.variant_sku}`,
          purchase_order_number: line.purchase_order_number,
        }))
      );
    });
  }, [open, shipmentId, suppliers, locations]);

  useEffect(() => {
    if (!selectedPo) return;
    if (supplierId && selectedPo.supplier_id !== supplierId) return;
    if (!supplierId) setSupplierId(selectedPo.supplier_id);
    if (!ultimateDestinationLocationId) {
      setUltimateDestinationLocationId(selectedPo.destination_location_id);
    }
  }, [selectedPo, supplierId, ultimateDestinationLocationId]);

  const handleAddPoLines = () => {
    if (!selectedPo) return;
    setLines((current) => {
      const next = [...current];
      for (const line of selectedPo.lines) {
        if (next.some((entry) => entry.po_item_id === line.id)) continue;
        next.push({
          purchase_order_id: selectedPo.id,
          po_item_id: line.id,
          variant_id: line.variant_id,
          quantity_shipped: line.open_quantity,
          label: `${line.item_name} · ${line.variant_sku}`,
          purchase_order_number: selectedPo.voucher_number,
        });
      }
      return next;
    });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const purchaseOrderIds = [...new Set(lines.map((line) => line.purchase_order_id))];
      const saveResult = await saveImportShipment({
        shipment_id: activeShipmentId,
        supplier_id: supplierId,
        forwarder_entity_id: forwarderEntityId,
        staging_location_id: stagingLocationId,
        ultimate_destination_location_id: ultimateDestinationLocationId,
        incoterms_code: incotermsCode || null,
        bill_of_lading: billOfLading || null,
        container_numbers: containerInput
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        awb: awb || null,
        vessel_name: vesselName || null,
        port_of_loading: portOfLoading || null,
        port_of_discharge: portOfDischarge || null,
        etd: etd || null,
        eta: eta || null,
        bill_of_entry_number: billOfEntryNumber || null,
        bill_of_entry_date: billOfEntryDate || null,
        port_code: portCode || null,
        exchange_rate: exchangeRate,
        assessable_value: assessableValue,
        customs_duty_amount: customsDutyAmount,
        import_igst_amount: importIgstAmount,
        notes: notes || null,
        purchase_order_ids: purchaseOrderIds,
      });

      if ("error" in saveResult) {
        setError(saveResult.error ?? "Unable to save shipment.");
        return;
      }

      const nextShipmentId = saveResult.shipmentId;
      setSavedShipmentId(nextShipmentId);

      if (lines.length > 0) {
        const allocateResult = await allocatePoLinesToShipment({
          shipment_id: nextShipmentId,
          lines: lines.map((line) => ({
            purchase_order_id: line.purchase_order_id,
            po_item_id: line.po_item_id,
            variant_id: line.variant_id,
            quantity_shipped: line.quantity_shipped,
          })),
        });

        if ("error" in allocateResult) {
          setError(allocateResult.error ?? "Shipment saved but line allocation failed.");
          return;
        }
      }

      toast.success(activeShipmentId ? "Shipment updated." : "Draft shipment created.");
      onSaved();
      if (!activeShipmentId) {
        const detail = await loadImportShipmentDetail(nextShipmentId);
        if (!("error" in detail)) {
          setShipmentNumber(detail.shipment.shipment_number);
        }
      }
    });
  };

  const handleIssue = () => {
    if (!activeShipmentId) return;
    setError(null);
    startTransition(async () => {
      const result = await issueImportShipment(activeShipmentId);
      if ("error" in result) {
        setError(result.error ?? "Unable to issue shipment.");
        return;
      }
      toast.success(`Shipment ${result.shipmentNumber} booked.`);
      setStatus("BOOKED");
      setShipmentNumber(result.shipmentNumber);
      onSaved();
    });
  };

  const handleAdvanceStatus = () => {
    if (!activeShipmentId) return;
    const nextStatus = NEXT_STATUS[status];
    if (!nextStatus) return;
    setError(null);
    startTransition(async () => {
      const result = await updateImportShipmentStatus({
        shipment_id: activeShipmentId,
        status: nextStatus,
      });
      if ("error" in result) {
        setError(result.error ?? "Unable to update shipment status.");
        return;
      }
      toast.success(`Status updated to ${importShipmentStatusLabel(nextStatus)}.`);
      setStatus(nextStatus);
      onSaved();
    });
  };

  const handleCancel = () => {
    if (!activeShipmentId || status === "CANCELLED" || status === "CLOSED") return;
    setError(null);
    startTransition(async () => {
      const result = await updateImportShipmentStatus({
        shipment_id: activeShipmentId,
        status: "CANCELLED",
      });
      if ("error" in result) {
        setError(result.error ?? "Unable to cancel shipment.");
        return;
      }
      toast.success("Shipment cancelled.");
      setStatus("CANCELLED");
      onSaved();
    });
  };

  if (!open) return null;

  const nextStatus = NEXT_STATUS[status];

  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={shipmentNumber ? `Shipment ${shipmentNumber}` : "New import shipment"}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === "DRAFT" ? "default" : "active"}>
            {importShipmentStatusLabel(status)}
          </Badge>
          {shipmentNumber ? <span className="font-mono text-sm">{shipmentNumber}</span> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={!isDraft}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Forwarder / CHA (optional)</Label>
            <Select
              value={forwarderEntityId ?? "none"}
              onValueChange={(value) => setForwarderEntityId(value === "none" ? null : value)}
              disabled={!isDraft}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={`fwd-${supplier.id}`} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Staging location</Label>
            <Select
              value={stagingLocationId ?? "none"}
              onValueChange={(value) => setStagingLocationId(value === "none" ? null : value)}
              disabled={!isDraft}
            >
              <SelectTrigger>
                <SelectValue placeholder="Agent / port" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ultimate destination</Label>
            <Select
              value={ultimateDestinationLocationId ?? "none"}
              onValueChange={(value) =>
                setUltimateDestinationLocationId(value === "none" ? null : value)
              }
              disabled={!isDraft}
            >
              <SelectTrigger>
                <SelectValue placeholder="Main warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={`dest-${location.id}`} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Incoterms</Label>
            <Input value={incotermsCode} onChange={(e) => setIncotermsCode(e.target.value)} disabled={!isDraft} />
          </div>
          <div className="space-y-2">
            <Label>Bill of lading</Label>
            <Input value={billOfLading} onChange={(e) => setBillOfLading(e.target.value)} disabled={!isDraft} />
          </div>
          <div className="space-y-2">
            <Label>AWB</Label>
            <Input value={awb} onChange={(e) => setAwb(e.target.value)} disabled={!isDraft} />
          </div>
          <div className="space-y-2">
            <Label>Vessel</Label>
            <Input value={vesselName} onChange={(e) => setVesselName(e.target.value)} disabled={!isDraft} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Container numbers (comma-separated)</Label>
            <Input
              value={containerInput}
              onChange={(e) => setContainerInput(e.target.value)}
              disabled={!isDraft}
            />
          </div>
          <div className="space-y-2">
            <Label>Port of loading</Label>
            <Input value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} disabled={!isDraft} />
          </div>
          <div className="space-y-2">
            <Label>Port of discharge</Label>
            <Input value={portOfDischarge} onChange={(e) => setPortOfDischarge(e.target.value)} disabled={!isDraft} />
          </div>
          <div className="space-y-2">
            <Label>ETD</Label>
            <Input type="date" value={etd} onChange={(e) => setEtd(e.target.value)} disabled={!isDraft} />
          </div>
          <div className="space-y-2">
            <Label>ETA</Label>
            <Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} disabled={!isDraft} />
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="text-sm font-medium">Bill of entry (master)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>BoE number</Label>
              <Input
                value={billOfEntryNumber}
                onChange={(e) => setBillOfEntryNumber(e.target.value)}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>BoE date</Label>
              <Input
                type="date"
                value={billOfEntryDate}
                onChange={(e) => setBillOfEntryDate(e.target.value)}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>Port code</Label>
              <Input value={portCode} onChange={(e) => setPortCode(e.target.value)} disabled={!isDraft} />
            </div>
            <div className="space-y-2">
              <Label>Exchange rate</Label>
              <Input
                className="font-mono"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>Assessable value</Label>
              <Input
                className="font-mono"
                value={assessableValue}
                onChange={(e) => setAssessableValue(e.target.value)}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>Customs duty</Label>
              <Input
                className="font-mono"
                value={customsDutyAmount}
                onChange={(e) => setCustomsDutyAmount(e.target.value)}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Import IGST</Label>
              <Input
                className="font-mono"
                value={importIgstAmount}
                onChange={(e) => setImportIgstAmount(e.target.value)}
                disabled={!isDraft}
              />
            </div>
          </div>
        </div>

        {isDraft ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">PO line allocation</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1 space-y-2">
                <Label>Import purchase order</Label>
                <Select
                  value={selectedPoId ?? "none"}
                  onValueChange={(value) => setSelectedPoId(value === "none" ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select PO</SelectItem>
                    {allocatableOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.voucher_number} — {order.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" disabled={!selectedPo} onClick={handleAddPoLines}>
                Add open lines
              </Button>
            </div>

            {lines.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {lines.map((line) => (
                  <li key={line.po_item_id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {line.purchase_order_number} · {line.label}
                    </span>
                    <Input
                      className="w-24 text-right font-mono"
                      value={line.quantity_shipped}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((entry) =>
                            entry.po_item_id === line.po_item_id
                              ? { ...entry, quantity_shipped: event.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add lines from one or more import purchase orders. Partial shipments are supported.
              </p>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!isDraft} />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isDraft ? (
            <>
              <Button type="button" variant="outline" disabled={isPending || !supplierId} onClick={handleSave}>
                {isPending ? "Saving…" : "Save draft"}
              </Button>
              <Button
                type="button"
                disabled={isPending || !activeShipmentId || lines.length === 0}
                onClick={handleIssue}
              >
                {isPending ? "Booking…" : "Book shipment"}
              </Button>
            </>
          ) : (
            <>
              {nextStatus ? (
                <Button type="button" variant="outline" disabled={isPending} onClick={handleAdvanceStatus}>
                  Mark {importShipmentStatusLabel(nextStatus)}
                </Button>
              ) : null}
              {status !== "CANCELLED" && status !== "CLOSED" ? (
                <Button type="button" variant="destructive" disabled={isPending} onClick={handleCancel}>
                  Cancel shipment
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </RightDrawer>
  );
}

type ListProps = {
  shipments: ImportShipmentRow[];
  onRefresh: () => void;
  onEdit: (shipmentId: string) => void;
};

export function ShipmentList({ shipments, onRefresh, onEdit }: ListProps) {
  return (
    <div className="space-y-4">
      {shipments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No import shipments yet. Create a shipment to allocate overseas purchase order lines and
          track inbound logistics.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {shipments.map((shipment) => (
            <li key={shipment.id}>
              <button
                type="button"
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40"
                onClick={() => onEdit(shipment.id)}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{shipment.shipment_number}</span>
                    <Badge variant={shipment.status === "DRAFT" ? "default" : "active"}>
                      {importShipmentStatusLabel(shipment.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {shipment.supplier_name}
                    {shipment.purchase_order_numbers.length > 0
                      ? ` · PO ${shipment.purchase_order_numbers.join(", ")}`
                      : ""}
                    {shipment.eta ? ` · ETA ${formatDate(shipment.eta)}` : ""}
                  </p>
                </div>
                <span className="text-sm font-medium">{shipment.line_count} lines</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  );
}
