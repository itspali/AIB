type CommandHubHeaderProps = {
  orgName: string;
  approvalAlertCount?: number;
};

export function CommandHubHeader({ orgName, approvalAlertCount = 0 }: CommandHubHeaderProps) {
  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {orgName}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Command Hub</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Cross-module operations home — monitor exposure, act on queues, and jump into workflows.
      </p>
      {approvalAlertCount > 0 ? (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
          {approvalAlertCount} item{approvalAlertCount === 1 ? "" : "s"} need attention — use the
          Approvals badge in the header or the queue below.
        </p>
      ) : null}
    </header>
  );
}
