"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { saveSalesApprovalSettings } from "@/app/settings/modules/sales/actions";
import { ApprovalExtraStepsEditor } from "@/components/settings/approvals/approval-extra-steps-editor";
import {
  ApprovalWorkflowTemplatePicker,
  type WorkflowChoice,
} from "@/components/settings/approvals/approval-workflow-template-picker";
import { ApprovalRulesEditor } from "@/components/settings/approvals/approval-rules-editor";
import { ProcurementPoApproversSection } from "@/components/settings/modules/procurement-po-approvers-section";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { defaultPoApprovalRules, hasEnabledPoApprovalRules } from "@/lib/approvals/approval-rules";
import type { ApprovalPolicyBand } from "@/lib/approvals/policy-types";
import {
  buildApprovalPlainSummary,
  resolveApprovalScopeModeFromBands,
  workflowBandsFromThreshold,
  type ApprovalScopeMode,
} from "@/lib/approvals/plain-summary";
import {
  buildManagerChainFinanceLevels,
  resolveWorkflowChoiceFromBands,
} from "@/lib/approvals/workflow-templates";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";
import { cn } from "@/lib/utils";

type SalesDocKind = "so" | "quote" | "invoice";

type DocConfig = {
  kind: SalesDocKind;
  tabLabel: string;
  title: string;
  enableDescription: string;
  disabledSummary: string;
  wording: {
    draftNoun: string;
    finalAction: string;
    submitterNoun: string;
  };
};

const DOC_CONFIGS: DocConfig[] = [
  {
    kind: "so",
    tabLabel: "Sales orders",
    title: "Sales order approval",
    enableDescription: "When on, a sales order must be approved before it is confirmed.",
    disabledSummary: "Draft sales orders can be confirmed immediately.",
    wording: {
      draftNoun: "sales order",
      finalAction: "confirmed",
      submitterNoun: "seller",
    },
  },
  {
    kind: "quote",
    tabLabel: "Quotations",
    title: "Quotation approval",
    enableDescription: "When on, a quotation must be approved before it is sent to the customer.",
    disabledSummary: "Draft quotations can be sent to customers immediately.",
    wording: {
      draftNoun: "quotation",
      finalAction: "sent to the customer",
      submitterNoun: "seller",
    },
  },
  {
    kind: "invoice",
    tabLabel: "Invoices",
    title: "Sales invoice approval",
    enableDescription: "When on, a sales invoice must be approved before it is posted.",
    disabledSummary: "Draft sales invoices can be posted immediately.",
    wording: {
      draftNoun: "sales invoice",
      finalAction: "posted",
      submitterNoun: "seller",
    },
  },
];

type Props = {
  initialSettings: SalesApprovalSettings;
  eligibleUsers: WorkspaceEligibleUser[];
  approverProfiles: WorkspaceEligibleUser[];
  canEdit: boolean;
  onSave?: (settings: SalesApprovalSettings) => Promise<{ error?: string } | { success: true }>;
};

function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {step}
      </span>
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
}

function ChoiceCard({
  selected,
  title,
  description,
  disabled,
  onSelect,
  children,
}: {
  selected: boolean;
  title: string;
  description: string;
  disabled?: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-4 py-3 text-left transition-colors",
        selected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/30",
        disabled && "opacity-60"
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      {selected ? children : null}
    </button>
  );
}

function getRequireKey(kind: SalesDocKind): keyof SalesApprovalSettings {
  if (kind === "so") return "require_so_approval_before_confirm";
  if (kind === "quote") return "require_quote_approval_before_confirm";
  return "require_invoice_approval_before_post";
}

function getThreshold(settings: SalesApprovalSettings, kind: SalesDocKind): number | null {
  if (kind === "so") return settings.so_approval_threshold_amount;
  if (kind === "quote") return settings.quote_approval_threshold_amount;
  return settings.invoice_approval_threshold_amount;
}

