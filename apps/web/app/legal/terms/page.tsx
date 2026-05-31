import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
          <CardDescription>Placeholder legal document for AIB Smart ERP self-service signup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            By creating a workspace you agree to operate this tenant in compliance with applicable
            commercial, tax, and data-protection regulations. Replace this page with your executed
            enterprise terms before production launch.
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
