import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
          <CardDescription>Placeholder privacy notice for AIB Smart ERP.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            We process account credentials, organization profile data, and operational ERP records to
            provide the service. Replace this page with your privacy policy and data processing
            agreements before production launch.
          </p>
          <p>
            <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Back to signup
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
