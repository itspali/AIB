"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { LinkPendingIcon } from "@/components/ui/link-pending-icon";

const rowClassName =
  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors duration-200 hover:bg-accent hover:text-foreground";

type ProfileNavLinkProps = {
  href: string;
  icon: LucideIcon;
  children: React.ReactNode;
  onNavigate: () => void;
};

function ProfileNavLink({ href, icon, children, onNavigate }: ProfileNavLinkProps) {
  return (
    <Link href={href} prefetch className={rowClassName} onClick={onNavigate}>
      <LinkPendingIcon icon={icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
      {children}
    </Link>
  );
}

export { ProfileNavLink, rowClassName };
