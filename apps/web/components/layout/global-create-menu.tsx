"use client";

import Link from "next/link";
import { FolderTree, MapPin, Package, Plus } from "lucide-react";
import { NavTextLinkContent } from "@/components/layout/nav-link-content";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CREATE_ACTIONS = [
  { href: "/inventory/items/new", label: "New Item", icon: Package },
  { href: "/inventory/categories", label: "New Category", icon: FolderTree },
  { href: "/settings/locations", label: "New Location", icon: MapPin },
];

export function GlobalCreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9 w-9 px-0" aria-label="New">
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CREATE_ACTIONS.map((action) => (
          <DropdownMenuItem key={action.href} asChild>
            <Link href={action.href} prefetch className="flex cursor-pointer items-center gap-2">
              <NavTextLinkContent icon={action.icon}>{action.label}</NavTextLinkContent>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
