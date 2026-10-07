import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { LegalPage, Operator, SupportEmail } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: `How ${site.name} collects, uses and protects your data.` };

export default function PrivacyPage() {
  const n = site.name;
  return (
    <LegalPage
      title="Privacy Policy"
      intro={<>This policy explains what personal data {n} collects, why, and the choices you have. It follows India&apos;s Digital Personal Data Protection Act, 2023. The data fiduciary is <Operator />.</>}
    >
      <h2>The short version</h2>
      <ul>
        <li>We collect only what&apos;s needed to run the marketplace.</li>
        <li><strong>Creator profiles are public by design</strong>, including the WhatsApp number and email you choose to show.</li>
        <li>We never sell your data and don&apos;t use advertising trackers.</li>
        <li>You can delete your account and data anytime.</li>
      </ul>

      <h2>What we collect</h2>
      <h3>When you log in</h3>
      <p>Your email address, or phone number if you log in by SMS. If you use Google, your name, email and profile picture from Google.</p>
      <h3>If you&apos;re a creator</h3>
      <p>
        Your profile: name, photo, Instagram handle (and optional YouTube or Facebook link), city and area, niches,
        languages, follower and view counts, rates, sample post links, bio, WhatsApp number and contact email. Also your
        subscription status and plan.
      </p>
      <h3>If you&apos;re a business</h3>
      <p>Booking requests you send (business name and type, dates, message, budget, phone or email), creators you shortlist, and reports you file.</p>
      <h3>Automatically</h3>
      <p>
        Counts of profile views and contact-button clicks per profile (to show creators simple stats), and standard
        server logs such as IP address and browser type, kept briefly for security and to prevent abuse.
      </p>
      <h3>Payments</h3>
      <p>
        Payments are handled by <strong>Razorpay</strong> (website) or <strong>Google Play</strong> (Android app). We receive payment
        status, amount and reference IDs, never your card, UPI or bank details.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To create and secure your account and log you in.</li>
        <li>To show creator profiles to businesses, and to deliver booking requests to creators.</li>
        <li>To run subscriptions and tell you about payments and renewals.</li>
        <li>To review profiles, prevent fraud, spam and abuse, and respond to reports.</li>
        <li>To meet legal obligations, such as tax records or lawful requests from authorities.</li>
      </ul>
      <p>We process your data on the basis of your consent, which you give when you sign up, and for the legitimate uses allowed under the DPDP Act.</p>

      <h2>Who we share it with</h2>
      <p>Only service providers who help us run {n}, under contracts that require them to protect it:</p>
      <ul>
        <li><strong>Supabase</strong>: database, login and photo storage (servers in Mumbai, India).</li>
        <li><strong>Vercel</strong>: website hosting.</li>
        <li><strong>Razorpay</strong> and <strong>Google Play</strong>: payments.</li>
        <li><strong>Google</strong>: &ldquo;Continue with Google&rdquo; login.</li>
        <li>Our email provider: login codes and account emails.</li>
      </ul>
      <p>We may also disclose data if Indian law requires it. We never sell personal data.</p>

      <h2>How long we keep it</h2>
      <p>
        While your account is active. When you delete your account, we remove your profile, photos, shortlists and
        requests within 30 days. Payment records are kept for as long as tax and accounting laws require.
      </p>

      <h2>Your rights</h2>
      <p>You can:</p>
      <ul>
        <li>see and correct your data (most of it from your profile settings);</li>
        <li>delete your account and data on the <Link href="/delete-account">Delete account</Link> page;</li>
        <li>withdraw consent (by deleting your account);</li>
        <li>nominate someone to exercise these rights on your behalf;</li>
        <li>complain to our Grievance Officer and, if unresolved, to the Data Protection Board of India.</li>
      </ul>

      <h2>Children</h2>
      <p>{n} is only for people aged {site.legal.minAge} or over. If we learn an account belongs to someone younger, we delete it.</p>

      <h2>Cookies and storage</h2>
      <p>
        We use only essential cookies to keep you logged in, and your browser&apos;s storage to remember settings like dark
        or light mode. No advertising or cross-site tracking cookies.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, access is restricted by strict database rules (for example, nobody can edit
        someone else&apos;s profile), and payment details never reach our servers. No system is perfect: if a breach affects
        you, we&apos;ll inform you and the authorities as the law requires.
      </p>

      <h2>Contact and Grievance Officer</h2>
      <p>
        {site.legal.operator}, {site.legal.location}. Email: <SupportEmail />. We acknowledge requests within 24 hours and
        aim to resolve them within 15 days.
      </p>

      <h2>Changes</h2>
      <p>We&apos;ll update the date at the top when this policy changes, and tell you by email or on the site if the change is significant.</p>
    </LegalPage>
  );
}
