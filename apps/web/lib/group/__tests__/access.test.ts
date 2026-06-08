import { describe, expect, it } from "vitest";
import { resolveGroupSettingsAccess } from "@/lib/group/access";

describe("resolveGroupSettingsAccess", () => {
  it("grants admins and owners", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { role: "GROUP_ADMIN" } }),
              }),
            }),
          }),
        }),
      }),
    } as never;

    const access = await resolveGroupSettingsAccess(supabase, "user-1", "group-1");
    expect(access.granted).toBe(true);
    expect(access.isAdmin).toBe(true);
  });

  it("denies viewers", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { role: "GROUP_VIEWER" } }),
              }),
            }),
          }),
        }),
      }),
    } as never;

    const access = await resolveGroupSettingsAccess(supabase, "user-1", "group-1");
    expect(access.granted).toBe(false);
  });
});
