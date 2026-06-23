import { Boxes } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";

export default function FinancialsPage() {
  return (
    <ComingSoonModule
      title="Financials"
      description="Maintain the chart of accounts, ledgers, and tax filings."
      icon={Boxes}
      plannedSections={["Chart of Accounts", "Ledger", "Tax Filings"]}
    />
  );
}
