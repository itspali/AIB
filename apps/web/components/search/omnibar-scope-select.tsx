"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterScope } from "@/lib/search/types";
import type { ScopeDefinition } from "@/lib/search/scopes";

type Props = {
  scope: FilterScope;
  options: ScopeDefinition[];
  onScopeChange: (scope: FilterScope) => void;
};

export function OmnibarScopeSelect({ scope, options, onScopeChange }: Props) {
  return (
    <Select value={scope} onValueChange={(value) => onScopeChange(value as FilterScope)}>
      <SelectTrigger className="h-7 w-[7.5rem] shrink-0 border-0 bg-background/50 px-2 text-xs shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
