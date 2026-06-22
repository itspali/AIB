"use server";

import { revalidatePath } from "next/cache";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";
import { setPlatformConfigValue, type PlatformConfigKey } from "../platform-config";

function revalidatePlatformPaths() {
  revalidatePath("/console");
  revalidatePath("/console/settings/platform");
}

function actionError(error: unknown): { error: string } {
  if (error instanceof ConsoleAccessError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Unexpected error" };
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: string }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function updatePlatformConfig(key: PlatformConfigKey, value: unknown) {
  try {
    const { admin, operator, claims } = await requireConsoleAccess("ADMIN");

    await setPlatformConfigValue(admin, key, value, claims.userId);

    await logConsoleAction({
      admin,
      operator,
      action: "PLATFORM_CONFIG_UPDATE",
      targetType: "platform_config",
      targetId: key,
      payload: { key, value },
    });

    revalidatePlatformPaths();
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}
