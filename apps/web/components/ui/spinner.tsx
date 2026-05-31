import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  /** Accessible label; omit when the control already exposes busy state. */
  label?: string;
};

/**
 * Centered circular spinner. Prefer over Lucide `Loader2` + `animate-spin`, whose
 * arc path is asymmetric and wobbles visually during rotation.
 */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-solid border-current border-t-transparent motion-reduce:animate-none",
        className
      )}
    />
  );
}
