import { Link } from 'react-router-dom';
import { CONDITION_LIST, INSPECTION, INSPECTION_POINT_COUNT } from '../data/conditions';
import { POLICY, STORE } from '../config';
import { inr } from '../lib/format';

const bookingPercent = Math.round(POLICY.minBookingFraction * 100);

export default function Help() {
  return (
    <div className="container help">
      <header className="page-head">
        <h1>How this shop works</h1>
        <p className="lede">
          Grading, the booking charge, photographs, warranty and returns — written out plainly, with no
          asterisks.
        </p>
      </header>

      <section className="section-block" id="conditions">
        <h2>The four conditions</h2>
        <p>
          Every handset is inspected before it is listed, then placed in one of four conditions. The condition
          fixes the price, the warranty and what goes in the box. We do not use the word “refurbished” on its
          own, because it tells a customer nothing.
        </p>

        <div className="help-conditions">
          {CONDITION_LIST.map((info) => (
            <article key={info.id} className="help-condition" style={{ '--accent': info.color } as React.CSSProperties}>
              <h3>
                <Link to={`/condition/${info.id}`}>{info.name}</Link>
              </h3>
              <p className="muted">{info.headline}</p>
              <p>{info.description}</p>
              <ul className="tick-list">
                {info.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <p className="muted small">
                Battery {info.batteryRange[0]}–{info.batteryRange[1]}% · {info.warrantyMonths}-month warranty ·{' '}
                {info.accessories}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block" id="booking">
        <h2>The booking charge on cash on delivery</h2>
        <p>
          Cash on delivery is offered on orders up to {inr(POLICY.codMaxOrderValue)}, and is secured with a
          booking charge paid online at the time of ordering. The booking charge is{' '}
          <strong>at least one tenth ({bookingPercent}%) of the order total</strong>. You may pay more than the
          minimum, up to the full amount, if you would rather carry less cash on the day.
        </p>

        <h3>Why we ask for it</h3>
        <p>
          Each listing is one physical handset. When you book it, it comes off the shelf and stops being
          available to anyone else. A refused delivery costs us the round trip and the days the phone spent out
          of stock. The booking charge is the smallest amount that makes that fair to both sides.
        </p>

        <h3>What happens to it</h3>
        <ul className="tick-list">
          <li>It is deducted from the order total. You never pay it twice.</li>
          <li>The balance is paid in cash to the courier, who cannot accept UPI or cards.</li>
          <li>
            You have {POLICY.inspectionWindowMinutes} minutes with the courier present to switch the phone on
            and check it against its listing.
          </li>
          <li>
            If the handset does not match the listing, refuse it. The booking charge is refunded in full within
            five working days.
          </li>
          <li>
            If we cancel, cannot deliver, or the phone fails its final inspection, it is refunded in full.
          </li>
          <li>
            If you change your mind and refuse a delivery that does match its listing, the booking charge is
            kept to cover the round trip. Nothing further is owed.
          </li>
        </ul>
      </section>

      <section className="section-block" id="photos">
        <h2>Why photographs are sent on request</h2>
        <p>
          We do not publish photo galleries on the listings. It would be dishonest: every handset on the shelf
          is a different physical object with its own marks, and a single gallery cannot represent twenty units
          of the same model in four different conditions.
        </p>
        <p>
          Instead, ask. Tap <strong>“See the real photos”</strong> on any phone, give us a WhatsApp number, and
          we photograph that exact unit — front, back, all four edges, the screen switched on, the battery
          health page, and a close-up of every mark named in the listing. It is free, there is no obligation to
          buy, and it usually takes under two hours during shop hours ({STORE.hours}).
        </p>
        <p className="muted">
          The unit reference shown on each listing, such as <code>BPS-4F2A9C</code>, is how we identify which
          phone to photograph. Quote it in any message.
        </p>
      </section>

      <section className="section-block" id="inspection">
        <h2>The {INSPECTION_POINT_COUNT}-point inspection</h2>
        <p>
          Every handset passes all {INSPECTION_POINT_COUNT} checks before it is graded and priced. A phone that
          cannot be brought up to standard is not listed — it is sold for parts, never as a working phone.
        </p>
        <div className="inspection-grid">
          {INSPECTION.map((group) => (
            <div key={group.area} className="inspection-group">
              <h3>{group.area}</h3>
              <ul className="tick-list">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block" id="warranty">
        <h2>Warranty and returns</h2>
        <p>
          The warranty runs from the day the phone is delivered and covers hardware faults that were not
          disclosed in the listing. Superb carries twelve months, Excellent nine, Good six and Moderate three.
          It does not cover physical damage, liquid damage or a battery worn down by normal use after delivery.
        </p>
        <p>
          Separately from the warranty, you may return any handset within {POLICY.returnWindowDays} days if it
          does not match the condition, battery figure or marks described in its listing. We pay the return
          courier and refund in full.
        </p>
      </section>

      <section className="section-block" id="contact">
        <h2>Talk to us</h2>
        <p>
          {STORE.addressLines.join(', ')}. Open {STORE.hours}.
        </p>
        <p>
          Email <a href={`mailto:${STORE.email}`}>{STORE.email}</a> or message the shop on WhatsApp — the
          fastest way to reach us about a specific handset is to quote its unit reference.
        </p>
      </section>
    </div>
  );
}
