"use client";

import Link from "next/link";
import { FolderTree, MapPin, Package, Plus } from "lucide-react";
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
  { href: "/inventory/locations", label: "New Location", icon: MapPin },
];

export function GlobalCreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5" aria-label="Create new record">
          <Plus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CREATE_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem key={action.href} asChild>
              <Link href={action.href} prefetch className="cursor-pointer gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                {action.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
