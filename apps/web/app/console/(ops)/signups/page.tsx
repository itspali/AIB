import Link from "next/link";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { PipelineStageBadge } from "@/components/console/pipeline-stage-badge";
import { SignupFunnelBar } from "@/components/console/signup-funnel-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireConsoleAccess } from "@/lib/console/require-console";
import {
  fetchSignupPipeline,
  type SignupPipelineFilters,
} from "@/lib/console/queries/signup-pipeline";
import type { PipelineStage, SignupIssueBucket, TenantAccountStatus } from "@/lib/console/types";

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

const FUNNEL_STAGES: PipelineStage[] = [
  "REGISTERED",
  "EMAIL_VERIFIED",
  "TENANT_CREATED",
  "LIVE",
  "TRIAL",
  "PAYING",
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

export default async function ConsoleSignupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = param(sp, "search");
  const stage = param(sp, "stage") as PipelineStage | undefined;
  const accountStatus = param(sp, "status") as TenantAccountStatus | undefined;
  const issue = param(sp, "issue") as SignupIssueBucket | "any" | undefined;
  const page = Math.max(1, Number(param(sp, "page") ?? "1") || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const filters: SignupPipelineFilters = {
    search,
    stage,
    accountStatus,
    issue: issue === "any" ? "any" : issue,
    limit,
    offset,
  };

  const { admin } = await requireConsoleAccess("VIEWER");
  const { rows, total, funnel } = await fetchSignupPipeline(admin, filters);

  const funnelSteps = FUNNEL_STAGES.map((funnelStage, index) => {
    const count = funnel[funnelStage];
    const prevCount = index > 0 ? funnel[FUNNEL_STAGES[index - 1]!] : null;
    const conversionPercent =
      prevCount && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
    return { stage: funnelStage, count, conversionPercent };
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Signup pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unified view of every registration — auth users joined with tenants and subscriptions.
        </p>
      </header>

      <SignupFunnelBar steps={funnelSteps} />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label htmlFor="signup_search" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            id="signup_search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Email, company, or ORG code"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="signup_stage" className="text-xs font-medium text-muted-foreground">
            Stage
          </label>
          <select
            id="signup_stage"
            name="stage"
            defaultValue={stage ?? ""}
            className="flex h-10 min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All stages</option>
            {FUNNEL_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="ONBOARDING">ONBOARDING</option>
            <option value="CHURNED">CHURNED</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="signup_status" className="text-xs font-medium text-muted-foreground">
            Account status
          </label>
          <select
            id="signup_status"
            name="status"
            defaultValue={accountStatus ?? ""}
            className="flex h-10 min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="PAST_DUE">Past due</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="signup_issue" className="text-xs font-medium text-muted-foreground">
            Issue
          </label>
          <select
            id="signup_issue"
            name="issue"
            defaultValue={issue ?? ""}
            className="flex h-10 min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="any">Has issue</option>
            <option value="A">Bucket A</option>
            <option value="B">Bucket B</option>
            <option value="C">Bucket C</option>
          </select>
        </div>
        <Button type="submit">Apply</Button>
      </form>

      <ConsoleDataTable>
        <thead>
          <tr>
            <th className="text-left">Signup</th>
            <th className="text-left">Company</th>
            <th className="text-left">Stage</th>
            <th className="text-left">Status</th>
            <th className="text-left">Onboarding</th>
            <th className="text-left">Issue</th>
            <th className="text-left">Plan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                No signups match your filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.row_id}>
                <td>
                  <div className="font-medium">{row.email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(row.signup_at)}</div>
                </td>
                <td>
                  <div>{row.company_name ?? "—"}</div>
                  {row.organization_code ? (
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.organization_code}
                    </div>
                  ) : null}
                </td>
                <td>
                  <PipelineStageBadge stage={row.pipeline_stage} />
                </td>
                <td>
                  {row.account_status ? (
                    <Badge
                      variant={
                        row.account_status === "ACTIVE"
                          ? "completed"
                          : row.account_status === "TRIAL"
                            ? "action_required"
                            : "administrative"
                      }
                    >
                      {row.account_status}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-xs text-muted-foreground">{row.onboarding_status ?? "—"}</td>
                <td>
                  {row.issue_bucket ? (
                    <Badge variant="action_required">{row.issue_bucket}</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-sm">
                  {row.plan_name ?? "—"}
                  {row.trial_ends_at ? (
                    <div className="text-xs text-muted-foreground">
                      Trial ends {formatDate(row.trial_ends_at)}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </ConsoleDataTable>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} signup{total === 1 ? "" : "s"}
          {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={{
                  pathname: "/console/signups",
                  query: {
                    ...(search ? { search } : {}),
                    ...(stage ? { stage } : {}),
                    ...(accountStatus ? { status: accountStatus } : {}),
                    ...(issue ? { issue } : {}),
                    page: String(page - 1),
                  },
                }}
              >
                Previous
              </Link>
            </Button>
          ) : null}
          {page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={{
                  pathname: "/console/signups",
                  query: {
                    ...(search ? { search } : {}),
                    ...(stage ? { stage } : {}),
                    ...(accountStatus ? { status: accountStatus } : {}),
                    ...(issue ? { issue } : {}),
                    page: String(page + 1),
                  },
                }}
              >
                Next
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
