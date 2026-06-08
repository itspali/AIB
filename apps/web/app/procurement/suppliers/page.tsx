import { Building2 } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";

export default function ProcurementSuppliersPage() {
  return (
    <ComingSoonModule
      title="Suppliers"
      description="Maintain supplier profiles, contacts, and purchasing terms."
      icon={Building2}
      plannedSections={["Vendor master", "Contacts", "Payment terms"]}
    />
  );
}
