import { Link, useParams } from 'react-router-dom';

// Replace [bracketed] placeholders with registered business details before
// launch and have the final text reviewed by a lawyer.

const PAGES: Record<string, { title: string; body: React.ReactNode }> = {
  terms: {
    title: 'Terms & Conditions',
    body: (
      <>
        <h3>About the platform</h3>
        <p>
          ShaadiSetu is operated by [Legal/proprietor name], [Address], Bongaigaon, Assam.
          GSTIN: [GSTIN]. We are a marketplace connecting customers with independent wedding
          vendors; vendors are not our employees. Contact: [phone] · [email].
        </p>
        <h3>Bookings &amp; commission</h3>
        <p>
          Quotes are made by vendors. When a customer accepts a quote, a booking is created and a
          booking advance (20%) is payable through ShaadiSetu to lock the date. The platform charges
          vendors a 15% commission on the booking value, included in the quoted price.
        </p>
        <h3>Vendor obligations</h3>
        <p>
          Vendors must be verified before listing, deliver the agreed service on the agreed date,
          and honour quoted prices. Repeated cancellations or misconduct lead to suspension.
        </p>
        <h3>Disputes</h3>
        <p>
          Grievances are handled per the Consumer Protection (E-Commerce) Rules 2020 — acknowledged
          within 48 hours, resolved within one month. Jurisdiction: Bongaigaon, Assam.
        </p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>We process personal data per the Digital Personal Data Protection Act, 2023.</p>
        <h3>What we collect</h3>
        <p>
          Account details (name, email, phone), wedding details you share in quote requests,
          and chat messages between you and vendors (visible to both parties and, for dispute
          resolution, to the platform).
        </p>
        <h3>What we don't do</h3>
        <p>No selling of personal data; no third-party advertising use.</p>
        <h3>Deletion</h3>
        <p>
          Request a copy or deletion of your data anytime at [email]. We retain records required
          by tax law.
        </p>
      </>
    ),
  },
  refunds: {
    title: 'Cancellations & Refunds',
    body: (
      <>
        <h3>Customer cancellations</h3>
        <p>
          More than 30 days before the event: full advance refund. 15–30 days: 50% of the advance.
          Under 15 days: advance is non-refundable (the vendor reserved your date).
        </p>
        <h3>Vendor cancellations</h3>
        <p>
          Full advance refund to the customer + we help find a replacement vendor at priority.
          The cancelling vendor may be suspended.
        </p>
        <h3>Refund timing</h3>
        <p>Within 5 business days of approval, to the original payment method or by bank/UPI transfer.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact & Grievance Officer',
    body: (
      <>
        <p>
          ShaadiSetu, [Address], Bongaigaon, Assam [PIN]<br />
          Phone/WhatsApp: [phone] · Email: [email]
        </p>
        <h3>Grievance Officer</h3>
        <p>
          [Name] · [grievance email] · [phone]<br />
          Complaints acknowledged within 48 hours, resolved within one month
          (Consumer Protection (E-Commerce) Rules 2020).
        </p>
      </>
    ),
  },
};

export default function Legal() {
  const { page } = useParams();
  const content = PAGES[page ?? ''];
  if (!content) {
    return (
      <div className="container">
        <h1>Legal &amp; Policies</h1>
        <ul>
          {Object.entries(PAGES).map(([slug, p]) => (
            <li key={slug}><Link to={`/legal/${slug}`}>{p.title}</Link></li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="container legal">
      <nav className="breadcrumb"><Link to="/legal">← Legal</Link></nav>
      <h1>{content.title}</h1>
      <div className="card">{content.body}</div>
      <p className="muted">Items in [brackets] must be completed before launch; have a lawyer review the final text.</p>
    </div>
  );
}
