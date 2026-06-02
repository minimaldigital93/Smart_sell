import { AuthCard } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { requireUser } from "@/lib/auth/session";

export default async function UpdatePasswordPage() {
  // Only reachable with a valid session (Supabase exchanges the reset code
  // at /auth/callback and lands here).
  await requireUser("/reset-password/update");

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a password at least 8 characters long."
    >
      <UpdatePasswordForm />
    </AuthCard>
  );
}
