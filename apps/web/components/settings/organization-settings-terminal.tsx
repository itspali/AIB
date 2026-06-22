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
import { OrganizationDangerZoneSection } from "@/components/settings/organization-danger-zone-section";
import { OrganizationEntityFieldsSection } from "@/components/settings/organization-entity-fields-section";
import { OrganizationProcurementSection } from "@/components/settings/organization-procurement-section";
import { OrganizationAccountingSection } from "@/components/settings/organization-accounting-section";
import { OrganizationBillingFiscalSection } from "@/components/settings/organization-billing-fiscal-section";
import { OrganizationBrandSection } from "@/components/settings/organization-brand-section";
import { OrganizationPolicySummary } from "@/components/settings/organization-policy-summary";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import { GroupInvitationBanner } from "@/components/settings/group/group-invitation-banner";
import { OrganizationIdentitySection } from "@/components/settings/organization-identity-section";
import { OrganizationSellingFocusSection } from "@/components/settings/organization-selling-focus-section";
import { OrganizationLocalizationSection } from "@/components/settings/organization-localization-section";
import { OrganizationLocationSection } from "@/components/settings/organization-location-section";
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
import type { GroupInvitationRow } from "@/lib/group/types";
import type { TenantReportingLine } from "@/lib/organization/reporting-lines";
import {
  snapshotToFormValues,
  type OrganizationSettingsFormValues,
  type OrganizationSettingsSnapshot,
} from "@/lib/organization/types";
import { scrollElementInDashboardRoot } from "@/lib/settings/form-section-spy";
import { cn } from "@/lib/utils";

type OrganizationSettingsTerminalProps = {
  snapshot: OrganizationSettingsSnapshot;
  access: OrganizationSettingsAccess;
  tenantId: string;
  logoPreviewUrl?: string | null;
  groupInvitations?: GroupInvitationRow[];
  reportingLines?: TenantReportingLine[];
};

