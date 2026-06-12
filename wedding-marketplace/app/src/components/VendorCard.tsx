import { Link } from 'react-router-dom';
import { catIco, catLabel, inr, type Vendor } from '../types';

const COLORS: Record<string, string> = {
  photography: '#7c2d5d', catering: '#9a6a14', decor: '#9c3b54', makeup: '#b54a7e',
  venue: '#3f5e78', music: '#5b3d8f', mehndi: '#7a5230', other: '#566061',
};

export default function VendorCard({ vendor }: { vendor: Vendor }) {
  const from = vendor.packages.length ? Math.min(...vendor.packages.map((p) => p.price)) : 0;
  return (
    <Link to={`/vendor/${vendor.id}`} className="vendor-card">
      <div className="vendor-avatar" style={{ background: COLORS[vendor.category] ?? '#566061' }}>
        {vendor.photos[0]
          ? <img src={vendor.photos[0]} alt={vendor.businessName} />
          : catIco(vendor.category)}
      </div>
      <div className="vendor-card-info">
        <strong>{vendor.businessName}</strong>
        <span className="muted">{catLabel(vendor.category)} · 📍 {vendor.city}</span>
        <span className="stars">
          {'★'.repeat(Math.round(vendor.rating))}{'☆'.repeat(5 - Math.round(vendor.rating))}
          <em>{vendor.rating > 0 ? `${vendor.rating} (${vendor.reviewCount})` : 'New'}</em>
        </span>
        {from > 0 && <span className="from-price">from {inr(from)}</span>}
      </div>
    </Link>
  );
}
