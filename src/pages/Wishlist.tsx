import { Link } from 'react-router-dom';
import { useStore } from '../store/context';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const { wishlist, products: allProducts } = useStore();
  const products = allProducts.filter((p) => wishlist.includes(p.id));

  if (products.length === 0) {
    return (
      <div className="container empty-state">
        <h1>Your wishlist is empty</h1>
        <p className="muted">Tap the ♡ on any product to save it here. We'll show you when wishlisted items are back in stock.</p>
        <Link to="/shop" className="btn btn-primary btn-lg">Shop Phones</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Wishlist</h1>
      <div className="product-grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