export type { OrganizationSettingsTerminalProps };

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
  groupInvitations = [],
  reportingLines = [],
}: OrganizationSettingsTerminalProps) {
  const router = useRouter();
  const omnibar = useOptionalOmnibarContext();
  const formRef = useRef<HTMLFormElement | null>(null);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Partial<Record<OrgSettingsTabId, HTMLDivElement | null>>>({});
  const ignoreSpyUntilRef = useRef(0);
  const [activeSection, setActiveSection] = useState<OrgSettingsTabId>(ORG_SETTINGS_TAB_IDS.identity);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [stickyOffsets, setStickyOffsets] = useState({ top: 0, chip: 0 });
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

  // Resolve the nearest scrollable ancestor (the dashboard canvas) so the
  // in-page nav scrolls the page itself rather than a self-contained pane.
  useLayoutEffect(() => {
    let el: HTMLElement | null = formRef.current?.parentElement ?? null;
    while (el) {
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollRootRef.current = el;
        setScrollRoot(el);
        return;
      }
      el = el.parentElement;
    }
    scrollRootRef.current = null;
    setScrollRoot(null);
  }, []);

  // Measure the sticky header (org-name bar) and the mobile chip bar so the
  // chip bar can pin directly below the org bar and scroll offsets stay accurate.
  useLayoutEffect(() => {
    const measure = () => {
      setStickyOffsets((prev) => {
        const next = {
          top: topBarRef.current?.offsetHeight ?? 0,
          chip: chipBarRef.current?.offsetHeight ?? 0,
        };
        return prev.top === next.top && prev.chip === next.chip ? prev : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (topBarRef.current) observer.observe(topBarRef.current);
    if (chipBarRef.current) observer.observe(chipBarRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isEditing]);

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

    const topBarHeight = topBarRef.current?.offsetHeight ?? 0;
    const chipBarHeight = chipBarRef.current?.offsetHeight ?? 0;
    const stickyHeight = topBarHeight + chipBarHeight;
    scrollElementInDashboardRoot(el, {
      additionalOffset: stickyHeight > 0 ? stickyHeight + 8 : 0,
      scrollRootRef,
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
      {
        root: scrollRoot,
        rootMargin: `-${stickyOffsets.top + stickyOffsets.chip + 16}px 0px -60% 0px`,
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollRoot, stickyOffsets.top, stickyOffsets.chip]);

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
          Edit
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
            {isPending ? "Saving…" : "Save"}
          </Button>
        </>
      )}
    </>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="canvas-scroll-endpad flex flex-col gap-4 lg:gap-5">
      <div
        ref={topBarRef}
        className="sticky top-0 z-30 -mx-3 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-4 md:px-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-semibold sm:text-xl">{displayName}</h2>
          <div className="flex shrink-0 items-center gap-2">{actionButtons}</div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Badge
            variant={snapshot.is_active ? "completed" : "locked"}
            className="px-2 py-0 text-[10px] font-medium"
          >
            {snapshot.is_active ? "ACTIVE" : "SUSPENDED"}
          </Badge>
          <Badge variant="active" className="px-2 py-0 text-[10px] font-medium">
            {snapshot.status.replace(/_/g, " ")}
          </Badge>
          <Badge variant="locked" className="px-2 py-0 text-[10px] font-medium">
            {snapshot.onboarding_status.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <div className="hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:block">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Organization settings</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Created {formatDate(snapshot.created_at)} · Updated {formatDate(snapshot.updated_at)}
            </p>
          </div>
          <OrganizationPolicySummary snapshot={snapshot} form={form} variant="header" />
        </div>
      </div>

      <OrganizationPolicySummary snapshot={snapshot} form={form} variant="panel" className="lg:hidden" />

      <GroupInvitationBanner invitations={groupInvitations} />

      <div
        ref={chipBarRef}
        style={{ top: stickyOffsets.top }}
        className="sticky z-20 -mx-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-4 md:px-4 lg:hidden"
      >
        <SectionScrollChipBar
          chips={mobileChips}
          activeId={activeSection}
          onSelect={(id) => scrollToSection(id as OrgSettingsTabId)}
          embedded
          dense
        />
      </div>

      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
        <nav className="hidden lg:block">
          <div className="sticky space-y-1" style={{ top: stickyOffsets.top + 16 }}>
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

        <div className="min-w-0 space-y-4">
          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.identity} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.identity)}>
            <OrganizationIdentitySection
              form={form}
              disabled={fieldsDisabled}
              parentGroupName={snapshot.parent_group_name}
              organizationCode={snapshot.organization_code}
            />
            <div className="mt-4">
              <OrganizationSellingFocusSection
                businessModel={snapshot.business_model}
                storefrontChannelTypes={snapshot.storefront_channel_types}
                brandName={snapshot.trade_name?.trim() || snapshot.legal_name?.trim() || snapshot.name}
                onboardingStatus={snapshot.onboarding_status}
                disabled={fieldsDisabled}
              />
            </div>
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

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.accounting} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.accounting)}>
            <OrganizationAccountingSection form={form} disabled={fieldsDisabled} />
            <div className="mt-4">
              <OrganizationProcurementSection form={form} disabled={fieldsDisabled} />
            </div>
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.entities} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.entities)}>
            <OrganizationEntityFieldsSection
              snapshot={snapshot}
              access={access}
              inheritedGroupSettings={snapshot.group_entity_settings}
            />
          </SectionAnchor>

          <SectionAnchor id={ORG_SETTINGS_TAB_IDS.access} registerRef={registerSection(ORG_SETTINGS_TAB_IDS.access)}>
            <OrganizationAccessSection
              form={form}
              snapshot={snapshot}
              access={access}
              reportingLines={reportingLines}
              disabled={fieldsDisabled}
            />
            <div className="mt-4">
              <OrganizationDangerZoneSection
                tenantId={tenantId}
                workspaceName={snapshot.trade_name?.trim() || snapshot.legal_name?.trim() || snapshot.name}
                isOwner={access.isOwner}
                parentGroupName={snapshot.parent_group_name}
              />
            </div>
          </SectionAnchor>
        </div>
      </div>
    </form>
  );
}
