import { Link, Navigate, useParams } from 'react-router-dom';
import { BRANDS_BY_SLUG } from '../data/catalog';
import { CONDITIONS } from '../data/conditions';
import { EMPTY_FILTERS, search } from '../lib/search';
import { inr } from '../lib/format';
import ModelCard from '../components/ModelCard';

/** Every model of one maker, grouped by the series the maker sold them under. */
export default function BrandPage() {
  const { slug = '' } = useParams();
  const brand = BRANDS_BY_SLUG.get(slug);

  if (!brand) return <Navigate to="/shop" replace />;

  const results = search({ ...EMPTY_FILTERS, brands: [brand.name] }, 'newest');

  const bySeries = new Map<string, typeof results>();
  for (const result of results) {
    const bucket = bySeries.get(result.model.series);
    if (bucket) bucket.push(result);
    else bySeries.set(result.model.series, [result]);
  }

  const totalListings = results.reduce((sum, r) => sum + r.matches.length, 0);
  const conditionsHeld = [...new Set(results.flatMap((r) => r.conditions))].sort(
    (a, b) => CONDITIONS[a].rank - CONDITIONS[b].rank,
  );

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/shop">All phones</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{brand.name}</span>
      </nav>

      <header className="page-head">
        <h1>{brand.name} phones</h1>
        <p className="lede">
          {brand.modelCount} model{brand.modelCount === 1 ? '' : 's'} in stock, {totalListings} individual
          handsets, starting at {inr(brand.fromPrice)}.
        </p>
        <ul className="chip-row">
          {conditionsHeld.map((c) => (
            <li key={c} className="chip" style={{ '--chip': CONDITIONS[c].color } as React.CSSProperties}>
              <Link to={`/shop?brand=${brand.slug}&condition=${c}`}>{CONDITIONS[c].name}</Link>
            </li>
          ))}
        </ul>
      </header>

      {[...bySeries.entries()].map(([series, models]) => (
        <section key={series} className="series-block">
          <h2 className="series-title">{series}</h2>
          <div className="model-grid">
            {models.map((result) => (
              <ModelCard key={result.model.id} result={result} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
