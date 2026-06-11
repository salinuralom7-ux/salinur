import { Link, useParams } from 'react-router-dom';

// Legal pages required by the Consumer Protection (E-Commerce) Rules 2020,
// the DPDP Act 2023, and Google Play / Apple App Store policies.
// Items in [square brackets] must be filled in with the store's real details
// before launch, and the final text should be reviewed by a lawyer.

const PAGES: Record<string, { title: string; body: React.ReactNode }> = {
  terms: {
    title: 'Terms & Conditions',
    body: (
      <>
        <h3>1. About us</h3>
        <p>
          This app is operated by <strong>Budget Phone Store</strong>, [Full legal/proprietor name],
          [Shop address], Bongaigaon, Assam, India. GSTIN: [Your GSTIN]. Contact: [phone] · [email].
        </p>
        <h3>2. What we sell</h3>
        <p>
          We sell <strong>refurbished (pre-owned) mobile phones and accessories</strong>. Every phone is
          clearly labelled with a condition grade (A to E) describing cosmetic condition, battery health,
          repair history and included accessories. Country of origin is displayed where applicable.
          Refurbished phones are not new devices; brand warranties may not apply unless stated.
        </p>
        <h3>3. Grading & honest disclosure</h3>
        <p>
          Grade descriptions are part of the product offer. Grade E devices <strong>require repair before
          use</strong> and are sold only after the buyer explicitly confirms understanding this at checkout.
        </p>
        <h3>4. Pricing & invoices</h3>
        <p>
          All prices are in Indian Rupees and include applicable GST. A tax invoice is provided with
          every order (digital copy in the app and a physical copy with the shipment).
        </p>
        <h3>5. Warranty</h3>
        <p>
          Store warranty by grade: A — 12 months, B — 6 months, C — 6 months, D — 3 months,
          E — 1 month (repair warranty only). The warranty covers functional defects, not physical or
          liquid damage, and does not affect your statutory rights under the Consumer Protection Act 2019.
        </p>
        <h3>6. IMEI & lawful ownership</h3>
        <p>
          Every device's IMEI is verified before listing. We do not buy or sell devices reported lost,
          stolen, or blacklisted. Purchase invoices are retained as required by law.
        </p>
        <h3>7. Disputes</h3>
        <p>
          Grievances are handled by our Grievance Officer (see Contact page) within the timelines of the
          Consumer Protection (E-Commerce) Rules 2020 — acknowledgment within 48 hours and resolution
          within one month. Jurisdiction: courts of Bongaigaon, Assam.
        </p>
      </>
    ),
  },
  returns: {
    title: 'Returns, Refunds & Cancellation Policy',
    body: (
      <>
        <h3>15-day money-back guarantee</h3>
        <p>
          Phones may be returned within <strong>15 days of delivery</strong> if the device is defective,
          not as described, or the grade does not match the listing. The device must be returned with all
          included accessories, not be physically damaged after delivery, and have all personal locks
          (Google account / iCloud) removed.
        </p>
        <h3>How to return</h3>
        <ol>
          <li>Contact us with your order ID (phone, WhatsApp or email — see Contact page).</li>
          <li>We arrange free return pickup for valid warranty/description claims.</li>
          <li>Refunds are issued to the original payment method within <strong>5 business days</strong> of
            us receiving and verifying the device. Cash-on-delivery orders are refunded by UPI/bank transfer.</li>
        </ol>
        <h3>Cancellation</h3>
        <p>Orders can be cancelled free of charge any time before dispatch.</p>
        <h3>Grade E devices</h3>
        <p>
          Grade E ("needs repair") devices are returnable within 15 days only if the faults differ from
          those disclosed in the listing. The disclosed faults themselves are not grounds for return.
        </p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>
          Budget Phone Store ("we") respects your privacy and processes personal data in accordance with
          the <strong>Digital Personal Data Protection Act, 2023</strong>.
        </p>
        <h3>What we collect</h3>
        <ul>
          <li><strong>Order data:</strong> name, phone number, delivery address — used solely to process and deliver your order, issue invoices, and provide warranty service.</li>
          <li><strong>Account data (admin):</strong> email address for store administration sign-in.</li>
          <li><strong>On-device data:</strong> your cart and wishlist are stored on your own device and are not sent to us until you place an order.</li>
        </ul>
        <h3>What we do NOT do</h3>
        <ul>
          <li>We do not sell or rent your personal data to anyone.</li>
          <li>We do not use your data for third-party advertising.</li>
          <li>We do not collect data unrelated to fulfilling your order.</li>
        </ul>
        <h3>Storage & security</h3>
        <p>
          Order data is stored securely with our database provider (Supabase) with access restricted to
          store administrators. Payment processing is handled by RBI-regulated payment gateways; we never
          see or store your full card details.
        </p>
        <h3>Your rights & data deletion</h3>
        <p>
          You may request a copy, correction, or <strong>deletion of your personal data</strong> at any
          time by contacting us (see Contact page) with your order ID. We delete personal data on request
          except where retention is required by tax or consumer-protection law.
        </p>
        <h3>Children</h3>
        <p>Our services are intended for users aged 18 and above.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact & Grievance Officer',
    body: (
      <>
        <h3>Store</h3>
        <p>
          Budget Phone Store<br />
          [Shop address], Bongaigaon, Assam [PIN]<br />
          Phone / WhatsApp: [phone number]<br />
          Email: [email]<br />
          Hours: [e.g. Mon–Sat, 10:00–20:00]
        </p>
        <h3>Grievance Officer (per Consumer Protection (E-Commerce) Rules 2020)</h3>
        <p>
          Name: [Grievance officer name]<br />
          Email: [grievance email]<br />
          Phone: [phone]<br />
          Complaints are acknowledged within 48 hours and resolved within one month.
        </p>
        <h3>E-waste</h3>
        <p>
          We accept old phones, batteries and chargers for responsible recycling in line with the E-Waste
          (Management) Rules 2022 — drop them at our store anytime.
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
        <h1>Legal & Policies</h1>
        <ul>
          {Object.entries(PAGES).map(([slug, p]) => (
            <li key={slug}><Link to={`/legal/${slug}`}>{p.title}</Link></li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="container legal-page">
      <nav className="breadcrumb"><Link to="/">Home</Link> / <Link to="/legal">Legal</Link> / {content.title}</nav>
      <h1>{content.title}</h1>
      <div className="card">{content.body}</div>
      <p className="muted">
        Last updated: June 2026. Placeholders in [brackets] must be completed with the store's registered
        details; have the final text reviewed by a legal professional before launch.
      </p>
    </div>
  );
}
