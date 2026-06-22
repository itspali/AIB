import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Maintenance in progress</CardTitle>
          <CardDescription>
            AIB Smart ERP is temporarily unavailable while we perform platform maintenance. Please
            try again shortly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Return to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
