import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Condition, Listing } from '../types';
import { CONDITIONS, CONDITION_LIST, INSPECTION, INSPECTION_POINT_COUNT } from '../data/conditions';
import { color as resolveColor } from '../data/colors';
import { brandSlug } from '../data/catalog';
import { formatStorage, getModel, listingsForModel, listingTitle, reviewsForModel } from '../lib/inventory';
import { minBookingCharge } from '../lib/pricing';
import { inr, longDate, percentOff } from '../lib/format';
import { POLICY } from '../config';
import { useStore } from '../store/context';
import PhoneRender from '../components/PhoneRender';
import PhotoRequestDialog from '../components/PhotoRequestDialog';
import ConditionBadge, { Stars } from '../components/ConditionBadge';

/**
 * Picks the listing to show after the customer changes one of the three
 * selectors. The dimension they just touched is honoured absolutely; the other
 * two are kept if that combination exists, and otherwise fall back in order of
 * how much a shopper is likely to care — capacity, then colour, then condition.
 */
function reselect(
  all: Listing[],
  want: { storageGb: number; colorId: string; condition: Condition },
  fixed: Partial<{ storageGb: number; colorId: string; condition: Condition }>,
): Listing {
  const candidates = all.filter(
    (l) =>
      (fixed.storageGb === undefined || l.storageGb === fixed.storageGb) &&
      (fixed.colorId === undefined || l.color.id === fixed.colorId) &&
      (fixed.condition === undefined || l.condition === fixed.condition),
  );

  const pool = candidates.length > 0 ? candidates : all;

  return pool.reduce((best, listing) => {
    const score = (l: Listing) =>
      (l.storageGb === want.storageGb ? 4 : 0) +
      (l.color.id === want.colorId ? 2 : 0) +
      (l.condition === want.condition ? 1 : 0);

    const diff = score(listing) - score(best);
    if (diff > 0) return listing;
    if (diff === 0 && listing.price < best.price) return listing;
    return best;
  }, pool[0]);
}

