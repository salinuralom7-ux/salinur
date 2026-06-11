export default function Stars({ rating, count }: { rating: number; count?: number }) {
  const full = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      <span className="stars-icons">
        {'★'.repeat(full)}
        {'☆'.repeat(5 - full)}
      </span>
      <span className="stars-num">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="stars-count">({count})</span>}
    </span>
  );
}
