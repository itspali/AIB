import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Workspace suspended</CardTitle>
          <CardDescription>
            This organization&apos;s account has been suspended. Contact your administrator or
            AIB support if you believe this is an error.
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
