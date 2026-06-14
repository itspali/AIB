export const NOTIFICATION_INBOX_CHANGED_EVENT = "aib-notification-inbox-changed";

export function notifyNotificationInboxChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_INBOX_CHANGED_EVENT));
}
