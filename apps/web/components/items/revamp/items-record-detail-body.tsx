"use client";

import type { ReactNode } from "react";
import { Package } from "lucide-react";
import {
  buildItemsRecordDetailView,
  type ItemsRecordDetailView,
} from "@/components/items/revamp/items-record-detail-model";
import { ItemsMatrixField } from "@/components/items/revamp/items-matrix-table";
import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  detail: ProductDetailSnapshot | null;
  row: ProductListRow | null;
  variant?: "spatial" | "matrix";
  className?: string;
};

function SpatialField({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="spatial-field-label">{label}</span>
      <span className={cn("spatial-field-value", mono && "spatial-field-value--mono")}>{value}</span>
    </div>
  );
}

function SpatialSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="spatial-glass-block">
      <h3 className="spatial-detail-section-title">{title}</h3>
      {children}
    </div>
  );
}

function AvailabilityFlags({ view }: { view: ItemsRecordDetailView }) {
  const flags = [
    { label: "Purchasable", active: view.purchasable },
    { label: "Salable", active: view.salable },
    { label: "Returnable", active: view.returnable },
  ];

  return (
    <div className="spatial-detail-flags">
      {flags.map((flag) => (
        <span
          key={flag.label}
          className={cn(
            "spatial-detail-flag",
            flag.active ? "spatial-detail-flag--on" : "spatial-detail-flag--off"
          )}
        >
          {flag.label}
        </span>
      ))}
    </div>
  );
}

function SpatialDetailBody({ view }: { view: ItemsRecordDetailView }) {
  return (
    <>
      <div className="spatial-glass-block spatial-detail-summary">
        <div className="spatial-detail-grid">
          <SpatialField label="Selling price" value={view.selling} mono />
          <SpatialField label="Lifecycle status" value={view.status} />
          <SpatialField label="MRP" value={view.mrp} mono />
          <SpatialField label="Purchase price" value={view.purchase} mono />
        </div>
      </div>

      <SpatialSection title="Classification & inventory">
        <div className="spatial-detail-grid">
          <SpatialField label="Classification" value={view.classification} />
          <SpatialField label="Category" value={view.category} />
          <SpatialField label="Base UOM" value={view.uom} />
          <SpatialField label="Stock on hand" value={view.stock} mono />
          <SpatialField label="Tax category" value={view.tax} />
          <SpatialField label="HSN / SAC" value={view.hsn} mono />
        </div>
      </SpatialSection>

      {view.supplier ? (
        <SpatialSection title="Supply chain">
          <SpatialField label="Primary supplier" value={view.supplier} />
        </SpatialSection>
      ) : null}

      <SpatialSection title="Availability">
        <AvailabilityFlags view={view} />
      </SpatialSection>

      {view.description ? (
        <SpatialSection title="Notes & description">
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{view.description}</p>
        </SpatialSection>
      ) : null}

      <p className="spatial-detail-footer">{view.updatedLabel}</p>
    </>
  );
}

function MatrixDetailBody({ view }: { view: ItemsRecordDetailView }) {
  return (
    <>
      <div className="matrix-form-section">
        <h4 className="matrix-form-section-title">Commercial profile</h4>
        <div className="matrix-input-row-grid">
          <ItemsMatrixField label="Selling price" value={view.selling} mono />
          <ItemsMatrixField label="MRP" value={view.mrp} mono />
          <ItemsMatrixField label="Purchase price" value={view.purchase} mono />
          <ItemsMatrixField label="Lifecycle status" value={view.status} />
        </div>
      </div>

      <div className="matrix-form-section">
        <h4 className="matrix-form-section-title">Classification & inventory</h4>
        <div className="matrix-input-row-grid">
          <ItemsMatrixField label="Classification" value={view.classification} />
          <ItemsMatrixField label="Category" value={view.category} />
          <ItemsMatrixField label="Base UOM" value={view.uom} />
          <ItemsMatrixField label="Stock on hand" value={view.stock} mono />
          <ItemsMatrixField label="Tax category" value={view.tax} />
          <ItemsMatrixField label="HSN / SAC" value={view.hsn} mono />
        </div>
      </div>

      {view.supplier ? (
        <div className="matrix-form-section">
          <h4 className="matrix-form-section-title">Supply chain</h4>
          <ItemsMatrixField label="Primary supplier" value={view.supplier} />
        </div>
      ) : null}

      <div className="matrix-form-section">
        <h4 className="matrix-form-section-title">Availability</h4>
        <div className="matrix-input-row-grid">
          <ItemsMatrixField label="Purchasable" value={view.purchasable ? "Yes" : "No"} />
          <ItemsMatrixField label="Salable" value={view.salable ? "Yes" : "No"} />
          <ItemsMatrixField label="Returnable" value={view.returnable ? "Yes" : "No"} />
        </div>
      </div>

      {view.description ? (
        <div className="matrix-form-section">
          <h4 className="matrix-form-section-title">Notes</h4>
          <ItemsMatrixField label="Description" value={view.description} />
        </div>
      ) : null}

      <p className="matrix-form-hint">{view.updatedLabel}</p>
    </>
  );
}

export function ItemsRecordDetailBody({
  detail,
  row,
  variant = "spatial",
  className,
}: Props) {
  const view = buildItemsRecordDetailView(detail, row);

  return (
    <div className={className}>
      {variant === "spatial" ? <SpatialDetailBody view={view} /> : <MatrixDetailBody view={view} />}
    </div>
  );
}

export function ItemsRecordDetailHero({
  detail,
  row,
}: {
  detail: ProductDetailSnapshot | null;
  row: ProductListRow | null;
}) {
  const view = buildItemsRecordDetailView(detail, row);

  return (
    <div className="spatial-detail-hero">
      <div className="spatial-detail-hero__media">
        {view.imageUrl ? (
          <img src={view.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Package className="h-5 w-5 text-primary/70" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "spatial-detail-status",
              view.statusTone === "active" && "spatial-detail-status--active",
              view.statusTone === "warning" && "spatial-detail-status--warning",
              view.statusTone === "inactive" && "spatial-detail-status--inactive"
            )}
          >
            {view.status}
          </span>
          <span className="text-[11px] text-muted-foreground">{view.updatedLabel}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {view.classification} • {view.category}
        </p>
      </div>
    </div>
  );
}

export { buildItemsRecordDetailView };
