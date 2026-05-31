import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    title: "Acceptance of terms",
    body: "By creating a workspace or using AIB Smart ERP, you agree to these terms on behalf of your organization. If you do not agree, do not register or use the service.",
  },
  {
    title: "Service scope",
    body: "AIB Smart ERP provides multi-tenant inventory, sales, procurement, and financial tooling. Features may change as the platform evolves. Beta or sandbox environments may contain incomplete modules.",
  },
  {
    title: "Customer responsibilities",
    body: "You are responsible for the accuracy of organization data, tax registrations, user access, and compliance with applicable commercial and data-protection laws in your jurisdiction.",
  },
  {
    title: "Availability and support",
    body: "We aim for high availability but do not guarantee uninterrupted service. Maintenance windows and third-party dependencies may affect uptime.",
  },
  {
    title: "Contact",
    body: "For contractual questions, contact your AIB account representative. Replace this section with your legal entity name, address, and support email before production launch.",
  },
] as const;

export default function TermsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
          <CardDescription>
            Draft placeholder — replace with counsel-reviewed terms before production launch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            This document is a structural draft only and is not legal advice.
          </div>
          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
            </section>
          ))}
          <p className="text-sm text-muted-foreground">
            <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Back to signup
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
