"use client";

import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  avatarUrl: string | null;
  fullName: string;
  open: boolean;
  onClick: () => void;
};

export function UserProfileTrigger({ avatarUrl, fullName, open, onClick }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`${fullName} account menu`}
      className={cn(
        "rounded-full border border-transparent hover:border-white/10",
        open && "border-primary/30 bg-accent/50"
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 rounded-full object-cover ring-1 ring-border/80"
        />
      ) : (
        <User className="h-4 w-4" />
      )}
      <span className="sr-only">{fullName}</span>
    </Button>
  );
}
