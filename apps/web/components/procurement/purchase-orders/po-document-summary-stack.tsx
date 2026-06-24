"use client";

import type { ComponentProps, ReactNode } from "react";
import { PoDetailsPanel } from "@/components/procurement/purchase-orders/po-details-panel";
import { PoNotesPanel } from "@/components/procurement/purchase-orders/po-notes-panel";
import { PoTotalsPanel } from "@/components/procurement/purchase-orders/po-totals-panel";
import { cn } from "@/lib/utils";

const PO_SUMMARY_STACK_SECTION_TITLE_CLASS =
  "shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

type TotalsPanelProps = ComponentProps<typeof PoTotalsPanel>;
type DetailsPanelProps = ComponentProps<typeof PoDetailsPanel>;
type NotesPanelProps = ComponentProps<typeof PoNotesPanel>;

type Props = {
  variant: "rail" | "flow";
  showNotesSection: boolean;
  importLogisticsSection?: ReactNode;
  totalsPanelProps: TotalsPanelProps;
  detailsPanelProps: DetailsPanelProps;
  notesPanelProps: NotesPanelProps;
  className?: string;
};

function SummaryStackSections({
  showNotesSection,
  importLogisticsSection,
  totalsPanelProps,
  detailsPanelProps,
  notesPanelProps,
}: Omit<Props, "variant" | "className">) {
  return (
    <>
      <section className="flex shrink-0 flex-col gap-1.5">
        <p className={PO_SUMMARY_STACK_SECTION_TITLE_CLASS}>Summary</p>
        <PoTotalsPanel {...totalsPanelProps} />
      </section>
      <section className="flex shrink-0 flex-col gap-1.5">
        <p className={PO_SUMMARY_STACK_SECTION_TITLE_CLASS}>Details</p>
        <PoDetailsPanel {...detailsPanelProps} />
      </section>
      {importLogisticsSection ? (
        <section className="flex shrink-0 flex-col gap-1.5">
          <p className={PO_SUMMARY_STACK_SECTION_TITLE_CLASS}>Import</p>
          {importLogisticsSection}
        </section>
      ) : null}
      {showNotesSection ? (
        <section className="flex shrink-0 flex-col gap-1.5">
          <p className={PO_SUMMARY_STACK_SECTION_TITLE_CLASS}>Notes</p>
          <PoNotesPanel {...notesPanelProps} />
        </section>
      ) : null}
    </>
  );
}

export function PoDocumentSummaryStack({
  variant,
  showNotesSection,
  importLogisticsSection,
  totalsPanelProps,
  detailsPanelProps,
  notesPanelProps,
  className,
}: Props) {
  const sections = (
    <SummaryStackSections
      showNotesSection={showNotesSection}
      importLogisticsSection={importLogisticsSection}
      totalsPanelProps={totalsPanelProps}
      detailsPanelProps={detailsPanelProps}
      notesPanelProps={notesPanelProps}
    />
  );

  if (variant === "flow") {
    return <div className={cn("flex flex-col gap-3", className)}>{sections}</div>;
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="flex flex-col gap-3 pb-1">{sections}</div>
      </div>
    </div>
  );
}

export type {
  TotalsPanelProps as PoDocumentSummaryStackTotalsPanelProps,
  DetailsPanelProps as PoDocumentSummaryStackDetailsPanelProps,
  NotesPanelProps as PoDocumentSummaryStackNotesPanelProps,
};
