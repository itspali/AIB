"use client";

import { useEffect, useRef } from "react";
import { markOrgSettingsReviewed } from "@/app/dashboard/actions";

export function OrgSettingsReviewTracker() {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    void markOrgSettingsReviewed();
  }, []);

  return null;
}
