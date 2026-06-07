"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/app/actions/superadmin";
import { USER_ROLES, type UserRole } from "@/lib/constants";

export function UserRoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState<UserRole>(role);

  const onChange = (next: UserRole) => {
    setValue(next);
    start(async () => {
      const res = await setUserRole(userId, next);
      if (!res.ok) {
        setValue(role);
        alert(res.error ?? "Could not change role");
      } else {
        router.refresh();
      }
    });
  };

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as UserRole)}
      className="border-input bg-background rounded-lg border px-2 py-1 text-sm capitalize disabled:opacity-50"
    >
      {USER_ROLES.map((r) => (
        <option key={r} value={r} className="capitalize">
          {r}
        </option>
      ))}
    </select>
  );
}
