import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { LegalPage, Operator, SupportEmail } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Contact us", description: `Get in touch with the ${site.name} team.` };

export default function ContactPage() {
  return (
    <LegalPage title="Contact us" intro="Questions, payment issues, a profile you want reported, or just feedback. We read everything.">
      <div className="glass rounded-[var(--radius-card)] p-6 text-[15px] text-fg">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Email</p>
        <p className="mt-1 text-lg">
          <SupportEmail />
        </p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Operated by</p>
        <p className="mt-1">
          <Operator />
        </p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Response time</p>
        <p className="mt-1">Within 24 hours, Monday to Saturday.</p>
      </div>

      <h2>Grievance Officer</h2>
      <p>
        {site.legal.operator}, at the email above. Complaints are acknowledged within 24 hours and resolved within 15 days,
        as required by the Information Technology Rules, 2021.
      </p>

      <h2>Quick links</h2>
      <ul>
        <li><Link href="/refund-policy">Cancelling or a payment problem</Link></li>
        <li><Link href="/delete-account">Deleting your account</Link></li>
        <li><Link href="/terms">Terms of Service</Link> · <Link href="/privacy">Privacy Policy</Link></li>
      </ul>
    </LegalPage>
  );
}
