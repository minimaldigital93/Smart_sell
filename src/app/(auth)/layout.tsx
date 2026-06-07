import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col items-stretch px-5 safe-pt safe-pb">
      <header className="relative flex items-center justify-center pt-8 pb-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          {APP_NAME}
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-12">
        {children}
      </main>
    </div>
  );
}
