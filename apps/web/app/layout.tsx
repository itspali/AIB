import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { OnboardingProvider } from "@/components/onboarding/onboarding-context";
import { createClient } from "@/lib/supabase/server";
import { getSessionTenantId } from "@/lib/supabase/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

const themeInitScript = `(function(){try{var t=localStorage.getItem('aib-theme');if(t!=='light'&&t!=='dark'){t='dark'}if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}document.cookie='aib-theme='+t+'; path=/; max-age=31536000; SameSite=Lax'}catch(e){document.documentElement.classList.add('dark')}})();`;

export const metadata: Metadata = {
  title: "AIB Smart ERP",
  description: "Multi-tenant enterprise resource planning",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [tenantId, themeCookie] = await Promise.all([
    getSessionTenantId(),
    cookies().then((store) => store.get("aib-theme")?.value),
  ]);
  const isDarkTheme = themeCookie !== "light";

  let initialComplete = false;
  let initialWorkspaceAccess = false;
  if (tenantId) {
    const supabase = await createClient();
    const [{ data }, { count: locationCount }] = await Promise.all([
      supabase.from("tenants").select("onboarding_status").eq("id", tenantId).single(),
      supabase
        .from("tenant_locations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
    ]);
    initialComplete = data?.onboarding_status === "GO_LIVE_READY";
    initialWorkspaceAccess = (locationCount ?? 0) > 0;
  }

  return (
    <html
      lang="en"
      className={`${inter.variable}${isDarkTheme ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        <Script id="aib-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Providers>
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
