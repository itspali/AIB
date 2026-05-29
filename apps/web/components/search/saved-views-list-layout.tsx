"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { CustomViewSidebar } from "@/components/search/custom-view-sidebar";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isSavedViewsScope } from "@/lib/search/views/module-view-registry";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function SavedViewsListLayout({ children, className }: Props) {
  const omnibar = useOptionalOmnibarContext();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showSavedViews = omnibar != null && isSavedViewsScope(omnibar.scope);

  if (!showSavedViews) {
    return <div className={cn("min-w-0", className)}>{children}</div>;
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-2 md:flex-row md:gap-0", className)}>
      <div className="flex items-center justify-end md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Bookmark className="h-3.5 w-3.5" aria-hidden />
              Saved views
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b px-4 py-3 text-left">
              <SheetTitle className="text-sm">My Saved Views</SheetTitle>
              <SheetDescription className="text-xs">
                Load a saved native filter for this module.
              </SheetDescription>
            </SheetHeader>
            <CustomViewSidebar
              className="w-full border-0"
              collapsed={false}
              onViewSelect={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <CustomViewSidebar
        className="hidden md:flex"
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
