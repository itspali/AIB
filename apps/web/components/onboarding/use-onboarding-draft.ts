"use client";

import { useEffect, useRef } from "react";
import { saveDraft } from "@/app/onboarding/actions";
import type { OnboardingDraft } from "@/lib/onboarding/types";

export function useOnboardingDraftSaver(initialDraft: OnboardingDraft) {
  const draftRef = useRef<OnboardingDraft>(initialDraft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    draftRef.current = initialDraft;
  }, [initialDraft]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const queueSave = (patch: Partial<OnboardingDraft>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveDraft(draftRef.current);
    }, 800);
  };

  return { queueSave };
}
