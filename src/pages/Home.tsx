import { Link } from 'react-router-dom';
import { BRANDS } from '../data/catalog';
import { CONDITION_LIST, INSPECTION_POINT_COUNT } from '../data/conditions';
import { LISTINGS, STOCKED_MODELS } from '../lib/inventory';
import { EMPTY_FILTERS, search } from '../lib/search';
import { inr } from '../lib/format';
import { POLICY, STORE } from '../config';
import ModelCard from '../components/ModelCard';
import PhoneRender from '../components/PhoneRender';

function brandInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Stock counts per condition, computed once for the condition cards. */
const CONDITION_STOCK = CONDITION_LIST.map((c) => {
  const matching = LISTINGS.filter((l) => l.condition === c.id);
  return {
    info: c,
    count: matching.length,
    from: matching.length > 0 ? Math.min(...matching.map((l) => l.price)) : 0,
  };
});

export default function Home() {
  const bestValue = search(EMPTY_FILTERS, 'saving').slice(0, 8);
  const newest = search(EMPTY_FILTERS, 'newest').slice(0, 4);
  const iphoneModels = STOCKED_MODELS.filter((m) => m.brand === 'Apple').length;
  const bookingPercent = Math.round(POLICY.minBookingFraction * 100);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              {STORE.city}, {STORE.state}
            </p>
            <h1>
              Second-hand phones,
              <br />
              graded honestly.
            </h1>
            <p className="lede">
              {LISTINGS.length.toLocaleString('en-IN')} handsets on the shelf across {STOCKED_MODELS.length}{' '}
              models, every one put through a {INSPECTION_POINT_COUNT}-point inspection and sold in one of four
              clearly-defined conditions. What the listing says is what arrives.
            </p>

            <div className="hero-actions">
              <Link to="/shop" className="btn btn-primary btn-lg">
                Browse all phones
              </Link>
              <Link to="/brand/apple" className="btn btn-ghost btn-lg">
                {iphoneModels} iPhone models
              </Link>
            </div>

            <ul className="hero-points">
              <li>
                <strong>Pay a tenth to book</strong>
                <span>Cash on delivery needs only a {bookingPercent}% booking charge online</span>
              </li>
              <li>
                <strong>Photos of your actual phone</strong>
                <span>Ask, and we shoot the exact unit before you pay a rupee</span>
              </li>
              <li>
                <strong>Warranty on every condition</strong>
                <span>Three months on Moderate, up to twelve on Superb</span>
              </li>
            </ul>
          </div>

          <div className="hero-art" aria-hidden="true">
            {newest.slice(0, 3).map((result, index) => (
              <div key={result.model.id} className={`hero-phone hero-phone-${index}`}>
                <PhoneRender listing={result.cheapest} size="lg" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Shop by condition</h2>
              <p className="muted">
                The condition sets the price, the warranty and what is in the box. Nothing hides behind a vague
                word like “refurbished”.
              </p>
            </div>
            <Link to="/help" className="link-arrow">
              How we grade
            </Link>
          </div>

          <div className="condition-grid">
            {CONDITION_STOCK.map(({ info, count, from }) => (
              <Link
                key={info.id}
                to={`/condition/${info.id}`}
                className="condition-card"
                style={{ '--accent': info.color } as React.CSSProperties}
              >
                <span className="condition-card-rule" />
                <h3>{info.name}</h3>
                <p className="condition-card-headline">{info.headline}</p>
                <dl className="condition-card-facts">
                  <div>
                    <dt>Battery</dt>
                    <dd>
                      {info.batteryRange[0]}–{info.batteryRange[1]}%
                    </dd>
                  </div>
                  <div>
                    <dt>Warranty</dt>
                    <dd>{info.warrantyMonths} months</dd>
                  </div>
                </dl>
                <p className="condition-card-from">
                  {count} in stock · from {inr(from)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Shop by brand</h2>
              <p className="muted">Every model we deal in, grouped by maker.</p>
            </div>
          </div>

          <div className="brand-grid">
            {BRANDS.map((brand) => (
              <Link key={brand.slug} to={`/brand/${brand.slug}`} className="brand-card">
                <span className="brand-mark" aria-hidden="true">
                  {brandInitials(brand.name)}
                </span>
                <span className="brand-name">{brand.name}</span>
                <span className="brand-meta">
                  {brand.modelCount} model{brand.modelCount === 1 ? '' : 's'} · from {inr(brand.fromPrice)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Biggest savings against MRP</h2>
              <p className="muted">Sorted by how far below the original launch price they sit.</p>
            </div>
            <Link to="/shop?sort=saving" className="link-arrow">
              See all
            </Link>
          </div>

          <div className="model-grid">
            {bestValue.map((result) => (
              <ModelCard key={result.model.id} result={result} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="container">
          <h2>How buying here works</h2>
          <ol className="steps">
            <li>
              <h3>Pick the phone and the condition</h3>
              <p>
                Choose the model, then the capacity, colour and condition. Each combination is a specific
                handset on our shelf with its own battery reading and its own list of marks.
              </p>
            </li>
            <li>
              <h3>Ask for photos of that exact unit</h3>
              <p>
                Tap “See the real photos” and give us a WhatsApp number. We photograph the actual phone,
                including close-ups of every mark named in the listing, usually within two hours.
              </p>
            </li>
            <li>
              <h3>Pay in full, or book with a tenth</h3>
              <p>
                Pay the whole amount online through Razorpay, or choose cash on delivery and pay a booking
                charge of at least {bookingPercent}% online. The booking charge comes off the total — the
                balance goes to the courier.
              </p>
            </li>
            <li>
              <h3>Check it before you accept it</h3>
              <p>
                You get {POLICY.inspectionWindowMinutes} minutes with the courier present to switch the phone
                on and check it against the listing. If it does not match, refuse it and the booking charge is
                refunded in full.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Just arrived</h2>
              <p className="muted">The newest models to reach the shelf.</p>
            </div>
            <Link to="/shop?sort=newest" className="link-arrow">
              See all
            </Link>
          </div>
          <div className="model-grid">
            {newest.map((result) => (
              <ModelCard key={result.model.id} result={result} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
