import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ConsoleUnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Console access denied</CardTitle>
          <CardDescription>
            Your account is signed in but is not registered as an App Console operator.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to ERP</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/login">Sign in with another account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
