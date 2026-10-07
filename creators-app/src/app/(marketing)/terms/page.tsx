import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { PLANS } from "@/lib/pricing";
import { LegalPage, Operator, SupportEmail } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service", description: `The rules for using ${site.name}.` };

export default function TermsPage() {
  const n = site.name;
  return (
    <LegalPage
      title="Terms of Service"
      intro={<>These terms are an agreement between you and <Operator /> (&ldquo;{n}&rdquo;, &ldquo;we&rdquo;). By using {n}, its website or its app, you agree to them.</>}
    >
      <h2>1. What {n} is</h2>
      <p>
        {n} is an online marketplace where local businesses find Instagram creators and influencers near them, and
        creators get discovered by those businesses. We provide the listing and search service only.
      </p>

      <h2>2. {n} only connects you</h2>
      <p>
        <strong>We are not a party to any deal between a business and a creator.</strong> Prices, deliverables,
        timelines, payments, barter terms and disputes are agreed and settled directly between the business and the
        creator. We do not take a commission, do not hold money for either side, and are not responsible for the
        quality, delivery or legality of any collaboration, or for payments between users.
      </p>

      <h2>3. Who can use {n}</h2>
      <ul>
        <li>You must be at least <strong>{site.legal.minAge} years old</strong> to create an account.</li>
        <li>You must give accurate information and keep your login secure. You are responsible for activity on your account.</li>
        <li>One person or business per account. Don&apos;t create accounts for someone else without their permission.</li>
      </ul>

      <h2>4. For creators</h2>
      <ul>
        <li>
          Being listed costs <strong>₹{PLANS.monthly.priceInr} per month</strong> or <strong>₹{PLANS.yearly.priceInr} per year</strong>.
          Prices shown at checkout are final and include any applicable taxes.
        </li>
        <li>Your profile becomes public only after our team approves it <strong>and</strong> your subscription is active.</li>
        <li>You must own, or be authorised to represent, the Instagram (and any other) account you list.</li>
        <li>
          Follower and view counts you enter are shown as <strong>&ldquo;self-reported&rdquo;</strong> until we check them. Entering
          false numbers, buying followers or impersonating someone will get your profile removed without a refund.
        </li>
        <li>Your WhatsApp number and email on your profile are shown publicly so businesses can contact you.</li>
      </ul>

      <h3>Disclosing paid promotions (ASCI)</h3>
      <p>
        When you promote a brand in return for money, free products, barter or any other benefit, you must disclose it
        clearly, as required by the <strong>ASCI Guidelines for Influencer Advertising in Digital Media</strong> and the
        Department of Consumer Affairs&apos; endorsement guidelines. Use an upfront label such as{" "}
        <strong>#ad, #sponsored, #collab or #partnership</strong> that is easy to see, and only endorse products you have
        genuinely used or reviewed. You are responsible for your own content and its compliance with the law.
      </p>

      <h2>5. For businesses</h2>
      <ul>
        <li>Searching, viewing profiles and contacting creators is free.</li>
        <li>Booking requests must be genuine. Spam, fake requests, or harassing creators will get your account blocked.</li>
        <li>Check a creator&apos;s work and agree terms in writing before paying them. Any payment is between you and the creator.</li>
      </ul>

      <h2>6. Subscriptions and payments</h2>
      <ul>
        <li>Creator subscriptions renew automatically at the end of each month or year until you cancel.</li>
        <li>
          Payments are processed by <strong>Razorpay</strong> on our website, or by <strong>Google Play</strong> in our Android app.
          We never see or store your card or UPI details.
        </li>
        <li>You can cancel anytime. Your profile stays live until the end of the period you&apos;ve paid for.</li>
        <li>Refunds are covered by our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.</li>
      </ul>

      <h2>7. What isn&apos;t allowed</h2>
      <ul>
        <li>False, misleading, hateful, sexually explicit, violent or illegal content.</li>
        <li>Promoting anything illegal in India, or products that can&apos;t legally be advertised (for example, certain alcohol, tobacco or betting products).</li>
        <li>Fake profiles, fake followers or engagement, or using someone else&apos;s photos or identity.</li>
        <li>Scraping, bulk-copying or reselling creators&apos; contact details, or misusing them for spam.</li>
        <li>Trying to break, overload or get around the security of {n}.</li>
      </ul>

      <h2>8. Reviews, badges and removals</h2>
      <p>
        We review every creator profile before it goes live and may approve, reject (with a reason) or remove any profile
        or account that breaks these terms. A <strong>Verified</strong> badge means our team checked the profile by hand at that
        time. It is not a guarantee of future conduct or results. Profiles removed for breaking these terms are not
        refunded.
      </p>

      <h2>9. Your content</h2>
      <p>
        You own the photos, text and links you add. You allow us to display and format them on {n} (including in search
        results, social previews and our app) for as long as your profile is listed. You confirm you have the right to share them.
      </p>

      <h2>10. Disclaimers and liability</h2>
      <p>
        {n} is provided &ldquo;as is&rdquo;. We work hard to keep it running and accurate but can&apos;t promise it will always be
        available or error-free, or that any listing will lead to bookings. To the extent the law allows, our total
        liability to you for any claim is limited to the amount you paid us in the 12 months before the claim.
      </p>

      <h2>11. Ending your account</h2>
      <p>
        You can delete your account anytime from the <Link href="/delete-account">Delete account</Link> page. We may suspend or
        close accounts that break these terms.
      </p>

      <h2>12. Law and disputes</h2>
      <p>These terms are governed by the laws of India. Courts at Bongaigaon, Assam have jurisdiction.</p>

      <h2>13. Grievance Officer</h2>
      <p>
        As required by the Information Technology Rules, 2021, our Grievance Officer is <strong>{site.legal.operator}</strong>,
        reachable at <SupportEmail />. We acknowledge complaints within 24 hours and aim to resolve them within 15 days.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update these terms. If a change is significant, we&apos;ll tell you on the site or by email before it takes
        effect. Continuing to use {n} after that means you accept the new terms.
      </p>
    </LegalPage>
  );
}
