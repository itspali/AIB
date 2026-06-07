import { Boxes } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";

export default function InventoryPage() {
  return (
    <ComingSoonModule
      title="Inventory"
      description="Track stock on hand and move inventory between locations."
      icon={Boxes}
      plannedSections={["Stock", "Transfers"]}
    />
  );
}
