import { FolderTree, MapPin, Package, Ruler } from "lucide-react";
import { ModuleOverview } from "@/components/layout/module-overview";

export default function InventoryOverviewPage() {
  return (
    <ModuleOverview
      title="Inventory"
      description="Manage your product catalog, classification taxonomy, and stock-holding locations."
      cards={[
        {
          href: "/inventory/items",
          label: "Items",
          description: "Product master catalog: SKUs, pricing, costing, variants, and media.",
          icon: Package,
        },
        {
          href: "/inventory/categories",
          label: "Categories",
          description: "Classification taxonomy with attribute templates and variant strategy.",
          icon: FolderTree,
        },
        {
          href: "/inventory/locations",
          label: "Locations",
          description: "Warehouses, outlets, and stock-holding facilities with topology.",
          icon: MapPin,
        },
        {
          href: "/inventory/uom",
          label: "Units of Measure",
          description: "Managed measurement units and conversion factors.",
          icon: Ruler,
        },
      ]}
    />
  );
}
