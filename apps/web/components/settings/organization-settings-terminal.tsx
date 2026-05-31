"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveOrganizationSettings } from "@/app/settings/organization/actions";
import { OrganizationAccessSection } from "@/components/settings/organization-access-section";
import { OrganizationAccountingSection } from "@/components/settings/organization-accounting-section";
import { OrganizationBillingFiscalSection } from "@/components/settings/organization-billing-fiscal-section";
import { OrganizationBrandSection } from "@/components/settings/organization-brand-section";
import { OrganizationPolicySummary } from "@/components/settings/organization-policy-summary";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import { OrganizationIdentitySection } from "@/components/settings/organization-identity-section";
import { OrganizationLocalizationSection } from "@/components/settings/organization-localization-section";
import { OrganizationLocationSection } from "@/components/settings/organization-location-section";
import { OrganizationNamingSection } from "@/components/settings/organization-naming-section";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import type { OrganizationSettingsAccess } from "@/lib/organization/access";
import { firstErrorTab } from "@/lib/organization/field-tab-map";
import { organizationSettingsSchema } from "@/lib/organization/schemas";
import {
  buildSectionErrorMap,
  orgSectionStatus,
  OrgSectionStatusDot,
} from "@/lib/organization/section-status";
import {
  ORG_SETTINGS_SECTION_ELEMENT_IDS,
  ORG_SETTINGS_TAB_IDS,
  ORG_SETTINGS_TABS,
  type OrgSettingsTabId,
} from "@/lib/organization/section-nav";
import {
  snapshotToFormValues,
  type OrganizationSettingsFormValues,
  type OrganizationSettingsSnapshot,
} from "@/lib/organization/types";
import { scrollElementInDashboardRoot } from "@/lib/settings/form-section-spy";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: OrganizationSettingsSnapshot;
  access: OrganizationSettingsAccess;
  tenantId: string;
  logoPreviewUrl?: string | null;
};

function SectionAnchor({
  id,
  registerRef,
  children,
}: {
  id: OrgSettingsTabId;
  registerRef: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={registerRef}
      id={ORG_SETTINGS_SECTION_ELEMENT_IDS[id]}
      data-section={id}
      className="scroll-mt-4"
    >
      {children}
    </div>
  );
}

