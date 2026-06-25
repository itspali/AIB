"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react";
import { SettingsGlassShell } from "@/components/settings/settings-glass-shell";
import { NotificationTemplateEditor } from "@/components/settings/notifications/notification-template-editor";
import {
  NotificationChannelStatusBadge,
  notificationChannelLabel,
  notificationChannels,
  notificationDomainLabel,
} from "@/components/settings/notifications/notification-template-preview";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NOTIFICATION_TEMPLATE_DEFINITIONS,
  groupTemplatesByDomain,
} from "@/lib/notifications/template-catalog";
import type {
  NotificationChannel,
  NotificationDocumentDomain,
  NotificationTemplateGroup,
} from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type Props = {
  initialGroups: NotificationTemplateGroup[];
  canEdit: boolean;
  deployError?: string;
};

const DOMAIN_ORDER: NotificationDocumentDomain[] = ["PROCUREMENT", "SALES", "CREDIT"];

const CHANNEL_ICONS: Record<NotificationChannel, typeof Mail> = {
  EMAIL: Mail,
  SMS: Smartphone,
  WHATSAPP: MessageSquare,
};

export function NotificationSettingsTerminal({
  initialGroups,
  canEdit,
  deployError,
}: Props) {
  const router = useRouter();
  const [domain, setDomain] = useState<NotificationDocumentDomain>("PROCUREMENT");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(
    "approval.po.submitted"
  );
  const [channel, setChannel] = useState<NotificationChannel>("EMAIL");

  const groupsByKey = useMemo(() => {
    const map = new Map<string, NotificationTemplateGroup>();
    for (const group of initialGroups) {
      map.set(group.templateKey, group);
    }
    return map;
  }, [initialGroups]);

  const definitionsByDomain = useMemo(
    () => groupTemplatesByDomain(NOTIFICATION_TEMPLATE_DEFINITIONS),
    []
  );

  const domainDefinitions = definitionsByDomain[domain];
  const selectedDefinition =
    domainDefinitions.find((row) => row.templateKey === selectedTemplateKey) ??
    domainDefinitions[0] ??
    null;
  const selectedGroup = selectedDefinition
    ? groupsByKey.get(selectedDefinition.templateKey) ?? null
    : null;
  const handleSaved = () => {
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Notification templates</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Configure Email, SMS, and WhatsApp message templates for approval and credit-hold
          workflows. Delivery providers are not connected yet — templates are stored and previewed
          here for when dispatch is enabled.
        </p>
      </div>

      {deployError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {deployError}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access. Organization owners or delegates can edit templates.
        </div>
      ) : null}

      <SettingsGlassShell>
      <OrgSettingsSection
        title="Template library"
        description="Choose a document event, then edit each channel template with merge fields and live preview."
      >
        <Tabs value={domain} onValueChange={(value) => {
          const nextDomain = value as NotificationDocumentDomain;
          setDomain(nextDomain);
          const first = definitionsByDomain[nextDomain][0];
          if (first) setSelectedTemplateKey(first.templateKey);
        }}>
          <TabsList className="mb-4 flex h-auto flex-wrap gap-1 bg-muted/50 p-1">
            {DOMAIN_ORDER.map((domainKey) => (
              <TabsTrigger key={domainKey} value={domainKey} className="text-xs sm:text-sm">
                {notificationDomainLabel(domainKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          {DOMAIN_ORDER.map((domainKey) => (
            <TabsContent key={domainKey} value={domainKey} className="mt-0">
              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-2">
                  {definitionsByDomain[domainKey].map((definition) => {
                    const group = groupsByKey.get(definition.templateKey);
                    const customizedCount = notificationChannels.filter(
                      (channelKey) => group?.channels[channelKey]?.is_customized
                    ).length;

                    return (
                      <button
                        key={definition.templateKey}
                        type="button"
                        onClick={() => setSelectedTemplateKey(definition.templateKey)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                          selectedTemplateKey === definition.templateKey
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-card hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{definition.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {definition.eventCode}
                            </p>
                          </div>
                          {customizedCount > 0 ? (
                            <Badge variant="default" className="shrink-0 text-[10px]">
                              {customizedCount} custom
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="min-w-0 space-y-4">
                  {selectedDefinition ? (
                    <>
                      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                        <p className="text-sm font-medium">{selectedDefinition.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedDefinition.description}
                        </p>
                      </div>

                      <Tabs
                        value={channel}
                        onValueChange={(value) => setChannel(value as NotificationChannel)}
                      >
                        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/50 p-1">
                          {notificationChannels.map((channelKey) => {
                            const Icon = CHANNEL_ICONS[channelKey];
                            const row = selectedGroup?.channels[channelKey] ?? null;
                            return (
                              <TabsTrigger
                                key={channelKey}
                                value={channelKey}
                                className="gap-1.5 text-xs sm:text-sm"
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {notificationChannelLabel(channelKey)}
                                <NotificationChannelStatusBadge row={row} />
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>

                        {notificationChannels.map((channelKey) => (
                          <TabsContent key={channelKey} value={channelKey} className="mt-4">
                            <NotificationTemplateEditor
                              key={`${selectedDefinition.templateKey}-${channelKey}-${selectedGroup?.channels[channelKey]?.updated_at ?? "new"}`}
                              templateKey={selectedDefinition.templateKey}
                              templateLabel={selectedDefinition.label}
                              description={selectedDefinition.description}
                              row={selectedGroup?.channels[channelKey] ?? null}
                              channel={channelKey}
                              canEdit={canEdit}
                              onSaved={handleSaved}
                            />
                          </TabsContent>
                        ))}
                      </Tabs>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No templates in this domain.</p>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </OrgSettingsSection>
      </SettingsGlassShell>
    </div>
  );
}
