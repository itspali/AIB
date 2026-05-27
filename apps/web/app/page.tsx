import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";

export default async function HomePage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const route = await resolvePostLoginRoute(supabase, tenantId);
  redirect(route);
}
