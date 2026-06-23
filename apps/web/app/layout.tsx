import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { OnboardingProvider } from "@/components/onboarding/onboarding-context";
import { getAppShellBootstrap } from "@/lib/layout/app-shell-bootstrap";
import { buildThemeInitScript, normalizeStoredTheme, themeToHtmlClass } from "@/lib/theme/themes";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const themeInitScript = buildThemeInitScript();

export const metadata: Metadata = {
  title: "AIB Smart ERP",
  description: "Multi-tenant enterprise resource planning",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const bootstrap = await getAppShellBootstrap();

  const storedTheme = normalizeStoredTheme(bootstrap.themeCookie);
  const ssrTheme = bootstrap.themePolicy?.canChangeTheme
    ? storedTheme
    : (bootstrap.themePolicy?.enforcedTheme ?? storedTheme);
  const themeClass = themeToHtmlClass(ssrTheme);

  return (
    <html
      lang="en"
      className={themeClass}
      suppressHydrationWarning
    >
      <body
        className={`${inter.variable} min-h-screen font-sans antialiased`}
        suppressHydrationWarning
      >
        <Script id="aib-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Providers
          themePolicy={bootstrap.themePolicy}
          hydrateThemePolicy={Boolean(bootstrap.tenantId)}
        >
          <OnboardingProvider
            initialComplete={bootstrap.onboardingComplete}
            initialWorkspaceAccess={bootstrap.hasWorkspaceAccess}
          >
            {children}
            <Toaster
              position="bottom-left"
              richColors
              closeButton
              offset={{ bottom: "1rem", left: "1rem" }}
            />
          </OnboardingProvider>
        </Providers>
      </body>
    </html>
  );
}
