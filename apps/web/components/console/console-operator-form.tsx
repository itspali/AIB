"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantOperator } from "@/lib/console/actions/operator-management";
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
import type { AppConsoleRole } from "@/lib/console/types";

export function ConsoleOperatorForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppConsoleRole>("VIEWER");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await grantOperator({ email, role, notes: notes || undefined });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setEmail("");
      setNotes("");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="surface-panel space-y-4 p-4"
      aria-label="Grant console operator"
    >
      <h2 className="text-sm font-semibold">Grant operator access</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="operator_email">Auth user email</Label>
          <Input
            id="operator_email"
            type="email"
            value={email}
            disabled={isPending}
            placeholder="operator@company.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operator_role">Role</Label>
          <Select
            value={role}
            disabled={isPending}
            onValueChange={(value) => setRole(value as AppConsoleRole)}
          >
            <SelectTrigger id="operator_role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEWER">Viewer</SelectItem>
              <SelectItem value="OPERATOR">Operator</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="operator_notes">Notes</Label>
          <Input
            id="operator_notes"
            value={notes}
            disabled={isPending}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending || !email.trim()}>
        {isPending ? "Granting…" : "Grant access"}
      </Button>
    </form>
  );
}
