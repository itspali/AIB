"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { CommerceAuthIllustration } from "@/components/auth/commerce-auth-background";

type AuthPageShellProps = {
  children: ReactNode;
};

export function AuthPageShell({ children }: AuthPageShellProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-2">
        {/* Form first on mobile, right column on desktop */}
        <div className="order-1 flex shrink-0 items-center justify-center px-4 pb-2 pt-8 sm:pt-10 lg:order-2 lg:px-10 lg:py-12 xl:px-16">
          <div className="w-full max-w-md">{children}</div>
        </div>

        {/* Illustration below form on mobile, left column on desktop */}
        <div className="order-2 flex flex-1 items-center justify-center bg-gradient-to-t from-primary/[0.06] via-background/80 to-transparent px-1 pb-10 pt-2 sm:px-4 lg:order-1 lg:flex-none lg:bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.07)_0%,transparent_68%)] lg:px-10 lg:py-12 xl:px-14">
          <div className="w-full max-w-none lg:max-w-2xl">
            <CommerceAuthIllustration
              gradientId={gradientId}
              className="h-auto w-full min-h-[230px] sm:min-h-[250px] lg:max-h-[min(72vh,500px)]"
            />
            <p className="mt-3 hidden text-center text-xs text-muted-foreground/60 lg:block">
              Inventory, orders, and fulfillment — connected in one flow
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