function getApproverUserIds(settings: SalesApprovalSettings, kind: SalesDocKind): string[] {
  if (kind === "so") return settings.so_approver_user_ids;
  if (kind === "quote") return settings.quote_approver_user_ids;
  return settings.invoice_approver_user_ids;
}

function getApproverRoles(settings: SalesApprovalSettings, kind: SalesDocKind) {
  if (kind === "so") return settings.so_approver_roles ?? [];
  if (kind === "quote") return settings.quote_approver_roles ?? [];
  return settings.invoice_approver_roles ?? [];
}

function getApprovalRules(settings: SalesApprovalSettings, kind: SalesDocKind) {
  if (kind === "so") return settings.so_approval_rules ?? defaultPoApprovalRules();
  if (kind === "quote") return settings.quote_approval_rules ?? defaultPoApprovalRules();
  return settings.invoice_approval_rules ?? defaultPoApprovalRules();
}

function getFinanceApproverUserIds(settings: SalesApprovalSettings, kind: SalesDocKind): string[] {
  if (kind === "so") return settings.so_finance_approver_user_ids ?? [];
  if (kind === "quote") return settings.quote_finance_approver_user_ids ?? [];
  return settings.invoice_finance_approver_user_ids ?? [];
}

function getApprovalBands(settings: SalesApprovalSettings, kind: SalesDocKind) {
  if (kind === "so") return settings.so_approval_bands;
  if (kind === "quote") return settings.quote_approval_bands;
  return settings.invoice_approval_bands;
}

function getWorkflowTemplate(settings: SalesApprovalSettings, kind: SalesDocKind) {
  if (kind === "so") return settings.so_workflow_template;
  if (kind === "quote") return settings.quote_workflow_template;
  return settings.invoice_workflow_template;
}

function buildDocPayload(
  settings: SalesApprovalSettings,
  kind: SalesDocKind,
  scopeMode: ApprovalScopeMode,
  workflowChoice: WorkflowChoice,
  workflowBands: ApprovalPolicyBand[]
): Partial<SalesApprovalSettings> {
  const prefix = kind;
  const thresholdKey = `${prefix}_approval_threshold_amount` as const;
  const threshold = scopeMode === "all" ? null : getThreshold(settings, kind);

  const approverUserIds = getApproverUserIds(settings, kind);
  const approverRoles = getApproverRoles(settings, kind);
  const financeIds = getFinanceApproverUserIds(settings, kind);

  const defaultLevel = {
    steps: [{ label: "Approvers", quorum: "ANY" as const, pool: "default", assignee: "POOL" as const }],
  };
  const defaultPool = { user_ids: approverUserIds, roles: approverRoles };
  const financePool = { user_ids: financeIds, roles: [] as Array<"ADMIN" | "MANAGER"> };

  const skipBand =
    scopeMode === "small_orders_exempt" && threshold != null
      ? [
          {
            min_amount: 0,
            max_amount: threshold,
            skip: true as const,
            self_approve: settings.allow_submitter_self_approve_below_threshold,
          },
        ]
      : [];
  const approvalMin = scopeMode === "small_orders_exempt" && threshold != null ? threshold : 0;

  let workflowBand: ApprovalPolicyBand;
  let workflowTemplate: "standard" | "manager_chain_finance" | "custom";

  if (workflowChoice === "manager_chain_finance") {
    workflowTemplate = "manager_chain_finance";
    workflowBand = {
      min_amount: approvalMin,
      max_amount: null,
      levels: buildManagerChainFinanceLevels(),
    };
  } else if (workflowChoice === "custom") {
    workflowTemplate = "custom";
    workflowBand = {
      ...(workflowBands[0] ?? { min_amount: approvalMin, max_amount: null, levels: [defaultLevel] }),
      min_amount: approvalMin,
    };
  } else {
    workflowTemplate = "standard";
    workflowBand = {
      min_amount: approvalMin,
      max_amount: null,
      levels: [defaultLevel],
    };
  }

  const bands = [...skipBand, workflowBand];
  const pools = {
    default: defaultPool,
    ...(workflowChoice === "manager_chain_finance" ? { finance: financePool } : {}),
  };

  return {
    [getRequireKey(kind)]: settings[getRequireKey(kind)],
    [thresholdKey]: threshold,
    [`${prefix}_approver_user_ids`]: approverUserIds,
    [`${prefix}_approver_roles`]: approverRoles,
    [`${prefix}_approval_rules`]: getApprovalRules(settings, kind),
    [`${prefix}_workflow_template`]: workflowTemplate,
    [`${prefix}_finance_approver_user_ids`]: financeIds,
    [`${prefix}_approval_bands`]: bands,
    [`${prefix}_approver_pools`]: pools,
  } as Partial<SalesApprovalSettings>;
}

