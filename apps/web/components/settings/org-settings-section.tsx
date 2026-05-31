type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

/** Matches product editor SectionBlock card styling. */
export function OrgSettingsSection({ title, description, children }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
