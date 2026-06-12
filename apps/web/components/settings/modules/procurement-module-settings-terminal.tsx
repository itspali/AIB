"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PurchaseOrderDocumentLayoutPanel } from "@/components/settings/document-layout/purchase-order-document-layout-panel";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import { ProcurementPoliciesPanel } from "@/components/settings/modules/procurement-policies-panel";

type Props = {
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
  initialLayout: DocumentLayoutTemplate;
  procurementSettings: Pick<
    import("@/lib/procurement/settings").ProcurementSettings,
    | "po_auto_round_off_enabled"
    | "po_auto_round_off_step"
    | "is_po_mandatory_for_grn"
    | "is_qc_required_before_stocking"
    | "allow_zero_cost_receipts"
    | "promo_default_category"
    | "landed_cost_allocation_method"
    | "absorb_sunk_logistics_overhead"
    | "matching_tolerance_percentage"
  >;
};

export function ProcurementModuleSettingsTerminal({
  locations,
  canEdit,
  catalogFieldSuggestions,
  initialLayout,
  procurementSettings,
}: Props) {
  return (
    <div className="canvas-scroll-endpad space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-xs" asChild>
          <Link href="/settings/modules">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
            Modules
          </Link>
        </Button>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-lg font-semibold tracking-tight">Procurement</h1>
      </div>

      <Tabs defaultValue="layout">
        <TabsList className="h-8">
          <TabsTrigger value="layout" className="h-7 px-3 text-xs">
            Document layout
          </TabsTrigger>
          <TabsTrigger value="policies" className="h-7 px-3 text-xs">
            Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="mt-2">
          <PurchaseOrderDocumentLayoutPanel
            initialLayout={initialLayout}
            locations={locations}
            canEdit={canEdit}
            catalogFieldSuggestions={catalogFieldSuggestions}
          />
        </TabsContent>

        <TabsContent value="policies" className="mt-2">
          <ProcurementPoliciesPanel
            canEdit={canEdit}
            initialSettings={{
              po_auto_round_off_enabled: procurementSettings.po_auto_round_off_enabled,
              po_auto_round_off_step: procurementSettings.po_auto_round_off_step,
              is_po_mandatory_for_grn: procurementSettings.is_po_mandatory_for_grn,
              is_qc_required_before_stocking: procurementSettings.is_qc_required_before_stocking,
              allow_zero_cost_receipts: procurementSettings.allow_zero_cost_receipts,
              promo_default_category: procurementSettings.promo_default_category,
              landed_cost_allocation_method: procurementSettings.landed_cost_allocation_method,
              absorb_sunk_logistics_overhead: procurementSettings.absorb_sunk_logistics_overhead,
              matching_tolerance_percentage: procurementSettings.matching_tolerance_percentage,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
