import { redirect } from "next/navigation";
import { MarketingLandingPage } from "@/components/marketing/landing-page";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";
import { getSessionClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const claims = await getSessionClaims();

  if (!claims) {
    return <MarketingLandingPage />;
  }

  if (!claims.tenantId) {
    redirect("/signup?resume=1");
  }

  const supabase = await createClient();
  const route = await resolvePostLoginRoute(supabase, claims.tenantId);
  redirect(route);
}