export default function ProductDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, inWishlist } = useStore();

  const model = getModel(id);
  const listings = useMemo(() => listingsForModel(id), [id]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);

  const reviews = useMemo(() => reviewsForModel(id), [id]);

  if (!model || listings.length === 0) return <Navigate to="/shop" replace />;

  const cheapest = listings.reduce((best, l) => (l.price < best.price ? l : best));
  const selected = (selectedId && listings.find((l) => l.id === selectedId)) || cheapest;

  const want = {
    storageGb: selected.storageGb,
    colorId: selected.color.id,
    condition: selected.condition,
  };

  const storages = [...new Set(listings.map((l) => l.storageGb))].sort((a, b) => a - b);

  // Colours are shown in the order the manufacturer listed them, including any
  // we do not currently hold, so the customer can see the full range and ask.
  const colorAvailability = model.colors.map((name) => {
    const option = resolveColor(name);
    const forStorage = listings.filter(
      (l) => l.color.id === option.id && l.storageGb === selected.storageGb,
    );
    const anywhere = listings.filter((l) => l.color.id === option.id);
    return {
      option,
      inThisStorage: forStorage.length > 0,
      inStock: anywhere.length > 0,
      from: anywhere.length > 0 ? Math.min(...anywhere.map((l) => l.price)) : 0,
    };
  });

  // The price ladder must compare like with like. Falling back to the cheapest
  // listing of a condition across every capacity made Superb look barely dearer
  // than Excellent, so prefer the selected capacity and say so when the quoted
  // price comes from a different one.
  const cheapestOf = (pool: Listing[]) =>
    pool.length > 0 ? pool.reduce((best, l) => (l.price < best.price ? l : best)) : undefined;

  const conditionAvailability = CONDITION_LIST.map((info) => {
    const ofCondition = listings.filter((l) => l.condition === info.id);
    const exact = ofCondition.find(
      (l) => l.storageGb === selected.storageGb && l.color.id === selected.color.id,
    );
    const sameStorage = cheapestOf(ofCondition.filter((l) => l.storageGb === selected.storageGb));
    const best = exact ?? sameStorage ?? cheapestOf(ofCondition);

    return {
      info,
      best,
      available: best !== undefined,
      /** True when the quoted price is for the capacity the customer is looking at. */
      sameCapacity: best !== undefined && best.storageGb === selected.storageGb,
      isExact: exact !== undefined,
    };
  });

  const saving = percentOff(selected.mrp, selected.price);
  const booking = minBookingCharge(selected.price);
  const wished = inWishlist(selected.id);
  const conditionInfo = CONDITIONS[selected.condition];

  const choose = (fixed: Partial<{ storageGb: number; colorId: string; condition: Condition }>) => {
    setSelectedId(reselect(listings, want, fixed).id);
    setAdded(false);
  };

  const handleAdd = () => {
    addToCart(selected.id, 1);
    setAdded(true);
  };

  const buyNow = () => {
    addToCart(selected.id, 1);
    navigate('/checkout');
  };

  return (
    <div className="container product">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/brand/${brandSlug(model.brand)}`}>{model.brand}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{model.name}</span>
      </nav>

      <div className="product-main">
        <div className="product-media">
          <div className="product-render">
            <PhoneRender listing={selected} size="lg" />
          </div>

          <div className="photo-callout">
            <h2>Photos of this exact phone</h2>
            <p>
              We do not publish stock images. Every handset here is physically different, so we photograph the
              actual unit — front, back, all four edges, screen on, and a close-up of every mark named below.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setPhotoOpen(true)}>
              See the real photos
            </button>
            <p className="muted small">
              Sent to your WhatsApp, usually within two hours. Free, and no obligation to buy.
            </p>
          </div>
        </div>

        <div className="product-info">
          <p className="product-brand">
            <Link to={`/brand/${brandSlug(model.brand)}`}>{model.brand}</Link> · {model.series} · {model.year}
          </p>
          <h1>{model.name}</h1>
          <p className="lede">{model.blurb}</p>

          <div className="product-rating">
            <Stars rating={selected.rating} count={selected.reviewCount} />
            <span className="unit-ref">Unit {selected.unitRef}</span>
          </div>

          <div className="price-block">
            <strong className="price-now">{inr(selected.price)}</strong>
            {saving > 0 && (
              <>
                <span className="mrp">{inr(selected.mrp)}</span>
                <span className="save-flag">{saving}% below MRP</span>
              </>
            )}
          </div>
          <p className="muted small">
            Or book it for {inr(booking)} online and pay {inr(selected.price - booking)} to the courier.
          </p>

          {/* ---- Storage ------------------------------------------------- */}
          <fieldset className="picker">
            <legend>
              Storage <strong>{formatStorage(selected.storageGb)}</strong>
            </legend>
            <div className="picker-row">
              {storages.map((gb) => {
                const cheapestAt = listings
                  .filter((l) => l.storageGb === gb)
                  .reduce((best, l) => (l.price < best.price ? l : best));
                return (
                  <button
                    key={gb}
                    type="button"
                    className={`picker-btn${gb === selected.storageGb ? ' is-on' : ''}`}
                    onClick={() => choose({ storageGb: gb })}
                  >
                    <span className="picker-label">{formatStorage(gb)}</span>
                    <span className="picker-sub">from {inr(cheapestAt.price)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ---- Colour -------------------------------------------------- */}
          <fieldset className="picker">
            <legend>
              Colour <strong>{selected.color.name}</strong>
            </legend>
            <div className="swatch-picker">
              {colorAvailability.map(({ option, inThisStorage, inStock }) => (
                <button
                  key={option.id}
                  type="button"
                  className={`swatch${option.id === selected.color.id ? ' is-on' : ''}${
                    inStock ? '' : ' is-out'
                  }`}
                  onClick={() => inStock && choose({ colorId: option.id })}
                  disabled={!inStock}
                  title={
                    inStock
                      ? inThisStorage
                        ? option.name
                        : `${option.name} — not in ${formatStorage(selected.storageGb)}, we will switch capacity`
                      : `${option.name} — none in stock, ask us to source one`
                  }
                  aria-label={option.name}
                  aria-pressed={option.id === selected.color.id}
                >
                  <span
                    className="swatch-fill"
                    style={{
                      background: option.hex2
                        ? `linear-gradient(135deg, ${option.hex}, ${option.hex2})`
                        : option.hex,
                    }}
                  />
                </button>
              ))}
            </div>
            <p className="muted small">
              {colorAvailability.filter((c) => c.inStock).length} of {model.colors.length} factory colours in
              stock. Ask us on WhatsApp if you want one we do not have.
            </p>
          </fieldset>

          {/* ---- Condition ----------------------------------------------- */}
          <fieldset className="picker">
            <legend>
              Condition <strong>{conditionInfo.name}</strong>
            </legend>
            <div className="condition-picker">
              {conditionAvailability.map(({ info, best, available, sameCapacity }) => (
                <button
                  key={info.id}
                  type="button"
                  className={`condition-option${info.id === selected.condition ? ' is-on' : ''}${
                    available ? '' : ' is-out'
                  }`}
                  style={{ '--accent': info.color } as React.CSSProperties}
                  onClick={() => available && choose({ condition: info.id })}
                  disabled={!available}
                >
                  <span className="condition-option-name">{info.name}</span>
                  <span className="condition-option-price">
                    {best ? inr(best.price) : 'Out of stock'}
                  </span>
                  <span className="condition-option-note">
                    {!best
                      ? 'Ask us to source one'
                      : sameCapacity
                        ? `${info.warrantyMonths}-month warranty`
                        : `in ${formatStorage(best.storageGb)} · ${info.warrantyMonths}-month warranty`}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* ---- This unit ----------------------------------------------- */}
          <section className="unit-panel">
            <h2>
              About this handset <ConditionBadge condition={selected.condition} size="sm" />
            </h2>
            <dl className="unit-facts">
              <div>
                <dt>Battery health</dt>
                <dd>{selected.batteryHealth}%</dd>
              </div>
              <div>
                <dt>Warranty</dt>
                <dd>{selected.warrantyMonths} months from delivery</dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>
                  {selected.ram} RAM · {formatStorage(selected.storageGb)}
                </dd>
              </div>
              <div>
                <dt>In stock</dt>
                <dd>
                  {selected.stock} unit{selected.stock === 1 ? '' : 's'}
                </dd>
              </div>
            </dl>

            <h3>Cosmetic condition</h3>
            <p>{selected.conditionNotes}</p>

            {selected.repairs && (
              <>
                <h3>Repair history</h3>
                <p>{selected.repairs}</p>
              </>
            )}

            <h3>In the box</h3>
            <ul className="tick-list">
              {selected.accessories.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <div className="buy-row">
            <button type="button" className="btn btn-primary btn-lg" onClick={buyNow}>
              Buy now
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={handleAdd}>
              {added ? 'Added ✓' : 'Add to cart'}
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-lg${wished ? ' is-on' : ''}`}
              onClick={() => toggleWishlist(selected.id)}
              aria-pressed={wished}
            >
              {wished ? '♥ Saved' : '♡ Save'}
            </button>
          </div>

          {added && (
            <p className="added-hint">
              <Link to="/cart">Go to cart →</Link>
            </p>
          )}

          <ul className="assurance">
            <li>{INSPECTION_POINT_COUNT}-point inspection passed</li>
            <li>IMEI checked against the national blacklist</li>
            <li>{POLICY.inspectionWindowMinutes}-minute check at your door before you accept</li>
            <li>{POLICY.returnWindowDays}-day return if it does not match the listing</li>
          </ul>
        </div>
      </div>

      {/* ---- Specifications --------------------------------------------- */}
      <section className="section-block">
        <h2>Full specification</h2>
        <table className="spec-table">
          <tbody>
            {Object.entries(model.specs).map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>{value}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">RAM</th>
              <td>{model.ram}</td>
            </tr>
            <tr>
              <th scope="row">Storage options</th>
              <td>{model.storage.map(([gb]) => formatStorage(gb)).join(', ')}</td>
            </tr>
            <tr>
              <th scope="row">Factory colours</th>
              <td>{model.colors.join(', ')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ---- Inspection -------------------------------------------------- */}
      <section className="section-block">
        <div className="section-head">
          <h2>The {INSPECTION_POINT_COUNT}-point inspection</h2>
          <button type="button" className="link-btn" onClick={() => setInspectionOpen((o) => !o)}>
            {inspectionOpen ? 'Hide the full list' : 'Show the full list'}
          </button>
        </div>
        <p className="muted">
          Every handset passes all {INSPECTION_POINT_COUNT} checks before it is graded and priced. Anything
          that cannot be brought up to standard is not listed at all.
        </p>

        {inspectionOpen && (
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
        )}
      </section>

      {/* ---- Reviews ----------------------------------------------------- */}
      {reviews.length > 0 && (
        <section className="section-block">
          <h2>What buyers said about the {model.name}</h2>
          <div className="reviews">
            {reviews.map((review, index) => (
              <article key={index} className="review">
                <header>
                  <strong>{review.author}</strong>
                  <span className="muted small">{review.city}</span>
                  {review.verified && <span className="verified">Verified purchase</span>}
                </header>
                <Stars rating={review.rating} />
                <p>{review.text}</p>
                <footer className="muted small">
                  Bought in {CONDITIONS[review.condition].name} · {longDate(review.date)}
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}

      <PhotoRequestDialog listing={selected} open={photoOpen} onClose={() => setPhotoOpen(false)} />
      <p className="muted small">{listingTitle(selected)} — reference {selected.unitRef}</p>
    </div>
  );
}
