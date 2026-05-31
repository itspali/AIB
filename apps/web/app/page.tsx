import { redirect } from "next/navigation";
import { MarketingLandingPage } from "@/components/marketing/landing-page";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <MarketingLandingPage />;
  }

  const tenantId = await getTenantIdFromSession(supabase);
  if (!tenantId) {
    redirect("/signup?resume=1");
  }

  const route = await resolvePostLoginRoute(supabase, tenantId);
  redirect(route);
}
