import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentProfile, postLoginDestination } from "@/lib/auth/session";

type SearchParams = Promise<{
  redirectTo?: string;
  registered?: string;
  error?: string;
}>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const redirectTo = sp.redirectTo ?? "/";

  // Already signed in? Skip the form and route by role (superadmin → console,
  // admin/staff → dashboard, otherwise account).
  const session = await getCurrentProfile();
  if (session) {
    redirect(postLoginDestination(session.profile.role, redirectTo));
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue your shopping or manage your store."
      footer={
        <div className="flex flex-col gap-1">
          <span>
            New here?{" "}
            <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
              Create an account
            </Link>
          </span>
          <span>
            Want to sell?{" "}
            <Link href="/start" className="font-medium text-foreground underline-offset-4 hover:underline">
              Start your store
            </Link>
          </span>
        </div>
      }
    >
      {sp.registered ? (
        <p className="mb-4 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Account created. Sign in with your phone number and password.
        </p>
      ) : null}
      {sp.error === "callback" ? (
        <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          That link is invalid or has expired.
        </p>
      ) : null}
      <LoginForm redirectTo={redirectTo} />
    </AuthCard>
  );
}
