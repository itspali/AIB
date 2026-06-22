import Link from "next/link";
import { Boxes, LayoutDashboard, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const VALUE_PROPS = [
  {
    icon: LayoutDashboard,
    title: "Unified command hub",
    description: "Monitor inventory, sales pipeline, and financial exposure from one place.",
  },
  {
    icon: Boxes,
    title: "Multi-location inventory",
    description: "Model warehouses, channels, and tax policies before your first transaction.",
  },
  {
    icon: Shield,
    title: "Enterprise-grade isolation",
    description: "Row-level security and dedicated tenant bootstrap keep each business separated.",
  },
] as const;

export function MarketingLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/80 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">AIB Smart ERP</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 md:px-6 md:py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">ERP for D2C brands and B2B operators</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-4xl">
            Run inventory, sales, and compliance from one place
          </h1>
          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            Whether you sell direct to consumers or to businesses, register in minutes, complete a
            short setup, and launch a tenant-isolated ERP environment.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-border/80 bg-card/60">
              <CardHeader className="pb-3">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
