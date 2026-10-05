import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/safe-redirect";
import { isPhoneLoginEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { EmptyState } from "@/components/ui/empty-state";
import { LoginForm } from "@/app/(marketing)/login/login-form";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const callbackFailed = params.error === "callback";

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 max-w-sm text-center">
        <h1 className="font-display-tight text-4xl font-bold sm:text-5xl">
          Welcome <span className="text-brand">in.</span>
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          Creators: log in to build your profile. Businesses: log in to send booking requests. Browsing is free, no login needed.
        </p>
      </div>

      {callbackFailed && (
        <p role="alert" className="mb-4 max-w-sm rounded-2xl border border-pink/40 bg-pink/10 px-4 py-3 text-center text-sm">
          That login link didn&apos;t work or has expired. Please try again.
        </p>
      )}

      {isSupabaseConfigured ? (
        <LoginForm next={next} phoneEnabled={isPhoneLoginEnabled} />
      ) : (
        <EmptyState
          className="max-w-sm"
          emoji="🔌"
          title="Login isn't connected yet"
          body="The database keys aren't set. Follow SUPABASE-SETUP.md, add the keys to .env.local, and restart the app."
        />
      )}

      <p className="mt-6 max-w-sm text-center text-xs text-muted">
        By continuing you agree to our <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
      </p>
    </section>
  );
}
