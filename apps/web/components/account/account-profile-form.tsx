"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUserProfile } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileFormValues } from "@/lib/user/types";

type Props = {
  initialValues: ProfileFormValues;
};

export function AccountProfileForm({ initialValues }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateUserProfile({
        first_name: String(formData.get("first_name") ?? ""),
        last_name: String(formData.get("last_name") ?? ""),
        phone_number: String(formData.get("phone_number") ?? ""),
        avatar_url: String(formData.get("avatar_url") ?? ""),
      });

      if ("error" in result) {
        toast.error(result.error ?? "Unable to save profile.");
        return;
      }

      toast.success("Profile updated successfully");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name" className="text-sm font-medium text-muted-foreground">
            First name
          </Label>
          <Input
            id="first_name"
            name="first_name"
            defaultValue={initialValues.first_name}
            disabled={isPending}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name" className="text-sm font-medium text-muted-foreground">
            Last name
          </Label>
          <Input
            id="last_name"
            name="last_name"
            defaultValue={initialValues.last_name}
            disabled={isPending}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone_number" className="text-sm font-medium text-muted-foreground">
          Phone number
        </Label>
        <Input
          id="phone_number"
          name="phone_number"
          defaultValue={initialValues.phone_number}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar_url" className="text-sm font-medium text-muted-foreground">
          Avatar URL
        </Label>
        <Input
          id="avatar_url"
          name="avatar_url"
          type="url"
          placeholder="https://"
          defaultValue={initialValues.avatar_url}
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        Save profile changes
      </Button>
    </form>
  );
}
