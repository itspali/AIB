"use client";

import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { HubPanel, HubSectionHeading } from "@/components/dashboard/hub-panel";
import { Button } from "@/components/ui/button";
import { LinkPendingStatus } from "@/components/ui/link-pending-status";

export function ControlPanel() {
  return (
    <section aria-label="Configuration control panel" className="mb-10">
      <HubSectionHeading
        step="02"
        title="Workspace Controls"
        description="Sales discount policy and fiscal period lockout gates now live in Organization Settings."
      />
      <HubPanel accent="cyan" icon={Settings2}>
        <div className="p-6 pr-16">
          <h3 className="text-xl font-semibold">Organization Governance Portal</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure line-item discount policy, fiscal closing lockout, accounting controls, and
            delegated admin access from the centralized organization settings workspace.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href={SETTINGS_ROUTES.company} prefetch>
              <LinkPendingStatus>Open Organization Settings</LinkPendingStatus>
            </Link>
          </Button>
        </div>
      </HubPanel>
    </section>
  );
}
