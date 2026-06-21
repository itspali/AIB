"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  entityDisclosureButtonClass,
  entityDisclosureLineClass,
  entityDisclosureRowClass,
} from "@/lib/entities/entity-editor-chrome";

type Props = {
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

export function EntityAdvancedDisclosure({ open, onToggle, disabled, children }: Props) {
  return (
    <div className="space-y-4">
      <div className={entityDisclosureRowClass()}>
        <div className={entityDisclosureLineClass()} aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={entityDisclosureButtonClass()}
          disabled={disabled}
          onClick={onToggle}
        >
          {open ? "Hide advanced details" : "Show advanced details"}
        </Button>
      </div>
      {open ? <div className="space-y-6">{children}</div> : null}
    </div>
  );
}
