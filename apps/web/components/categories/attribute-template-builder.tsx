"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttributeTemplateEntry } from "@/lib/categories/types";

type Props = {
  rows: AttributeTemplateEntry[];
  onChange: (rows: AttributeTemplateEntry[]) => void;
};

const emptyRow = (): AttributeTemplateEntry => ({
  key: "",
  label: "",
  type: "text",
  required: false,
});

export function AttributeTemplateBuilder({ rows, onChange }: Props) {
  const updateRow = (index: number, patch: Partial<AttributeTemplateEntry>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Declare attribute keys child products under this category inherit on creation.
      </p>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 rounded-lg border border-border/80 p-3 sm:grid-cols-2 dark:border-white/10"
        >
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">Key</Label>
            <Input
              value={row.key}
              placeholder="size"
              onChange={(e) => updateRow(index, { key: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">Label</Label>
            <Input
              value={row.label}
              placeholder="Size"
              onChange={(e) => updateRow(index, { label: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">Type</Label>
            <Select
              value={row.type}
              onValueChange={(value) =>
                updateRow(index, { type: value as AttributeTemplateEntry["type"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              aria-label="Remove attribute row"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, emptyRow()])}>
        <Plus className="h-4 w-4" />
        Add Attribute
      </Button>
    </div>
  );
}
