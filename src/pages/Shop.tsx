import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Condition } from '../types';
import { BRANDS, BRANDS_BY_SLUG } from '../data/catalog';
import { CONDITIONS, CONDITION_LIST, isCondition } from '../data/conditions';
import { formatStorage } from '../lib/inventory';
import { ALL_STORAGES, POPULAR_SEARCHES, search, type Filters, type SortKey } from '../lib/search';
import { inr } from '../lib/format';
import ModelCard from '../components/ModelCard';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Most relevant' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'newest', label: 'Newest first' },
  { key: 'rating', label: 'Best rated' },
  { key: 'saving', label: 'Biggest saving' },
];

const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹10,000', max: 10000 },
  { label: '₹10,000 – ₹20,000', min: 10000, max: 20000 },
  { label: '₹20,000 – ₹35,000', min: 20000, max: 35000 },
  { label: '₹35,000 – ₹60,000', min: 35000, max: 60000 },
  { label: 'Above ₹60,000', min: 60000 },
];

/**
 * Filters live in the URL rather than in component state, so a filtered view
 * can be shared, bookmarked, and returned to with the browser back button.
 */
function readFilters(params: URLSearchParams): Filters {
  const brandSlugs = params.getAll('brand');
  const brands = brandSlugs.map((slug) => BRANDS_BY_SLUG.get(slug)?.name).filter((n): n is string => !!n);

  return {
    query: params.get('q') ?? '',
    brands,
    conditions: params.getAll('condition').filter(isCondition),
    storages: params.getAll('storage').map(Number).filter(Number.isFinite),
    minPrice: params.has('min') ? Number(params.get('min')) : undefined,
    maxPrice: params.has('max') ? Number(params.get('max')) : undefined,
    fiveGOnly: params.get('5g') === '1',
  };
}

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);

  const filters = useMemo(() => readFilters(params), [params]);
  const sort = (params.get('sort') as SortKey | null) ?? (filters.query ? 'relevance' : 'newest');
  const results = useMemo(() => search(filters, sort), [filters, sort]);

  const activeCount =
    filters.brands.length +
    filters.conditions.length +
    filters.storages.length +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.fiveGOnly ? 1 : 0);

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next, { replace: true });
  };

  const toggleMulti = (key: string, value: string) =>
    update((next) => {
      const existing = next.getAll(key);
      next.delete(key);
      const remaining = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      remaining.forEach((v) => next.append(key, v));
    });

  const setBand = (band: (typeof PRICE_BANDS)[number]) =>
    update((next) => {
      const alreadyOn =
        String(next.get('min') ?? '') === String(band.min ?? '') &&
        String(next.get('max') ?? '') === String(band.max ?? '');

      next.delete('min');
      next.delete('max');
      if (!alreadyOn) {
        if (band.min !== undefined) next.set('min', String(band.min));
        if (band.max !== undefined) next.set('max', String(band.max));
      }
    });

  const clearAll = () =>
    update((next) => {
      const q = next.get('q');
      const sortKey = next.get('sort');
      [...next.keys()].forEach((key) => next.delete(key));
      if (q) next.set('q', q);
      if (sortKey) next.set('sort', sortKey);
    });

  const totalListings = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div className="container shop">
      <header className="page-head">
        <h1>{filters.query ? `Results for “${filters.query}”` : 'All phones'}</h1>
        <p className="muted">
          {results.length} model{results.length === 1 ? '' : 's'} · {totalListings} handset
          {totalListings === 1 ? '' : 's'} in stock
        </p>
      </header>

      <div className="shop-toolbar">
        <button
          type="button"
          className="btn btn-ghost filter-toggle"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
        >
          Filters{activeCount > 0 && <span className="pill">{activeCount}</span>}
        </button>

        <label className="sort-select">
          <span className="visually-hidden">Sort by</span>
          <select value={sort} onChange={(e) => update((next) => next.set('sort', e.target.value))}>
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="shop-layout">
        <aside className={`filters${panelOpen ? ' is-open' : ''}`} aria-label="Filters">
          <div className="filters-head">
            <h2>Filters</h2>
            {activeCount > 0 && (
              <button type="button" className="link-btn" onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>

          <fieldset className="filter-group">
            <legend>Condition</legend>
            {CONDITION_LIST.map((info) => (
              <label key={info.id} className="check">
                <input
                  type="checkbox"
                  checked={filters.conditions.includes(info.id)}
                  onChange={() => toggleMulti('condition', info.id)}
                />
                <span className="check-dot" style={{ background: info.color }} />
                <span>{info.name}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="filter-group">
            <legend>Brand</legend>
            <div className="filter-scroll">
              {BRANDS.map((brand) => (
                <label key={brand.slug} className="check">
                  <input
                    type="checkbox"
                    checked={filters.brands.includes(brand.name)}
                    onChange={() => toggleMulti('brand', brand.slug)}
                  />
                  <span>{brand.name}</span>
                  <span className="check-count">{brand.modelCount}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend>Price</legend>
            {PRICE_BANDS.map((band) => {
              const on =
                filters.minPrice === band.min && filters.maxPrice === band.max;
              return (
                <label key={band.label} className="check">
                  <input type="checkbox" checked={on} onChange={() => setBand(band)} />
                  <span>{band.label}</span>
                </label>
              );
            })}
          </fieldset>

          <fieldset className="filter-group">
            <legend>Storage</legend>
            <div className="storage-chips">
              {ALL_STORAGES.map((gb) => (
                <button
                  key={gb}
                  type="button"
                  className={`chip-btn${filters.storages.includes(gb) ? ' is-on' : ''}`}
                  onClick={() => toggleMulti('storage', String(gb))}
                >
                  {formatStorage(gb)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend>Network</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={filters.fiveGOnly}
                onChange={() =>
                  update((next) => {
                    if (filters.fiveGOnly) next.delete('5g');
                    else next.set('5g', '1');
                  })
                }
              />
              <span>5G only</span>
            </label>
          </fieldset>
        </aside>

        <div className="shop-results">
          {activeCount > 0 && (
            <ul className="active-filters" aria-label="Active filters">
              {filters.conditions.map((c: Condition) => (
                <li key={c}>
                  <button type="button" onClick={() => toggleMulti('condition', c)}>
                    {CONDITIONS[c].name} ✕
                  </button>
                </li>
              ))}
              {filters.brands.map((brand) => (
                <li key={brand}>
                  <button
                    type="button"
                    onClick={() =>
                      toggleMulti('brand', BRANDS.find((b) => b.name === brand)?.slug ?? brand.toLowerCase())
                    }
                  >
                    {brand} ✕
                  </button>
                </li>
              ))}
              {filters.storages.map((gb) => (
                <li key={gb}>
                  <button type="button" onClick={() => toggleMulti('storage', String(gb))}>
                    {formatStorage(gb)} ✕
                  </button>
                </li>
              ))}
              {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      update((next) => {
                        next.delete('min');
                        next.delete('max');
                      })
                    }
                  >
                    {filters.minPrice !== undefined ? inr(filters.minPrice) : '₹0'} –{' '}
                    {filters.maxPrice !== undefined ? inr(filters.maxPrice) : 'any'} ✕
                  </button>
                </li>
              )}
            </ul>
          )}

          {results.length === 0 ? (
            <div className="empty">
              <h2>Nothing matches that</h2>
              <p className="muted">
                {filters.query
                  ? `We have no stock matching “${filters.query}” with these filters.`
                  : 'No stock matches these filters.'}
              </p>
              {activeCount > 0 && (
                <button type="button" className="btn btn-primary" onClick={clearAll}>
                  Clear the filters
                </button>
              )}
              <div className="suggestions">
                <p className="muted small">Popular searches</p>
                <ul>
                  {POPULAR_SEARCHES.map((term) => (
                    <li key={term}>
                      <Link to={`/shop?q=${encodeURIComponent(term)}`}>{term}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="model-grid">
              {results.map((result) => (
                <ModelCard key={result.model.id} result={result} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