function SalesDocumentApprovalsSection({
  config,
  settings,
  scopeMode,
  workflowChoice,
  workflowBands,
  rulesOpen,
  canEdit,
  eligibleUsers,
  approverProfiles,
  onPatch,
  onScopeChange,
  onWorkflowChoiceChange,
  onWorkflowBandsChange,
  onRulesOpenChange,
}: {
  config: DocConfig;
  settings: SalesApprovalSettings;
  scopeMode: ApprovalScopeMode;
  workflowChoice: WorkflowChoice;
  workflowBands: ApprovalPolicyBand[];
  rulesOpen: boolean;
  canEdit: boolean;
  eligibleUsers: WorkspaceEligibleUser[];
  approverProfiles: WorkspaceEligibleUser[];
  onPatch: (partial: Partial<SalesApprovalSettings>) => void;
  onScopeChange: (mode: ApprovalScopeMode) => void;
  onWorkflowChoiceChange: (choice: WorkflowChoice) => void;
  onWorkflowBandsChange: (bands: ApprovalPolicyBand[]) => void;
  onRulesOpenChange: (open: boolean) => void;
}) {
  const { kind } = config;
  const requireKey = getRequireKey(kind);
  const enabled = Boolean(settings[requireKey]);
  const approverUserIds = getApproverUserIds(settings, kind);
  const approverRoles = getApproverRoles(settings, kind);
  const threshold = getThreshold(settings, kind);
  const rulesKey =
    kind === "so"
      ? "so_approval_rules"
      : kind === "quote"
        ? "quote_approval_rules"
        : "invoice_approval_rules";

  const approverProfilesForSection = approverProfiles.length
    ? approverProfiles
    : eligibleUsers.filter((user) => approverUserIds.includes(user.id));

  const previewLines = useMemo(
    () =>
      buildApprovalPlainSummary({
        enabled,
        scopeMode,
        thresholdAmount: threshold,
        allowSelfApproveSmall: settings.allow_submitter_self_approve_below_threshold,
        approverCount: approverUserIds.length + approverRoles.length,
        extraStepCount:
          workflowChoice === "manager_chain_finance"
            ? 2
            : workflowChoice === "custom"
              ? (workflowBands[0]?.levels?.length ?? 1)
              : 1,
        enabledRules: getApprovalRules(settings, kind),
        workflowChoice,
        respectDestinationLocation: false,
        wording: config.wording,
        disabledSummary: config.disabledSummary,
      }),
    [
      approverRoles.length,
      approverUserIds.length,
      config,
      enabled,
      kind,
      scopeMode,
      settings.allow_submitter_self_approve_below_threshold,
      threshold,
      workflowBands,
      workflowChoice,
    ]
  );

  return (
    <OrgSettingsSection title={config.title} description={config.enableDescription}>
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
          <StepHeader step={1} title="Turn approval on or off" />
          <div className="mt-3 flex items-center justify-between gap-3 pl-8">
            <p className="text-sm text-muted-foreground">{config.enableDescription}</p>
            <Switch
              checked={enabled}
              disabled={!canEdit}
              onCheckedChange={(checked) =>
                onPatch({ [requireKey]: checked } as Partial<SalesApprovalSettings>)
              }
            />
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-primary/25 bg-primary/5 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">What happens</p>
          <ul className="mt-2 space-y-1.5">
            {previewLines.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {enabled ? (
          <>
            <div className="rounded-lg border border-border px-4 py-3">
              <StepHeader step={2} title="Who can approve?" />
              <div className="mt-3 pl-8">
                <ProcurementPoApproversSection
                  approverUserIds={approverUserIds}
                  approverRoles={approverRoles}
                  approverProfiles={approverProfilesForSection}
                  eligibleUsers={eligibleUsers.filter((user) => !approverUserIds.includes(user.id))}
                  canEdit={canEdit}
                  onChangeUsers={(ids) =>
                    onPatch({ [`${kind}_approver_user_ids`]: ids } as Partial<SalesApprovalSettings>)
                  }
                  onChangeRoles={(roles) =>
                    onPatch({ [`${kind}_approver_roles`]: roles } as Partial<SalesApprovalSettings>)
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border border-border px-4 py-3">
              <StepHeader step={3} title="Which documents need approval?" />
              <div className="mt-3 space-y-2 pl-8">
                <ChoiceCard
                  selected={scopeMode === "all"}
                  title={`Every ${config.wording.draftNoun}`}
                  description="Even small amounts must be approved."
                  disabled={!canEdit}
                  onSelect={() => onScopeChange("all")}
                />
                <ChoiceCard
                  selected={scopeMode === "small_orders_exempt"}
                  title="Small amounts are exempt"
                  description="Documents below an amount you choose can skip approval."
                  disabled={!canEdit}
                  onSelect={() => onScopeChange("small_orders_exempt")}
                >
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <div className="space-y-1">
                      <Label htmlFor={`${kind}-exempt-amount`}>No approval needed under</Label>
                      <Input
                        id={`${kind}-exempt-amount`}
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!canEdit}
                        value={threshold ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          onPatch({
                            [`${kind}_approval_threshold_amount`]:
                              raw === "" ? null : Number(raw),
                          } as Partial<SalesApprovalSettings>);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                      <div>
                        <p className="text-sm">
                          {config.wording.submitterNoun.charAt(0).toUpperCase()}
                          {config.wording.submitterNoun.slice(1)}s can approve their own small documents
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Only if they are in your approver list above. Applies across all sales document types.
                        </p>
                      </div>
                      <Switch
                        checked={settings.allow_submitter_self_approve_below_threshold}
                        disabled={!canEdit}
                        onCheckedChange={(checked) =>
                          onPatch({ allow_submitter_self_approve_below_threshold: checked })
                        }
                      />
                    </div>
                  </div>
                </ChoiceCard>
              </div>
            </div>

            <div className="rounded-lg border border-border px-4 py-3">
              <StepHeader step={4} title="Approval workflow" />
              <div className="mt-3 pl-8">
                <ApprovalWorkflowTemplatePicker
                  value={workflowChoice}
                  financeApproverUserIds={getFinanceApproverUserIds(settings, kind)}
                  eligibleUsers={eligibleUsers}
                  disabled={!canEdit}
                  onChange={onWorkflowChoiceChange}
                  onFinanceApproversChange={(ids) =>
                    onPatch({
                      [`${kind}_finance_approver_user_ids`]: ids,
                    } as Partial<SalesApprovalSettings>)
                  }
                />
                {workflowChoice === "custom" ? (
                  <div className="mt-3">
                    <ApprovalExtraStepsEditor
                      bands={workflowBands}
                      disabled={!canEdit}
                      onChange={onWorkflowBandsChange}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <StepHeader step={5} title="Extra approval triggers" />
                <Switch
                  checked={rulesOpen}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => {
                    onRulesOpenChange(checked);
                    if (!checked) {
                      onPatch({
                        [rulesKey]: getApprovalRules(settings, kind).map((rule) => ({
                          ...rule,
                          enabled: false,
                        })),
                      } as Partial<SalesApprovalSettings>);
                    }
                  }}
                />
              </div>
              <p className="mt-1 pl-8 text-xs text-muted-foreground">
                Require approval when prices or quantities look unusual — even on small documents.
              </p>
              {rulesOpen ? (
                <div className="mt-3 pl-8">
                  <ApprovalRulesEditor
                    rules={getApprovalRules(settings, kind)}
                    disabled={!canEdit}
                    onChange={(rules) =>
                      onPatch({ [rulesKey]: rules } as Partial<SalesApprovalSettings>)
                    }
                  />
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </OrgSettingsSection>
  );
}

export function SalesApprovalsPanel({
  initialSettings,
  eligibleUsers,
  approverProfiles,
  canEdit,
  onSave = saveSalesApprovalSettings,
}: Props) {
  const [settings, setSettings] = useState<SalesApprovalSettings>(() => ({
    ...initialSettings,
    so_approver_roles: initialSettings.so_approver_roles ?? [],
    so_approval_rules: initialSettings.so_approval_rules ?? defaultPoApprovalRules(),
    so_finance_approver_user_ids: initialSettings.so_finance_approver_user_ids ?? [],
    quote_approver_roles: initialSettings.quote_approver_roles ?? [],
    quote_approval_rules: initialSettings.quote_approval_rules ?? defaultPoApprovalRules(),
    quote_finance_approver_user_ids: initialSettings.quote_finance_approver_user_ids ?? [],
    invoice_approver_roles: initialSettings.invoice_approver_roles ?? [],
    invoice_approval_rules: initialSettings.invoice_approval_rules ?? defaultPoApprovalRules(),
    invoice_finance_approver_user_ids: initialSettings.invoice_finance_approver_user_ids ?? [],
  }));
  const [isPending, startTransition] = useTransition();
  const [activeDoc, setActiveDoc] = useState<SalesDocKind>("so");

  const initialScopeModes = useMemo(
    () =>
      Object.fromEntries(
        DOC_CONFIGS.map((config) => [
          config.kind,
          resolveApprovalScopeModeFromBands(
            getThreshold(initialSettings, config.kind),
            getApprovalBands(initialSettings, config.kind)
          ),
        ])
      ) as Record<SalesDocKind, ApprovalScopeMode>,
    [initialSettings]
  );

  const [scopeModes, setScopeModes] =
    useState<Record<SalesDocKind, ApprovalScopeMode>>(initialScopeModes);

  const initialWorkflowChoices = useMemo(
    () =>
      Object.fromEntries(
        DOC_CONFIGS.map((config) => [
          config.kind,
          resolveWorkflowChoiceFromBands(
            getWorkflowTemplate(initialSettings, config.kind),
            getApprovalBands(initialSettings, config.kind)
          ),
        ])
      ) as Record<SalesDocKind, WorkflowChoice>,
    [initialSettings]
  );

  const [workflowChoices, setWorkflowChoices] =
    useState<Record<SalesDocKind, WorkflowChoice>>(initialWorkflowChoices);

  const initialWorkflowBandsMap = useMemo(
    () =>
      Object.fromEntries(
        DOC_CONFIGS.map((config) => [
          config.kind,
          workflowBandsFromThreshold(
            getThreshold(initialSettings, config.kind),
            getApprovalBands(initialSettings, config.kind)
          ),
        ])
      ) as Record<SalesDocKind, ApprovalPolicyBand[]>,
    [initialSettings]
  );

  const [workflowBandsMap, setWorkflowBandsMap] =
    useState<Record<SalesDocKind, ApprovalPolicyBand[]>>(initialWorkflowBandsMap);

  const [rulesOpenMap, setRulesOpenMap] = useState<Record<SalesDocKind, boolean>>(() =>
    Object.fromEntries(
      DOC_CONFIGS.map((config) => [
        config.kind,
        hasEnabledPoApprovalRules(getApprovalRules(initialSettings, config.kind)),
      ])
    ) as Record<SalesDocKind, boolean>
  );

  const isDirty = useMemo(() => {
    if (JSON.stringify(settings) !== JSON.stringify(initialSettings)) return true;
    return DOC_CONFIGS.some((config) => {
      const kind = config.kind;
      if (scopeModes[kind] !== initialScopeModes[kind]) return true;
      if (workflowChoices[kind] !== initialWorkflowChoices[kind]) return true;
      if (
        JSON.stringify(workflowBandsMap[kind]) !== JSON.stringify(initialWorkflowBandsMap[kind])
      ) {
        return true;
      }
      return false;
    });
  }, [
    initialScopeModes,
    initialSettings,
    initialWorkflowBandsMap,
    initialWorkflowChoices,
    scopeModes,
    settings,
    workflowBandsMap,
    workflowChoices,
  ]);

  const patch = (partial: Partial<SalesApprovalSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleScopeChange = (kind: SalesDocKind, mode: ApprovalScopeMode) => {
    setScopeModes((prev) => ({ ...prev, [kind]: mode }));
    if (mode === "all") {
      patch({ [`${kind}_approval_threshold_amount`]: null } as Partial<SalesApprovalSettings>);
    } else if (getThreshold(settings, kind) == null) {
      patch({ [`${kind}_approval_threshold_amount`]: 10000 } as Partial<SalesApprovalSettings>);
    }
  };

  const buildSettingsPayload = (): SalesApprovalSettings => {
    let payload = { ...settings };
    for (const config of DOC_CONFIGS) {
      payload = {
        ...payload,
        ...buildDocPayload(
          payload,
          config.kind,
          scopeModes[config.kind],
          workflowChoices[config.kind],
          workflowBandsMap[config.kind]
        ),
      };
    }
    return payload;
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await onSave(buildSettingsPayload());
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sales approval settings saved.");
    });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeDoc} onValueChange={(value) => setActiveDoc(value as SalesDocKind)}>
        <TabsList className="h-8">
          {DOC_CONFIGS.map((config) => (
            <TabsTrigger key={config.kind} value={config.kind} className="h-7 px-3 text-xs">
              {config.tabLabel}
            </TabsTrigger>
          ))}
        </TabsList>

        {DOC_CONFIGS.map((config) => (
          <TabsContent key={config.kind} value={config.kind} className="mt-3">
            <SalesDocumentApprovalsSection
              config={config}
              settings={settings}
              scopeMode={scopeModes[config.kind]}
              workflowChoice={workflowChoices[config.kind]}
              workflowBands={workflowBandsMap[config.kind]}
              rulesOpen={rulesOpenMap[config.kind]}
              canEdit={canEdit}
              eligibleUsers={eligibleUsers}
              approverProfiles={approverProfiles}
              onPatch={patch}
              onScopeChange={(mode) => handleScopeChange(config.kind, mode)}
              onWorkflowChoiceChange={(choice) =>
                setWorkflowChoices((prev) => ({ ...prev, [config.kind]: choice }))
              }
              onWorkflowBandsChange={(bands) =>
                setWorkflowBandsMap((prev) => ({ ...prev, [config.kind]: bands }))
              }
              onRulesOpenChange={(open) =>
                setRulesOpenMap((prev) => ({ ...prev, [config.kind]: open }))
              }
            />
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Pending sales documents show on{" "}
        <Link href="/approvals" className="text-primary hover:underline">
          Approvals
        </Link>
        . Email/SMS wording:{" "}
        <Link href="/settings/notifications" className="text-primary hover:underline">
          Notification templates
        </Link>
        .
      </p>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save approval settings"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
