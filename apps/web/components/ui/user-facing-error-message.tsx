"use client";

import Link from "next/link";
import type { UserFacingError } from "@/lib/errors/user-facing-error";
import { cn } from "@/lib/utils";

type Props = UserFacingError & {
  className?: string;
};

export function UserFacingErrorMessage({ message, action, className }: Props) {
  return (
    <p className={cn("text-xs text-destructive", className)} role="alert">
      {message}
      {action ? (
        <>
          {" "}
          <Link
            href={action.href}
            className="font-medium text-destructive underline underline-offset-2 hover:text-destructive/90"
          >
            {action.label}
          </Link>
        </>
      ) : null}
    </p>
  );
}
