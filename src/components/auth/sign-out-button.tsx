import { Button } from "@/components/ui/button";

export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "ghost" | "default";
}) {
  return (
    <form action="/auth/sign-out" method="post">
      <Button type="submit" variant={variant} size="md" className="w-full">
        Sign out
      </Button>
    </form>
  );
}
