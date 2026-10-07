import type { Metadata } from "next";
import { site } from "@/config/site";
import { PLANS } from "@/lib/pricing";
import { LegalPage, SupportEmail } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Refund & Cancellation Policy", description: `Cancelling your ${site.name} subscription and when refunds apply.` };

export default function RefundPolicyPage() {
  const n = site.name;
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro={<>Only creators pay on {n}: ₹{PLANS.monthly.priceInr}/month or ₹{PLANS.yearly.priceInr}/year to be listed. Businesses never pay us anything.</>}
    >
      <h2>Cancelling</h2>
      <ul>
        <li>You can cancel anytime. Nothing is charged after you cancel.</li>
        <li>
          <strong>Paid on our website (Razorpay):</strong> cancel from your dashboard.
        </li>
        <li>
          <strong>Paid in the Android app (Google Play):</strong> cancel in the Play Store app → your profile picture → Payments
          &amp; subscriptions → Subscriptions → {n}.
        </li>
        <li>After cancelling, your profile <strong>stays live until the end of the month or year you&apos;ve already paid for</strong>, then it&apos;s hidden. You can reactivate anytime.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        <strong>Subscription payments are non-refundable</strong>, including partly used months or years, because your profile is
        listed and visible to businesses from the moment it goes live.
      </p>
      <p>We will always refund in full if:</p>
      <ul>
        <li>you were charged twice for the same period, or charged after cancelling, because of a technical error; or</li>
        <li>we rejected your profile and it never went live during the period you paid for.</li>
      </ul>
      <p>
        Approved refunds go back to your original payment method within <strong>5–7 working days</strong>. Payments made through
        Google Play may also be refunded under Google Play&apos;s own refund policies.
      </p>

      <h2>When there&apos;s no refund</h2>
      <ul>
        <li>Profiles removed for breaking our Terms of Service (for example, fake followers or impersonation).</li>
        <li>Not receiving bookings: {n} lists you for businesses to find, but can&apos;t guarantee bookings or earnings.</li>
      </ul>

      <h2>Failed renewals</h2>
      <p>If a renewal payment fails, your profile is hidden at the end of the paid period until payment succeeds. Nothing is lost: reactivate anytime.</p>

      <h2>Deals between businesses and creators</h2>
      <p>
        Money a business pays a creator for promotions is agreed directly between them. {n} doesn&apos;t handle it and
        can&apos;t refund it.
      </p>

      <h2>Questions</h2>
      <p>Email <SupportEmail /> with your registered email and payment reference. We reply within 24 hours.</p>
    </LegalPage>
  );
}
