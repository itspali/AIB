import dynamic from "next/dynamic";
import { QcInspectionCatalogPageSkeleton } from "@/components/procurement/quality-inspection/qc-inspection-catalog-page-skeleton";
import { fetchQcInspectionQueuePage } from "@/lib/procurement/quality-inspection/queries";
import { fetchProcurementLocations } from "@/lib/procurement/shared/queries";
import { fetchProcurementSettings } from "@/lib/procurement/settings";
import { getModulePageContext } from "@/lib/layout/module-page";

const QcInspectionManagementTerminal = dynamic(
  () =>
    import("@/components/procurement/quality-inspection/qc-inspection-management-terminal").then(
      (module) => module.QcInspectionManagementTerminal
    ),
  { loading: () => <QcInspectionCatalogPageSkeleton /> }
);

export async function QcInspectionCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [locations, queuePage, procurementSettings] = await Promise.all([
    fetchProcurementLocations(supabase, tenantId),
    fetchQcInspectionQueuePage(supabase, tenantId),
    fetchProcurementSettings(supabase, tenantId),
  ]);

  return (
    <QcInspectionManagementTerminal
      initialRows={queuePage.rows}
      listTotalCount={queuePage.totalCount}
      listHasMore={queuePage.hasMore}
      locations={locations}
      qcModuleEnabled={procurementSettings.is_qc_required_before_stocking}
    />
  );
}
