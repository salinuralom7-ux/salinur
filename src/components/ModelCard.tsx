import { Link } from 'react-router-dom';
import type { Result } from '../lib/search';
import { CONDITIONS } from '../data/conditions';
import { formatStorage } from '../lib/inventory';
import { inr, percentOff } from '../lib/format';
import { useStore } from '../store/context';
import PhoneRender from './PhoneRender';
import { Stars } from './ConditionBadge';

/**
 * One card in the shop grid. It represents a model rather than a single unit,
 * because a model typically has twenty or more colour, capacity and condition
 * combinations in stock and listing them separately would be unusable.
 */
export default function ModelCard({ result }: { result: Result }) {
  const { model, cheapest, matches, conditions } = result;
  const { toggleWishlist, inWishlist } = useStore();

  const saved = percentOff(cheapest.mrp, cheapest.price);
  const storages = [...new Set(matches.map((l) => l.storageGb))].sort((a, b) => a - b);
  const colors = [...new Map(matches.map((l) => [l.color.id, l.color])).values()];
  const wished = inWishlist(cheapest.id);

  return (
    <article className="model-card">
      <button
        type="button"
        className={`wish-btn${wished ? ' is-on' : ''}`}
        onClick={() => toggleWishlist(cheapest.id)}
        aria-pressed={wished}
        aria-label={wished ? `Remove ${model.name} from saved` : `Save ${model.name}`}
      >
        {wished ? '♥' : '♡'}
      </button>

      <Link to={`/phone/${model.id}`} className="model-card-media">
        <PhoneRender listing={cheapest} />
        {saved > 0 && <span className="save-flag">{saved}% off</span>}
      </Link>

      <div className="model-card-body">
        <p className="model-card-brand">{model.brand}</p>
        <h3 className="model-card-name">
          <Link to={`/phone/${model.id}`}>{model.name}</Link>
        </h3>

        <Stars rating={cheapest.rating} count={cheapest.reviewCount} />

        <div className="model-card-price">
          <strong>{inr(cheapest.price)}</strong>
          <span className="mrp">{inr(cheapest.mrp)}</span>
        </div>
        <p className="model-card-from">
          from, in {CONDITIONS[cheapest.condition].name} · {formatStorage(cheapest.storageGb)}
        </p>

        <ul className="chip-row" aria-label="Conditions in stock">
          {conditions.map((c) => (
            <li key={c} className="chip" style={{ '--chip': CONDITIONS[c].color } as React.CSSProperties}>
              {CONDITIONS[c].name}
            </li>
          ))}
        </ul>

        <div className="model-card-meta">
          <span>{storages.map(formatStorage).join(' · ')}</span>
          <span className="swatch-row" aria-label={`${colors.length} colours available`}>
            {colors.slice(0, 6).map((c) => (
              <span
                key={c.id}
                className="swatch-dot"
                style={{ background: c.hex2 ? `linear-gradient(135deg, ${c.hex}, ${c.hex2})` : c.hex }}
                title={c.name}
              />
            ))}
            {colors.length > 6 && <span className="swatch-more">+{colors.length - 6}</span>}
          </span>
        </div>

        <Link to={`/phone/${model.id}`} className="btn btn-primary btn-block">
          View {matches.length} in stock
        </Link>
      </div>
    </article>
  );
}
