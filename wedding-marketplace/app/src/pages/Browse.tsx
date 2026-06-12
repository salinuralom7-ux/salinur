import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, type Category, type Vendor } from '../types';
import { listApprovedVendors } from '../lib/api';
import VendorCard from '../components/VendorCard';

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') as Category | null) ?? undefined;
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Debounce typing so connected mode doesn't query per keystroke.
    const timer = setTimeout(() => {
      listApprovedVendors({ category, city: city || undefined, q: q || undefined })
        .then((v) => { setVendors(v); setError(''); })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load vendors'))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [category, city, q]);

  return (
    <div className="container">
      <h1>Find wedding vendors</h1>
      <div className="filter-bar">
        <input placeholder="Search name or service…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input placeholder="City (e.g. Bongaigaon)" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="cat-chips">
        <button className={!category ? 'active' : ''} onClick={() => { params.delete('category'); setParams(params); }}>All</button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={category === c.id ? 'active' : ''}
            onClick={() => { params.set('category', c.id); setParams(params); }}
          >
            {c.ico} {c.label}
          </button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      {loading ? (
        <p className="muted">Loading vendors…</p>
      ) : vendors.length === 0 ? (
        <p className="muted">No vendors match — try another category or city. New vendors join daily.</p>
      ) : (
        <div className="vendor-grid">
          {vendors.map((v) => <VendorCard key={v.id} vendor={v} />)}
        </div>
      )}
    </div>
  );
}
