import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ConsoleDataTableProps = {
  children: ReactNode;
  className?: string;
  headerTone?: "subtle" | "muted-30" | "muted-50" | "glass" | "sticky";
};

export function ConsoleDataTable({
  children,
  className,
  headerTone = "subtle",
}: ConsoleDataTableProps) {
  return (
    <div className={cn("surface-inset table-chrome-frame overflow-x-auto", className)}>
      <table
        data-header-tone={headerTone}
        className="table-chrome w-full border-separate border-spacing-0 text-sm"
      >
        {children}
      </table>
    </div>
  );
}
