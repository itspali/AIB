"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ApprovalExtraStepsEditor } from "@/components/settings/approvals/approval-extra-steps-editor";
import {
  ApprovalWorkflowTemplatePicker,
  type WorkflowChoice,
} from "@/components/settings/approvals/approval-workflow-template-picker";
import { ApprovalRulesEditor } from "@/components/settings/approvals/approval-rules-editor";
import { ApprovalSettingsSaveDialog } from "@/components/settings/approvals/approval-settings-save-dialog";
import {
  fetchPendingPoApprovalRunCount,
  runPoApprovalSlaReminders,
} from "@/app/settings/modules/procurement/actions";
import { defaultPoApprovalRules, hasEnabledPoApprovalRules, type PoApprovalRule } from "@/lib/approvals/approval-rules";
import {
  buildManagerChainFinanceLevels,
  resolveWorkflowChoice,
} from "@/lib/approvals/workflow-templates";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { ProcurementPoApproversSection } from "@/components/settings/modules/procurement-po-approvers-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  buildApprovalPlainSummary,
  resolveApprovalScopeMode,
  workflowBandsFromSettings,
  type ApprovalScopeMode,
} from "@/lib/approvals/plain-summary";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";
import { cn } from "@/lib/utils";

type Props = {
  initialSettings: ProcurementApprovalSettings;
  eligibleUsers: WorkspaceEligibleUser[];
  approverProfiles: WorkspaceEligibleUser[];
  canEdit: boolean;
  onSave?: (
    settings: ProcurementApprovalSettings,
    options?: { reroutePending?: boolean }
  ) => Promise<
    | { error?: string }
    | { success: true; rerouted?: number; releasedToDraft?: number }
  >;
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

export function ProcurementApprovalsPanel({
  initialSettings,
  eligibleUsers,
  approverProfiles,
  canEdit,
  onSave,
}: Props) {
  const [settings, setSettings] = useState<ProcurementApprovalSettings>(() => ({
    ...initialSettings,
    po_approver_roles: initialSettings.po_approver_roles ?? [],
    po_approval_rules: initialSettings.po_approval_rules ?? defaultPoApprovalRules(),
    po_finance_approver_user_ids: initialSettings.po_finance_approver_user_ids ?? [],
    po_approval_respect_destination_location:
      initialSettings.po_approval_respect_destination_location ?? true,
    po_approval_reminder_hours: initialSettings.po_approval_reminder_hours ?? 24,
    po_approval_escalation_hours: initialSettings.po_approval_escalation_hours ?? 72,
  }));
  const [isPending, startTransition] = useTransition();
  const [scopeMode, setScopeMode] = useState<ApprovalScopeMode>(() =>
    resolveApprovalScopeMode(initialSettings)
  );
  const [workflowChoice, setWorkflowChoice] = useState<WorkflowChoice>(() =>
    resolveWorkflowChoice(initialSettings)
  );
  const [workflowBands, setWorkflowBands] = useState(() =>
    workflowBandsFromSettings(initialSettings)
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reroutePending, setReroutePending] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(
    hasEnabledPoApprovalRules(initialSettings.po_approval_rules ?? defaultPoApprovalRules())
  );

  const initialWorkflowBands = useMemo(
    () => workflowBandsFromSettings(initialSettings),
    [initialSettings]
  );

  const isDirty = useMemo(() => {
    const settingsChanged = JSON.stringify(settings) !== JSON.stringify(initialSettings);
    const scopeChanged = scopeMode !== resolveApprovalScopeMode(initialSettings);
    const workflowChanged = workflowChoice !== resolveWorkflowChoice(initialSettings);
    const workflowBandsChanged =
      JSON.stringify(workflowBands) !== JSON.stringify(initialWorkflowBands);
    return settingsChanged || scopeChanged || workflowChanged || workflowBandsChanged;
  }, [
    initialSettings,
    initialWorkflowBands,
    scopeMode,
    settings,
    workflowBands,
    workflowChoice,
  ]);

  const patch = (partial: Partial<ProcurementApprovalSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const approverProfilesForSection = approverProfiles.length
    ? approverProfiles
    : eligibleUsers.filter((user) => settings.po_approver_user_ids.includes(user.id));

  const previewLines = useMemo(
    () =>
      buildApprovalPlainSummary({
        enabled: settings.require_po_approval_before_issue,
        scopeMode,
        thresholdAmount: settings.po_approval_threshold_amount,
        allowSelfApproveSmall: settings.allow_submitter_self_approve_below_threshold,
        approverCount:
          settings.po_approver_user_ids.length + (settings.po_approver_roles?.length ?? 0),
        extraStepCount:
          workflowChoice === "manager_chain_finance"
            ? 2
            : workflowChoice === "custom"
              ? (workflowBands[0]?.levels?.length ?? 1)
              : 1,
        enabledRules: settings.po_approval_rules ?? defaultPoApprovalRules(),
        workflowChoice,
        respectDestinationLocation: settings.po_approval_respect_destination_location,
        reminderHours: settings.po_approval_reminder_hours,
        escalationHours: settings.po_approval_escalation_hours,
      }),
    [scopeMode, settings, workflowBands, workflowChoice]
  );

  const handleScopeChange = (mode: ApprovalScopeMode) => {
    setScopeMode(mode);
    if (mode === "all") {
      patch({
        po_approval_threshold_amount: null,
        allow_submitter_self_approve_below_threshold: false,
      });
    } else if (settings.po_approval_threshold_amount == null) {
      patch({
        po_approval_threshold_amount: 10000,
        allow_submitter_self_approve_below_threshold: false,
      });
    }
  };

  const buildSettingsPayload = (): ProcurementApprovalSettings => {
    const nextSettings: ProcurementApprovalSettings = {
      ...settings,
      po_approval_threshold_amount:
        scopeMode === "all" ? null : settings.po_approval_threshold_amount,
      po_approver_roles: settings.po_approver_roles ?? [],
      po_approval_rules: settings.po_approval_rules ?? defaultPoApprovalRules(),
      po_finance_approver_user_ids: settings.po_finance_approver_user_ids ?? [],
    };

    const defaultLevel = {
      steps: [{ label: "Approvers", quorum: "ANY" as const, pool: "default", assignee: "POOL" as const }],
    };
    const defaultPool = {
      user_ids: nextSettings.po_approver_user_ids,
      roles: nextSettings.po_approver_roles ?? [],
    };
    const financePool = {
      user_ids: nextSettings.po_finance_approver_user_ids ?? [],
      roles: [] as Array<"ADMIN" | "MANAGER">,
    };

    const threshold = nextSettings.po_approval_threshold_amount;
    const skipBand =
      scopeMode === "small_orders_exempt" && threshold != null
        ? [
            {
              min_amount: 0,
              max_amount: threshold,
              skip: true as const,
              self_approve: nextSettings.allow_submitter_self_approve_below_threshold,
            },
          ]
        : [];
    const approvalMin = scopeMode === "small_orders_exempt" && threshold != null ? threshold : 0;

    let workflowBand;
    if (workflowChoice === "manager_chain_finance") {
      nextSettings.po_workflow_template = "manager_chain_finance";
      workflowBand = {
        min_amount: approvalMin,
        max_amount: null,
        levels: buildManagerChainFinanceLevels(),
      };
    } else if (workflowChoice === "custom") {
      nextSettings.po_workflow_template = "custom";
      workflowBand = {
        ...(workflowBands[0] ?? { min_amount: approvalMin, max_amount: null, levels: [defaultLevel] }),
        min_amount: approvalMin,
      };
    } else {
      nextSettings.po_workflow_template = "standard";
      workflowBand = {
        min_amount: approvalMin,
        max_amount: null,
        levels: [defaultLevel],
      };
    }

    nextSettings.po_approval_bands = [...skipBand, workflowBand];
    nextSettings.po_approver_pools = {
      default: defaultPool,
      ...(workflowChoice === "manager_chain_finance" ? { finance: financePool } : {}),
    };

    return nextSettings;
  };

  const commitSave = (shouldReroute: boolean) => {
    if (!onSave) return;

    startTransition(async () => {
      const result = await onSave(buildSettingsPayload(), { reroutePending: shouldReroute });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      setSaveDialogOpen(false);
      setReroutePending(false);

      if (shouldReroute && "rerouted" in result) {
        const parts = ["Approval settings saved."];
        if ((result.rerouted ?? 0) > 0) {
          parts.push(`${result.rerouted} waiting order(s) rerouted.`);
        }
        if ((result.releasedToDraft ?? 0) > 0) {
          parts.push(`${result.releasedToDraft} order(s) returned to draft (approval no longer required).`);
        }
        toast.success(parts.join(" "));
      } else {
        toast.success("Approval settings saved.");
      }
    });
  };

  const handleSaveClick = async () => {
    if (!onSave) return;

    const pendingCount = await fetchPendingPoApprovalRunCount();
    if (pendingCount > 0) {
      setPendingApprovalCount(pendingCount);
      setSaveDialogOpen(true);
      return;
    }

    commitSave(false);
  };

  const handleRunSlaCheck = () => {
    startTransition(async () => {
      const result = await runPoApprovalSlaReminders();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("error" in result) return;
      const reminders = result.reminders_sent ?? 0;
      const escalations = result.escalations_sent ?? 0;
      if (reminders === 0 && escalations === 0) {
        toast.message("No overdue approval steps needed reminders.");
        return;
      }
      toast.success(
        `Sent ${reminders} reminder(s) and ${escalations} escalation(s).`
      );
    });
  };

  return (
    <div className="space-y-4">
      <OrgSettingsSection
        title="Purchase order approval"
        description="A simple checklist — turn it on, pick who approves, and choose if small orders are exempt."
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <StepHeader step={1} title="Turn approval on or off" />
            <div className="mt-3 flex items-center justify-between gap-3 pl-8">
              <p className="text-sm text-muted-foreground">
                When on, a PO must be approved before it is sent to the supplier.
              </p>
              <Switch
                checked={settings.require_po_approval_before_issue}
                disabled={!canEdit}
                onCheckedChange={(checked) => patch({ require_po_approval_before_issue: checked })}
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

          {settings.require_po_approval_before_issue ? (
            <>
              <div className="rounded-lg border border-border px-4 py-3">
                <StepHeader step={2} title="Who can approve?" />
                <div className="mt-3 pl-8">
                  <ProcurementPoApproversSection
                    approverUserIds={settings.po_approver_user_ids}
                    approverRoles={settings.po_approver_roles ?? []}
                    approverProfiles={approverProfilesForSection}
                    eligibleUsers={eligibleUsers.filter(
                      (user) => !settings.po_approver_user_ids.includes(user.id)
                    )}
                    canEdit={canEdit}
                    onChangeUsers={(po_approver_user_ids) => patch({ po_approver_user_ids })}
                    onChangeRoles={(po_approver_roles) => patch({ po_approver_roles })}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border px-4 py-3">
                <StepHeader step={3} title="Which orders need approval?" />
                <div className="mt-3 space-y-2 pl-8">
                  <ChoiceCard
                    selected={scopeMode === "all"}
                    title="Every purchase order"
                    description="Even small orders must be approved before issue."
                    disabled={!canEdit}
                    onSelect={() => handleScopeChange("all")}
                  />
                  <ChoiceCard
                    selected={scopeMode === "small_orders_exempt"}
                    title="Small orders are exempt"
                    description="Orders below an amount you choose can skip approval."
                    disabled={!canEdit}
                    onSelect={() => handleScopeChange("small_orders_exempt")}
                  >
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <div className="space-y-1">
                        <Label htmlFor="po-exempt-amount">No approval needed under</Label>
                        <Input
                          id="po-exempt-amount"
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={!canEdit}
                          value={settings.po_approval_threshold_amount ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            patch({
                              po_approval_threshold_amount: raw === "" ? null : Number(raw),
                            });
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                        <div>
                          <p className="text-sm">Buyers can approve their own small orders</p>
                          <p className="text-xs text-muted-foreground">
                            Only if the buyer is in your approver list above.
                          </p>
                        </div>
                        <Switch
                          checked={settings.allow_submitter_self_approve_below_threshold}
                          disabled={!canEdit}
                          onCheckedChange={(checked) =>
                            patch({ allow_submitter_self_approve_below_threshold: checked })
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
                    financeApproverUserIds={settings.po_finance_approver_user_ids ?? []}
                    eligibleUsers={eligibleUsers}
                    disabled={!canEdit}
                    onChange={setWorkflowChoice}
                    onFinanceApproversChange={(po_finance_approver_user_ids) =>
                      patch({ po_finance_approver_user_ids })
                    }
                  />
                  {workflowChoice === "custom" ? (
                    <div className="mt-3">
                      <ApprovalExtraStepsEditor
                        bands={workflowBands}
                        disabled={!canEdit}
                        onChange={setWorkflowBands}
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
                      setRulesOpen(checked);
                      if (!checked) {
                        patch({
                          po_approval_rules: (
                            settings.po_approval_rules ?? defaultPoApprovalRules()
                          ).map((rule) => ({ ...rule, enabled: false })),
                        });
                      }
                    }}
                  />
                </div>
                <p className="mt-1 pl-8 text-xs text-muted-foreground">
                  Require approval when prices or quantities look unusual — even on small orders.
                </p>
                {rulesOpen ? (
                  <div className="mt-3 pl-8">
                    <ApprovalRulesEditor
                      rules={settings.po_approval_rules ?? defaultPoApprovalRules()}
                      disabled={!canEdit}
                      onChange={(po_approval_rules) =>
                        patch({ po_approval_rules: po_approval_rules as PoApprovalRule[] })
                      }
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-border px-4 py-3">
                <StepHeader step={6} title="Location scope, reminders & escalation" />
                <div className="mt-3 space-y-4 pl-8">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <div>
                      <p className="text-sm">Match approvers to PO destination</p>
                      <p className="text-xs text-muted-foreground">
                        Named approvers and role pools only apply when they can access the
                        destination location. Owners and admins stay global.
                      </p>
                    </div>
                    <Switch
                      checked={settings.po_approval_respect_destination_location ?? true}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        patch({ po_approval_respect_destination_location: checked })
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="po-reminder-hours">Reminder every (hours)</Label>
                      <Input
                        id="po-reminder-hours"
                        type="number"
                        min={0}
                        step={1}
                        disabled={!canEdit}
                        value={settings.po_approval_reminder_hours ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value.trim();
                          patch({
                            po_approval_reminder_hours: raw === "" ? null : Number(raw),
                          });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Set 0 to disable reminders.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="po-escalation-hours">Escalate to owners after (hours)</Label>
                      <Input
                        id="po-escalation-hours"
                        type="number"
                        min={0}
                        step={1}
                        disabled={!canEdit}
                        value={settings.po_approval_escalation_hours ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value.trim();
                          patch({
                            po_approval_escalation_hours: raw === "" ? null : Number(raw),
                          });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Leave empty to disable escalation.</p>
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={handleRunSlaCheck}
                      >
                        Run reminder check now
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Schedule this via pg_cron or an external job in production.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Pending POs show on{" "}
            <Link href="/approvals" className="text-primary hover:underline">
              Approvals
            </Link>
            . Email/SMS wording:{" "}
            <Link href="/settings/notifications" className="text-primary hover:underline">
              Notification templates
            </Link>
            .
          </p>
        </div>
      </OrgSettingsSection>

      {canEdit && onSave ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={handleSaveClick}>
            {isPending ? "Saving…" : "Save approval settings"}
          </Button>
        </div>
      ) : null}

      <ApprovalSettingsSaveDialog
        open={saveDialogOpen}
        pendingCount={pendingApprovalCount}
        isSaving={isPending}
        reroutePending={reroutePending}
        onReroutePendingChange={setReroutePending}
        onCancel={() => {
          if (!isPending) {
            setSaveDialogOpen(false);
            setReroutePending(false);
          }
        }}
        onConfirm={() => commitSave(reroutePending)}
      />
    </div>
  );
}
