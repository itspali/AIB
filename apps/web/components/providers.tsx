"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import type { ResolvedThemePolicy } from "@/lib/theme/governance";

type ProvidersProps = {
  children: React.ReactNode;
  themePolicy?: ResolvedThemePolicy | null;
};

export function Providers({ children, themePolicy = null }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider policy={themePolicy}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
