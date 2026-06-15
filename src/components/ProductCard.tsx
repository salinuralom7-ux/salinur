import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { discountPct, formatINR, productTitle } from '../data/products';
import { otherBranchesWithStock, stockAt, whatsappLink } from '../data/branches';
import { useStore } from '../store/context';
import GradeBadge from './GradeBadge';
import PhoneImage from './PhoneImage';
import Stars from './Stars';

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, wishlist, branchId, branch } = useStore();
  const wished = wishlist.includes(product.id);
  const stock = stockAt(product, branchId);
  const out = stock === 0;
  const elsewhere = out ? otherBranchesWithStock(product, branchId) : [];

  return (
    <div className="product-card">
      <button
        className={`wish-btn ${wished ? 'wished' : ''}`}
        onClick={() => toggleWishlist(product.id)}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {wished ? '♥' : '♡'}
      </button>
      <Link to={`/product/${product.id}`} className="product-card-link">
        <div className="product-card-img">
          <PhoneImage product={product} />
          {product.hasVideo && <span className="video-tag">▶ Watch before you buy</span>}
        </div>
        <GradeBadge grade={product.grade} />
        <h3 className="product-card-title">{productTitle(product)}</h3>
        <Stars rating={product.rating} count={product.reviewCount} />
        <div className="price-row">
          <span className="price">{formatINR(product.price)}</span>
          <span className="mrp">{formatINR(product.mrp)}</span>
          <span className="discount">{discountPct(product)}% off</span>
        </div>
        {stock > 0 && stock <= 3 && (
          <div className="stock-warn">Only {stock} left{branch ? ` at ${branch.city}` : ''}</div>
        )}
        {out && (
          <div className="stock-out">
            Out of stock{branch ? ` at ${branch.city}` : ''}
            {elsewhere.length > 0 && (
              <span className="stock-elsewhere"> · available at {elsewhere.map((b) => b.city).join(', ')}</span>
            )}
          </div>
        )}
      </Link>
      {out && branch ? (
        <a
          className="btn btn-whatsapp btn-block"
          href={whatsappLink(branch, `Hi ${branch.name}, do you have the ${productTitle(product)} (Grade ${product.grade}) in stock?`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          💬 Enquire on WhatsApp
        </a>
      ) : (
        <button className="btn btn-primary btn-block" disabled={out} onClick={() => addToCart(product.id)}>
          {out ? 'Out of Stock' : 'Add to Cart'}
        </button>
      )}
    </div>
  );
}
