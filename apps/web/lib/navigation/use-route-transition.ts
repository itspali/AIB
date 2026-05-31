"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Programmatic navigation with React transition pending state for button feedback. */
export function useRouteTransition() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  const replace = useCallback(
    (href: string) => {
      startTransition(() => {
        router.replace(href);
      });
    },
    [router]
  );

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return { push, replace, refresh, isPending };
}
