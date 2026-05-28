import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "directory" | "topology";

type Props = {
  activeTab: Tab;
};

export function LocationModuleHeader({ activeTab }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Location Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure operational sites, enterprise hierarchy topology, and distributed order routing.
        </p>
        <nav className="mt-3 flex gap-2 text-sm" aria-label="Location module sub-navigation">
          <Link
            href="/inventory/locations"
            className={cn(
              "rounded-md px-2.5 py-1 transition-colors duration-200",
              activeTab === "directory"
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            aria-current={activeTab === "directory" ? "page" : undefined}
          >
            Directory
          </Link>
          <Link
            href="/inventory/locations/topology"
            className={cn(
              "rounded-md px-2.5 py-1 transition-colors duration-200",
              activeTab === "topology"
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            aria-current={activeTab === "topology" ? "page" : undefined}
          >
            Topology
          </Link>
        </nav>
      </div>
    </header>
  );
}
