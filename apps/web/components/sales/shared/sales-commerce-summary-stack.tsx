"use client";

import type { ComponentProps } from "react";
import { SalesCommerceDetailsPanel } from "@/components/sales/shared/sales-commerce-details-panel";
import { SalesCommerceNotesPanel } from "@/components/sales/shared/sales-commerce-notes-panel";
import { SalesCommerceTotalsPanel } from "@/components/sales/shared/sales-commerce-totals-panel";
import { cn } from "@/lib/utils";

const SALES_SUMMARY_STACK_SECTION_TITLE_CLASS =
  "shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

type TotalsPanelProps<TLine> = ComponentProps<typeof SalesCommerceTotalsPanel<TLine>>;
type DetailsPanelProps = ComponentProps<typeof SalesCommerceDetailsPanel>;
type NotesPanelProps = ComponentProps<typeof SalesCommerceNotesPanel>;

type Props<TLine> = {
  variant: "rail" | "flow";
  showNotesSection: boolean;
  totalsPanelProps: TotalsPanelProps<TLine>;
  detailsPanelProps: DetailsPanelProps;
  notesPanelProps: NotesPanelProps;
  className?: string;
};

function SummaryStackSections<TLine>({
  showNotesSection,
  totalsPanelProps,
  detailsPanelProps,
  notesPanelProps,
}: Omit<Props<TLine>, "variant" | "className">) {
  return (
    <>
      <section className="flex shrink-0 flex-col gap-1.5">
        <p className={SALES_SUMMARY_STACK_SECTION_TITLE_CLASS}>Summary</p>
        <SalesCommerceTotalsPanel {...totalsPanelProps} />
      </section>
      <section className="flex shrink-0 flex-col gap-1.5">
        <p className={SALES_SUMMARY_STACK_SECTION_TITLE_CLASS}>Details</p>
        <SalesCommerceDetailsPanel {...detailsPanelProps} />
      </section>
      {showNotesSection ? (
        <section className="flex shrink-0 flex-col gap-1.5">
          <p className={SALES_SUMMARY_STACK_SECTION_TITLE_CLASS}>Notes</p>
          <SalesCommerceNotesPanel {...notesPanelProps} />
        </section>
      ) : null}
    </>
  );
}

export function SalesCommerceSummaryStack<TLine>({
  variant,
  showNotesSection,
  totalsPanelProps,
  detailsPanelProps,
  notesPanelProps,
  className,
}: Props<TLine>) {
  const sections = (
    <SummaryStackSections
      showNotesSection={showNotesSection}
      totalsPanelProps={totalsPanelProps}
      detailsPanelProps={detailsPanelProps}
      notesPanelProps={notesPanelProps}
    />
  );

  if (variant === "flow") {
    return <div className={cn("flex flex-col gap-4", className)}>{sections}</div>;
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="flex flex-col gap-4 pb-1">{sections}</div>
      </div>
    </div>
  );
}
