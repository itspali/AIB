import { Package } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";

export default function InventoryStockPage() {
  return (
    <ComingSoonModule
      title="Stock"
      description="View quantities on hand by location, lot, and bin."
      icon={Package}
      plannedSections={["On-hand balances", "Stock adjustments", "Lot tracking"]}
    />
  );
}
