import { Link } from 'react-router-dom';
import type { Condition } from '../types';
import { CONDITIONS } from '../data/conditions';

export default function ConditionBadge({
  condition,
  size = 'md',
  asLink = false,
}: {
  condition: Condition;
  size?: 'sm' | 'md';
  asLink?: boolean;
}) {
  const info = CONDITIONS[condition];
  const style = { '--badge': info.color } as React.CSSProperties;
  const className = `condition-badge condition-badge-${size}`;

  if (asLink) {
    return (
      <Link to={`/condition/${condition}`} className={className} style={style}>
        {info.name}
      </Link>
    );
  }

  return (
    <span className={className} style={style}>
      {info.name}
    </span>
  );
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="stars" title={`${rating} out of 5`}>
      <span aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={rounded >= i ? 'star full' : rounded >= i - 0.5 ? 'star half' : 'star'}>
            ★
          </span>
        ))}
      </span>
      <span className="stars-value">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="stars-count">({count})</span>}
    </span>
  );
}
