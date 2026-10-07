import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { LegalPage, SupportEmail } from "@/components/legal/legal-page";
import { ButtonLink } from "@/components/ui/button";
import { DeleteAccountForm } from "@/app/(marketing)/delete-account/delete-form";

export const metadata: Metadata = { title: "Delete your account", description: `How to delete your ${site.name} account and data.` };

export default async function DeleteAccountPage() {
  const user = isSupabaseConfigured ? (await (await createClient()).auth.getUser()).data.user : null;

  return (
    <LegalPage
      title="Delete your account"
      intro={<>This page lets you permanently delete your <b className="text-fg">{site.name}</b> account (app and website, by {site.legal.operator}) and the data linked to it.</>}
    >
      <h2>What gets deleted</h2>
      <ul>
        <li>Your login and profile details</li>
        <li>Your creator listing, photo, rates and sample links (removed from the site immediately)</li>
        <li>Booking requests you sent or received, your shortlist, and reports you filed</li>
      </ul>
      <h2>What we keep</h2>
      <ul>
        <li>Payment records (amount, date, reference), unlinked from your profile, for as long as tax law requires.</li>
      </ul>
      <p>
        <b>Paid subscription?</b> If you subscribed in the Android app, also cancel it in the Play Store (profile picture → Payments &amp;
        subscriptions → Subscriptions), or Google may keep charging you.
      </p>

      <h2>Delete now</h2>
      {user ? (
        <DeleteAccountForm email={user.email ?? user.phone ?? "your account"} />
      ) : (
        <div className="mt-4">
          <p>Log in first, then come back to this page.</p>
          <ButtonLink href="/login?next=/delete-account" className="mt-4">
            Log in to delete
          </ButtonLink>
        </div>
      )}

      <h2>Can&apos;t log in?</h2>
      <p>
        Email <SupportEmail /> from the email address on your account with the subject &ldquo;Delete my account&rdquo;. We&apos;ll
        delete it within 7 days and confirm by email. Also see our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
