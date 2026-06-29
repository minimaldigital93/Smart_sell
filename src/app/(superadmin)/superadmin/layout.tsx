import { requireSuperadmin } from "@/lib/auth/session";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";

export default async function SuperadminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireSuperadmin();

  return (
    <SuperadminShell userName={profile.name ?? "Superadmin"}>
      {children}
    </SuperadminShell>
  );
}
