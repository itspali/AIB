import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  escapeHref?: string;
};

export function AdministrativeAccessDeniedView({ escapeHref = "/dashboard" }: Props) {
  return (
    <div className="surface-panel mx-auto flex max-w-lg flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <ShieldOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold">Administrative Privileges Required</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Organization governance settings can only be viewed and modified by the workspace owner or
        explicitly delegated administrators.
      </p>
      <Button asChild className="mt-6">
        <Link href={escapeHref}>Return to Dashboard</Link>
      </Button>
    </div>
  );
}
