import Link from "next/link";
import type { Metadata } from "next";
import { getPlans } from "@/services/subscriptions";
import { parsePlanFeatures } from "@/lib/billing/plans";
import { StartStoreForm } from "@/components/auth/start-store-form";

export const metadata: Metadata = {
  title: "Start your store",
};

export default async function StartStorePage() {
  const plans = await getPlans();
  const signupPlans = plans.map((p) => ({
    code: p.code,
    name: p.name,
    price_usd: Number(p.price_usd),
    features: parsePlanFeatures(p.features),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Start your cosmetic store
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Pick a plan and pay by KHQR to launch your store.
        </p>
      </div>
      <StartStoreForm plans={signupPlans} />
      <p className="text-muted-foreground text-center text-sm">
        Already have a store?{" "}
        <Link href="/login" className="text-primary font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
