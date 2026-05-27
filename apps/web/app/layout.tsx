import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { OnboardingProvider } from "@/components/onboarding/onboarding-context";
import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "AIB Smart ERP",
  description: "Multi-tenant enterprise resource planning",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

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
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
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
