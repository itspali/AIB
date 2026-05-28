"use server";

import { revalidatePath } from "next/cache";
import type { DutyStatus } from "@/lib/user/types";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export async function updateUserDutyStatus(status: DutyStatus) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("update_user_duty_status", {
    p_status: status,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/items/categories");
  revalidatePath("/account");
  return { success: true as const };
}

export async function updateUserProfile(values: {
  first_name: string;
  last_name: string;
  phone_number: string;
  avatar_url: string;
}) {
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const first_name = values.first_name.trim();
  const last_name = values.last_name.trim();
  if (!first_name || !last_name) {
    return { error: "First and last name are required" };
  }

  const { error } = await supabase
    .from("users")
    .update({
      first_name,
      last_name,
      phone_number: values.phone_number.trim() || null,
      avatar_url: values.avatar_url.trim() || null,
    })
    .eq("id", user.id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/items/categories");
  revalidatePath("/account");
  return { success: true as const };
}
