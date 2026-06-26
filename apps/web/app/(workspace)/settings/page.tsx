import { OverviewSectionShell, OverviewShortcutCard } from "@/components/layout/overview-primitives";
import { SettingsHubShell } from "@/components/settings/shells/settings-hub-shell";
import { filterSettingsHubSections } from "@/lib/settings/navigation";

export default function AdministrationPage() {
  const sections = filterSettingsHubSections();

  return (
    <SettingsHubShell>
      <div className="canvas-scroll-endpad space-y-8">
        <OverviewSectionShell
          title="Administration"
          description="Workspace governance — company profile, locations, catalogs, operations, and presentation."
          headingLevel={1}
        >
          <div />
        </OverviewSectionShell>
        {sections.map((section) => (
          <OverviewSectionShell
            key={section.id}
            title={section.label}
            description=""
            headingLevel={2}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.cards.map((card) => (
                <OverviewShortcutCard key={card.href} {...card} />
              ))}
            </div>
          </OverviewSectionShell>
        ))}
      </div>
    </SettingsHubShell>
  );
}
