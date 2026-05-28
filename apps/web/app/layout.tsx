import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { OnboardingProvider } from "@/components/onboarding/onboarding-context";
import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

const themeInitScript = `(function(){try{var t=localStorage.getItem('aib-theme');if(t!=='light'&&t!=='dark'){t='dark'}if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}document.cookie='aib-theme='+t+'; path=/; max-age=31536000; SameSite=Lax'}catch(e){document.documentElement.classList.add('dark')}})();`;

export const metadata: Metadata = {
  title: "AIB Smart ERP",
  description: "Multi-tenant enterprise resource planning",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);
  const themeCookie = (await cookies()).get("aib-theme")?.value;
  const isDarkTheme = themeCookie !== "light";

  let initialComplete = false;
  if (tenantId) {
    const { data } = await supabase
      .from("tenants")
      .select("onboarding_status")
      .eq("id", tenantId)
      .single();
    initialComplete = data?.onboarding_status === "GO_LIVE_READY";
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
          <OnboardingProvider initialComplete={initialComplete}>
            {children}
            <Toaster position="top-right" richColors />
          </OnboardingProvider>
        </Providers>
      </body>
    </html>
  );
}
