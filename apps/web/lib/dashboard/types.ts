export type PipelineCounts = {
  fullyPaid: number;
  dispatchedInTransit: number;
  creditHold: number;
};

export type DashboardKpiCounts = {
  pendingApprovals: number;
  creditHolds: number;
};

export type DashboardMetrics = {
  netCapitalExposure: number;
  inventoryValuation: number;
  pipelineCounts: PipelineCounts;
  sparklines: MetricSparklines;
  kpiCounts: DashboardKpiCounts;
};

export type DashboardAttentionKind =
  | "APPROVAL"
  | "CREDIT_HOLD"
  | "TRANSFER_APPROVAL";

export type DashboardAttentionItem = {
  id: string;
  kind: DashboardAttentionKind;
  title: string;
  subtitle: string | null;
  amountLabel: string | null;
  href: string;
  submittedAt: string | null;
};

export type MetricSparklines = {
  netCapital: number[];
  inventory: number[];
  pipeline: number[];
};

export type WorkspaceControls = {
  allowLineItemDiscounts: boolean;
  accountingPeriodClosingDate: string | null;
};

export type TaxRateSlabRow = {
  id: string;
  tax_component_name: string;
  tax_percentage: number;
  active_from_date: string;
  active_to_date: string | null;
  legal_compliance_code: string | null;
};

export type TaxRateSlabInput = {
  tax_component_name: string;
  tax_percentage: string;
  active_from_date: string;
  active_to_date?: string;
  legal_compliance_code?: string;
};
