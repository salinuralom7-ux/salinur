import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { discountPct, formatINR, productTitle } from '../data/products';
import { useStore } from '../store/context';
import GradeBadge from './GradeBadge';
import ProductImage from './ProductImage';
import Stars from './Stars';

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const wished = wishlist.includes(product.id);
  const out = product.stock === 0;

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
          <ProductImage product={product} />
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
        {product.stock > 0 && product.stock <= 3 && (
          <div className="stock-warn">Only {product.stock} left in stock</div>
        )}
        {out && <div className="stock-out">Out of stock</div>}
      </Link>
      <button className="btn btn-primary btn-block" disabled={out} onClick={() => addToCart(product.id)}>
        {out ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  );
}
