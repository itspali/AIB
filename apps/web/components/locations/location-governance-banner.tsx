import Link from "next/link";
import type { OrganizationLocationGovernanceConfig } from "@/lib/organization/types";

type Props = {
  governance: OrganizationLocationGovernanceConfig;
};

export function LocationGovernanceBanner({ governance }: Props) {
  if (governance.multi_location_enabled && governance.regional_hqs_enabled) {
    return (
      <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <p className="font-medium">Enterprise topology mode active</p>
        <p className="mt-1 text-muted-foreground">
          Regional hierarchy and DOM routing controls are enabled. Adjust governance in{" "}
          <Link href="/settings/organization" className="text-primary underline-offset-4 hover:underline">
            Organization Settings
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!governance.multi_location_enabled) {
    return (
      <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <p className="font-medium">Single-location workspace</p>
        <p className="mt-1 text-muted-foreground">
          Enable multi-location in{" "}
          <Link href="/settings/organization" className="text-primary underline-offset-4 hover:underline">
            Organization Settings
          </Link>{" "}
          to add branches and configure topology.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <p className="font-medium">Flat multi-location mode</p>
      <p className="mt-1 text-muted-foreground">
        Enable Regional HQs in Organization Settings to unlock the five-tier enterprise topology explorer.
      </p>
    </div>
  );
}
