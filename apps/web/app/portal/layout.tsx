import Link from "next/link";
import { getSessionClaims } from "@/lib/supabase/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const claims = await getSessionClaims();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Supplier portal
            </p>
            <h1 className="text-lg font-semibold tracking-tight">AIB Procurement</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/portal/purchase-orders" className="text-muted-foreground hover:text-foreground">
              Purchase orders
            </Link>
            {claims?.tenantId ? (
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                ERP home
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
