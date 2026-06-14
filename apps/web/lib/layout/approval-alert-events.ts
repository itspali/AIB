export const APPROVAL_ALERT_CHANGED_EVENT = "aib:approval-alert-changed";

/** Ask shell chrome to refetch the header approval badge count. */
export function notifyApprovalAlertChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APPROVAL_ALERT_CHANGED_EVENT));
}
