import { describe, expect, it } from "vitest";
import { inviteOrganizationToGroupSchema } from "@/lib/group/schemas";

describe("inviteOrganizationToGroupSchema", () => {
  const base = {
    group_id: "11111111-1111-1111-1111-111111111111",
    message: "",
  };

  it("accepts primary email", () => {
    const parsed = inviteOrganizationToGroupSchema.safeParse({
      ...base,
      identifier: "billing@acme.com",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts workspace code", () => {
    const parsed = inviteOrganizationToGroupSchema.safeParse({
      ...base,
      identifier: "org-ab12cd",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid identifier", () => {
    const parsed = inviteOrganizationToGroupSchema.safeParse({
      ...base,
      identifier: "not-a-uuid-anymore",
    });
    expect(parsed.success).toBe(false);
  });
});
