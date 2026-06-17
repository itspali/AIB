"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  markNotificationsRead,
  loadNotificationInbox,
} from "@/app/approvals/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NOTIFICATION_INBOX_CHANGED_EVENT } from "@/lib/notifications/inbox-events";
import type { UserNotificationRow } from "@/lib/approvals/types";
import { useClientMounted } from "@/lib/dom/use-client-mounted";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function NotificationInboxSheet({ className }: Props) {
  const mounted = useClientMounted();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const feed = await loadNotificationInbox();
    setItems(feed.items);
    setUnreadCount(feed.unread_count);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChanged = () => {
      void reload();
    };
    window.addEventListener(NOTIFICATION_INBOX_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTIFICATION_INBOX_CHANGED_EVENT, onChanged);
  }, [reload]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markNotificationsRead(null);
      await reload();
    });
  };

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("relative h-9 w-9 px-0", className)}
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Button>
  );

  if (!mounted) {
    return trigger;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>In-app alerts for approvals and workflow events.</SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
          {unreadCount > 0 ? (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm",
                  item.is_read ? "border-border bg-muted/20" : "border-primary/20 bg-primary/5"
                )}
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
                {item.action_url ? (
                  <Link
                    href={item.action_url}
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