export function OrganizationSettingsTerminal({
  snapshot,
  access,
  tenantId,
  logoPreviewUrl,
}: Props) {
  const router = useRouter();
  const omnibar = useOptionalOmnibarContext();
  const formRef = useRef<HTMLFormElement | null>(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const sectionsScrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Partial<Record<OrgSettingsTabId, HTMLDivElement | null>>>({});
  const ignoreSpyUntilRef = useRef(0);
  const [activeSection, setActiveSection] = useState<OrgSettingsTabId>(ORG_SETTINGS_TAB_IDS.identity);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo(() => snapshotToFormValues(snapshot), [snapshot]);
  const displayName =
    snapshot.trade_name?.trim() ||
    snapshot.legal_name?.trim() ||
    snapshot.name?.trim() ||
    "Organization Settings";

  const form = useForm<OrganizationSettingsFormValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues,
  });

  const {
    watch,
    formState: { errors },
  } = form;
  const formValues = watch();

  const sectionErrors = useMemo(() => buildSectionErrorMap(errors), [errors]);

  const sectionStatus = useCallback(
    (id: OrgSettingsTabId) => orgSectionStatus(id, formValues, snapshot, sectionErrors),
    [formValues, snapshot, sectionErrors]
  );

  useEffect(() => {
    form.reset(defaultValues);
    setIsEditing(false);
  }, [defaultValues, form]);

  const fieldsDisabled = !isEditing || isPending;

  const handleReset = () => {
    form.reset(defaultValues);
    setIsEditing(false);
  };

  const syncSectionScrollRoot = useCallback(() => {
    setScrollRoot(sectionsScrollRef.current);
  }, []);

  useLayoutEffect(() => {
    syncSectionScrollRoot();
  }, [syncSectionScrollRoot]);

  useEffect(() => {
    const pane = sectionsScrollRef.current;
    if (!pane) return;
    const observer = new ResizeObserver(syncSectionScrollRoot);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [syncSectionScrollRoot]);

  const registerSection = useCallback(
    (id: OrgSettingsTabId) => (el: HTMLDivElement | null) => {
      sectionRefs.current[id] = el;
    },
    []
  );

  const scrollToSection = useCallback((id: OrgSettingsTabId) => {
    ignoreSpyUntilRef.current = Date.now() + 900;
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (!el) return;

    scrollElementInDashboardRoot(el, {
      offsetTop: 12,
      scrollRootRef: sectionsScrollRef,
    });
  }, []);

  useEffect(() => {
    const elements = ORG_SETTINGS_TABS.map((section) => sectionRefs.current[section.id]).filter(
      (el): el is HTMLDivElement => Boolean(el)
    );
    if (elements.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < ignoreSpyUntilRef.current) return;

        for (const entry of entries) {
          const id = entry.target.getAttribute("data-section");
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const firstVisible = ORG_SETTINGS_TABS.find((section) => visible.has(section.id));
        if (firstVisible) setActiveSection(firstVisible.id);
      },
      { root: scrollRoot, rootMargin: "-8px 0px -55% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollRoot]);

  const mobileChips = useMemo(
    () =>
      ORG_SETTINGS_TABS.map((section) => {
        const Icon = section.icon;
        return {
          id: section.id,
          label: section.shortLabel,
          leading: (
            <>
              <OrgSectionStatusDot status={sectionStatus(section.id)} />
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </>
          ),
        };
      }),
    [sectionStatus]
  );

  const onSubmit = form.handleSubmit(
    (values) => {
      startTransition(async () => {
        const result = await saveOrganizationSettings(values);
        if ("error" in result) {
          toast.error(result.error ?? "Unable to save organization settings.");
          return;
        }
        toast.success("Organization settings saved.");
        setIsEditing(false);
        await omnibar?.refreshSearchPermissions();
        router.refresh();
      });
    },
    (errors) => {
      const tab = firstErrorTab(errors);
      if (tab) scrollToSection(tab);
      const firstKey = Object.keys(errors)[0] as keyof OrganizationSettingsFormValues;
      const message = errors[firstKey]?.message;
      toast.error(
        typeof message === "string" ? message : "Fix validation errors before saving."
      );
    }
  );

  const actionButtons = (
    <>
      {!isEditing ? (
        <Button type="button" size="sm" className="md:size-default" onClick={() => setIsEditing(true)}>
          <span className="md:hidden">Edit</span>
          <span className="hidden md:inline">Edit organization settings</span>
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="md:size-default"
            disabled={isPending}
            onClick={handleReset}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" className="md:size-default" disabled={isPending}>
            <span className="md:hidden">{isPending ? "Saving…" : "Save"}</span>
            <span className="hidden md:inline">
              {isPending ? "Saving…" : "Save organization settings"}
            </span>
          </Button>
        </>
      )}
    </>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="canvas-scroll-endpad flex flex-col gap-4 lg:gap-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold sm:text-xl">{displayName}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Organization settings</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Created {formatDate(snapshot.created_at)} · Updated {formatDate(snapshot.updated_at)}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={snapshot.is_active ? "completed" : "locked"}>
                  {snapshot.is_active ? "ACTIVE" : "SUSPENDED"}
                </Badge>
                <Badge variant="active">{snapshot.status.replace(/_/g, " ")}</Badge>
                <Badge variant="locked">{snapshot.onboarding_status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:hidden">{actionButtons}</div>
            </div>
          </div>
          <OrganizationPolicySummary snapshot={snapshot} form={form} variant="header" />
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-col",
          "max-lg:min-h-[calc(100dvh-5rem)]",
          "lg:sticky lg:top-4 lg:z-10 lg:max-h-[calc(100svh-2rem)]"
        )}
      >
        <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <SectionScrollChipBar
            barRef={chipBarRef}
            chips={mobileChips}
            activeId={activeSection}
            onSelect={(id) => scrollToSection(id as OrgSettingsTabId)}
            embedded
            className="px-1 py-2"
          />
        </div>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
          <nav className="hidden lg:block lg:self-start">
            <div className="space-y-1">
              {ORG_SETTINGS_TABS.map((section) => {
                const Icon = section.icon;
                const active = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-secondary font-medium text-secondary-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{section.label}</span>
                    <OrgSectionStatusDot status={sectionStatus(section.id)} />
                  </button>
                );
              })}
            </div>
          </nav>

          <div
            ref={sectionsScrollRef}
            className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pb-4 max-lg:pb-16 lg:pr-0.5"
          >
          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.identity} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.identity)}>
            <OrganizationIdentitySection form={form} disabled={fieldsDisabled} />
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.regional} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.regional)}>
            <OrganizationLocalizationSection form={form} disabled={fieldsDisabled} />
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.billingFiscal} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.billingFiscal)}>
            <OrganizationBillingFiscalSection
              form={form}
              baseCurrencyLocked={snapshot.base_currency_locked}
              disabled={fieldsDisabled}
            />
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.branding} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.branding)}>
            <OrganizationBrandSection
              form={form}
              tenantId={tenantId}
              logoPreviewUrl={logoPreviewUrl}
              disabled={fieldsDisabled}
            />
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.locations} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.locations)}>
            <OrganizationLocationSection
              form={form}
              locations={snapshot.locations}
              disabled={fieldsDisabled}
            />
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.numbering} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.numbering)}>
            <OrganizationNamingSection
              form={form}
              documentSequences={snapshot.document_sequences}
              disabled={fieldsDisabled}
            />
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.accounting} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.accounting)}>
            <OrganizationAccountingSection form={form} disabled={fieldsDisabled} />
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.access} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.access)}>
            <OrganizationAccessSection
              form={form}
              snapshot={snapshot}
              access={access}
              disabled={fieldsDisabled}
            />
          </SectionAnchor>
          </div>
        </div>
      </div>

      <div className="canvas-sticky-footer max-md:!hidden">{actionButtons}</div>
    </form>
  );
}
