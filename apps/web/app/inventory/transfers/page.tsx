import { ArrowLeftRight } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";

export default function InventoryTransfersPage() {
  return (
    <ComingSoonModule
      title="Transfers"
      description="Move stock between warehouses and internal locations."
      icon={ArrowLeftRight}
      plannedSections={["Transfer requests", "In-transit stock", "Receipt confirmation"]}
    />
  );
}
