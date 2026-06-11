import type { Product } from '../types';
import PhoneImage from './PhoneImage';

// Shows the first uploaded photo; falls back to the generated illustration
// for listings that don't have real photos yet.
export default function ProductImage({ product, large = false }: { product: Product; large?: boolean }) {
  const src = product.images?.[0];
  if (src) {
    const size = large ? 280 : 150;
    return (
      <img
        src={src}
        alt={`${product.brand} ${product.model}`}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 8 }}
        loading="lazy"
      />
    );
  }
  return <PhoneImage product={product} large={large} />;
}
