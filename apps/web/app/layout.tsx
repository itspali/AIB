import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { OnboardingProvider } from "@/components/onboarding/onboarding-context";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims, getSessionTenantId } from "@/lib/supabase/auth";
import { fetchThemePolicyForSession } from "@/lib/theme/queries";
import { buildThemeInitScript, normalizeStoredTheme, themeToHtmlClass } from "@/lib/theme/themes";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

const themeInitScript = buildThemeInitScript();

export const metadata: Metadata = {
  title: "AIB Smart ERP",
  description: "Multi-tenant enterprise resource planning",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [tenantId, themeCookie, claims] = await Promise.all([
    getSessionTenantId(),
    cookies().then((store) => store.get("aib-theme")?.value),
    getSessionClaims(),
  ]);

  let themePolicy = null;
  let initialComplete = false;
  let initialWorkspaceAccess = false;

  if (tenantId) {
    const supabase = await createClient();
    const [{ data }, { count: locationCount }, resolvedThemePolicy] = await Promise.all([
      supabase.from("tenants").select("onboarding_status").eq("id", tenantId).single(),
      supabase
        .from("tenant_locations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      claims?.userId
        ? fetchThemePolicyForSession(supabase, tenantId, claims.userId)
        : Promise.resolve(null),
    ]);
    themePolicy = resolvedThemePolicy;
    initialComplete = data?.onboarding_status === "GO_LIVE_READY";
    initialWorkspaceAccess = (locationCount ?? 0) > 0;
  }

  const storedTheme = normalizeStoredTheme(themeCookie);
  const ssrTheme = themePolicy?.canChangeTheme
    ? storedTheme
    : (themePolicy?.enforcedTheme ?? storedTheme);
  const themeClass = themeToHtmlClass(ssrTheme);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${themeClass}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        <Script id="aib-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Providers themePolicy={themePolicy}>
          <OnboardingProvider
            initialComplete={initialComplete}
            initialWorkspaceAccess={initialWorkspaceAccess}
          >
            {children}
            <Toaster position="top-right" richColors />
          </OnboardingProvider>
        </Providers>
      </body>
    </html>
  );
}
