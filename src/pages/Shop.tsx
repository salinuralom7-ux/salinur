import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productTitle } from '../data/products';
import { GRADE_LIST } from '../data/grades';
import type { Grade } from '../types';
import { useStore } from '../store/context';
import ProductCard from '../components/ProductCard';

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'rating' | 'popular';

export default function Shop() {
  const { products: PRODUCTS, productsLoading } = useStore();
  const BRANDS = useMemo(() => [...new Set(PRODUCTS.map((p) => p.brand))].sort(), [PRODUCTS]);
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').toLowerCase();
  const gradeParam = params.get('grade') as Grade | null;
  const categoryParam = params.get('category');

  const [grades, setGrades] = useState<Grade[]>(gradeParam ? [gradeParam] : []);
  const [brands, setBrands] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(150000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('popular');

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const results = useMemo(() => {
    let list = PRODUCTS.filter((p) => {
      if (categoryParam && p.category !== categoryParam) return false;
      if (grades.length > 0 && !grades.includes(p.grade)) return false;
      if (brands.length > 0 && !brands.includes(p.brand)) return false;
      if (p.price > maxPrice) return false;
      if (inStockOnly && p.stock === 0) return false;
      if (query) {
        const haystack = `${productTitle(p)} ${p.brand} ${p.model} ${p.storage ?? ''} ${p.color} grade ${p.grade}`.toLowerCase();
        if (!query.split(/\s+/).every((term) => haystack.includes(term))) return false;
      }
      return true;
    });
    switch (sort) {
      case 'price-asc': list = [...list].sort((a, b) => a.price - b.price); break;
      case 'price-desc': list = [...list].sort((a, b) => b.price - a.price); break;
      case 'rating': list = [...list].sort((a, b) => b.rating - a.rating); break;
      case 'popular': list = [...list].sort((a, b) => b.reviewCount - a.reviewCount); break;
      case 'newest': break; // listing order = newest first
    }
    return list;
  }, [PRODUCTS, query, categoryParam, grades, brands, maxPrice, inStockOnly, sort]);

  return (
    <div className="container shop-layout">
      <aside className="filters">
        <h3>Filters</h3>

        <div className="filter-group">
          <h4>Grade</h4>
          {GRADE_LIST.map((g) => (
            <label key={g.grade}>
              <input
                type="checkbox"
                checked={grades.includes(g.grade)}
                onChange={() => toggle(grades, g.grade, setGrades)}
              />
              <span className="grade-dot" style={{ backgroundColor: g.color }} /> Grade {g.grade} — {g.label}
            </label>
          ))}
        </div>

        <div className="filter-group">
          <h4>Brand</h4>
          {BRANDS.map((b) => (
            <label key={b}>
              <input type="checkbox" checked={brands.includes(b)} onChange={() => toggle(brands, b, setBrands)} />
              {b}
            </label>
          ))}
        </div>

        <div className="filter-group">
          <h4>Max Price: ₹{maxPrice.toLocaleString('en-IN')}</h4>
          <input
            type="range"
            min={500}
            max={150000}
            step={1000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </div>

        <div className="filter-group">
          <label>
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            In stock only
          </label>
        </div>

        <div className="filter-group">
          <h4>Category</h4>
          <label>
            <input type="radio" name="cat" checked={!categoryParam} onChange={() => { params.delete('category'); setParams(params); }} />
            All
          </label>
          <label>
            <input type="radio" name="cat" checked={categoryParam === 'iphone'} onChange={() => { params.set('category', 'iphone'); setParams(params); }} />
            iPhones
          </label>
          <label>
            <input type="radio" name="cat" checked={categoryParam === 'android'} onChange={() => { params.set('category', 'android'); setParams(params); }} />
            Android Phones
          </label>
          <label>
            <input type="radio" name="cat" checked={categoryParam === 'accessory'} onChange={() => { params.set('category', 'accessory'); setParams(params); }} />
            Accessories
          </label>
        </div>
      </aside>

      <section className="shop-results">
        <div className="shop-toolbar">
          <span>
            {results.length} result{results.length !== 1 && 's'}
            {query && <> for “{params.get('q')}”</>}
          </span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
            <option value="popular">Most Popular</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Best Rating</option>
          </select>
        </div>
        {productsLoading ? (
          <p className="muted">Loading products…</p>
        ) : results.length === 0 ? (
          <p className="muted">No products match your filters. Try removing some filters or searching for a different model.</p>
        ) : (
          <div className="product-grid">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
