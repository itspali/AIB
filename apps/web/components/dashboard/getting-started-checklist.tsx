"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { dismissGettingStarted } from "@/app/dashboard/actions";
import { HubPanel } from "@/components/dashboard/hub-panel";
import { Button } from "@/components/ui/button";
import type { GettingStartedSnapshot } from "@/lib/dashboard/getting-started";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: GettingStartedSnapshot;
};

export function GettingStartedChecklist({ snapshot }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!snapshot.visible) return null;

  const allComplete = snapshot.completedCount === snapshot.totalCount;

  const handleDismiss = () => {
    startTransition(async () => {
      const result = await dismissGettingStarted();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(allComplete ? "Great work — checklist dismissed." : "Getting started guide dismissed.");
      router.refresh();
    });
  };

  return (
    <HubPanel accent="violet" icon={Rocket} className="mb-8 p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Getting started</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {allComplete ? "Your workspace is ready to operate" : "Recommended next steps"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {allComplete
              ? "You have completed the launch checklist. Explore modules from the sidebar or dismiss this guide."
              : "Complete these actions to get value from AIB Smart ERP during your first week."}
          </p>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {snapshot.completedCount} of {snapshot.totalCount} complete
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start shrink-0"
          disabled={pending}
          onClick={handleDismiss}
        >
          <X className="mr-1 h-4 w-4" />
          Dismiss
        </Button>
      </div>

      <ul className="mt-6 space-y-3">
        {snapshot.tasks.map((task) => (
          <li key={task.id}>
            <Link
              href={task.href}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 transition-colors duration-200 hover:bg-muted/40",
                task.completed && "border-emerald-500/20 bg-emerald-500/5"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  task.completed
                    ? "bg-emerald-500 text-white"
                    : "border border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {task.completed ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{task.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{task.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HubPanel>
  );
}
