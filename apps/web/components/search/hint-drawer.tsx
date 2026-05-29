"use client";

type Props = {
  hints: string[];
};

export function HintDrawer({ hints }: Props) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur-xl">
      <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Native filter hints
      </p>
      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
        {hints.map((hint) => (
          <li
            key={hint}
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
          >
            Try: <span className="font-medium text-foreground">{hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
