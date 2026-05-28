export function isMissingRpcError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  );
}

export function formatRpcDeployError(rpcName: string): string {
  return (
    `${rpcName} is not available on this database yet. ` +
    "Commit and push the pending Supabase migrations to the develop branch, " +
    "then wait for CI to finish deploying before retrying."
  );
}
