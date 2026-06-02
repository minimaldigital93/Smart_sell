import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

type SearchParams = Promise<{
  redirectTo?: string;
  confirm?: string;
  error?: string;
}>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const redirectTo = sp.redirectTo ?? "/";

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue your shopping or manage your store."
      footer={
        <span>
          New here?{" "}
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      {sp.confirm ? (
        <p className="mb-4 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Check your inbox to confirm your email, then sign in.
        </p>
      ) : null}
      {sp.error === "callback" ? (
        <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          That link is invalid or has expired.
        </p>
      ) : null}
      <LoginForm redirectTo={redirectTo} />
      <p className="mt-4 text-center text-sm">
        <Link
          href="/reset-password"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </p>
    </AuthCard>
  );
}
