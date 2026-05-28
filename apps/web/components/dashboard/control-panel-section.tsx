import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchWorkspaceControls } from "@/lib/dashboard/queries";
import { ControlPanel } from "@/components/dashboard/control-panel";

export async function ControlPanelSection() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);
  if (!tenantId) return null;

  const controls = await fetchWorkspaceControls(supabase, tenantId);
  return <ControlPanel initial={controls} />;
}
