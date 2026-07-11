import "server-only";

import { cookies } from "next/headers";
import { activeModuleViewCookieName } from "@/lib/search/views/active-module-view-storage";

export async function readActiveModuleViewIdFromCookie(
  moduleName: string
): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(activeModuleViewCookieName(moduleName))?.value;
  if (typeof raw !== "string") return null;
  const trimmed = decodeURIComponent(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}
