import { Link, Navigate, useParams } from 'react-router-dom';
import { CONDITIONS, CONDITION_LIST, isCondition } from '../data/conditions';
import { EMPTY_FILTERS, search } from '../lib/search';
import { inr } from '../lib/format';
import { POLICY } from '../config';
import ModelCard from '../components/ModelCard';

/**
 * One of the four condition tiers, explained in full and then listed. This is
 * the page we point customers at when they ask what "Good" actually means.
 */
export default function ConditionPage() {
  const { condition = '' } = useParams();
  if (!isCondition(condition)) return <Navigate to="/shop" replace />;

  const info = CONDITIONS[condition];
  const results = search({ ...EMPTY_FILTERS, conditions: [condition] }, 'price-asc');
  const totalListings = results.reduce((sum, r) => sum + r.matches.length, 0);
  const from = results.length > 0 ? results[0].cheapest.price : 0;

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/shop">All phones</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{info.name}</span>
      </nav>

      <header
        className="condition-hero"
        style={{ '--accent': info.color } as React.CSSProperties}
      >
        <div className="condition-hero-copy">
          <p className="eyebrow">Condition</p>
          <h1>{info.name}</h1>
          <p className="lede">{info.headline}</p>
          <p>{info.description}</p>

          <dl className="fact-row">
            <div>
              <dt>Battery health</dt>
              <dd>
                {info.batteryRange[0]}–{info.batteryRange[1]}%
              </dd>
            </div>
            <div>
              <dt>Warranty</dt>
              <dd>{info.warrantyMonths} months</dd>
            </div>
            <div>
              <dt>In the box</dt>
              <dd>{info.accessories}</dd>
            </div>
            <div>
              <dt>In stock</dt>
              <dd>
                {totalListings} handsets from {inr(from)}
              </dd>
            </div>
          </dl>
        </div>

        <ul className="condition-hero-points">
          {info.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </header>

      <nav className="condition-switch" aria-label="Other conditions">
        {CONDITION_LIST.map((other) => (
          <Link
            key={other.id}
            to={`/condition/${other.id}`}
            className={other.id === condition ? 'is-current' : ''}
            style={{ '--accent': other.color } as React.CSSProperties}
          >
            {other.name}
          </Link>
        ))}
      </nav>

      <p className="note">
        Every {info.name.toLowerCase()} handset carries a {info.warrantyMonths}-month warranty and the same{' '}
        {POLICY.inspectionWindowMinutes}-minute inspection window at the door. Ask for photographs of any unit
        before you pay.
      </p>

      <div className="model-grid">
        {results.map((result) => (
          <ModelCard key={result.model.id} result={result} />
        ))}
      </div>
    </div>
  );
}
