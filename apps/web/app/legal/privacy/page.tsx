import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    title: "Data we process",
    body: "We process account credentials, organization profile fields, operational ERP records, and usage telemetry required to deliver and secure the service.",
  },
  {
    title: "How we use data",
    body: "Data is used to authenticate users, isolate tenants, run business workflows, improve reliability, and respond to support requests. We do not sell tenant operational data.",
  },
  {
    title: "Storage and isolation",
    body: "Tenant data is stored in isolated database scopes protected by row-level security policies. Access is limited to authenticated users within your organization context.",
  },
  {
    title: "Retention",
    body: "Operational records are retained according to your subscription and regulatory needs. Define retention and export procedures in your production privacy program.",
  },
  {
    title: "Your rights",
    body: "Depending on jurisdiction, users may request access, correction, or deletion of personal data. Provide a privacy contact and data subject request process before launch.",
  },
  {
    title: "Contact",
    body: "Replace this section with your Data Protection Officer or privacy inbox before production launch.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
          <CardDescription>
            Draft placeholder — replace with counsel-reviewed privacy policy before production launch.
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
