import { ScrollText } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";

export default function ProcurementBillsPage() {
  return (
    <ComingSoonModule
      title="Bills"
      description="Record supplier bills and match them to purchase orders and receipts."
      icon={ScrollText}
      plannedSections={["Bill capture", "Three-way match", "Payment scheduling"]}
    />
  );
}
