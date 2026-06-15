import { Link } from 'react-router-dom';
import { useStore } from '../store/context';
import { useData } from '../store/dataContext';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const { wishlist } = useStore();
  const { products } = useData();
  const wished = products.filter((p) => wishlist.includes(p.id));

  if (wished.length === 0) {
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
        {wished.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
