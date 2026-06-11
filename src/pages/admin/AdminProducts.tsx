import { useMemo, useState } from 'react';
import type { Grade, Product } from '../../types';
import { GRADES, GRADE_LIST } from '../../data/grades';
import { CATALOG_BRANDS, DEVICE_CATALOG, findDevice } from '../../data/deviceCatalog';
import { deleteProduct, saveProduct, uploadProductImage } from '../../lib/api';
import { formatINR, productTitle } from '../../data/products';
import { useStore } from '../../store/context';
import GradeBadge from '../../components/GradeBadge';
import ProductImage from '../../components/ProductImage';

const COLOR_FALLBACKS: Record<string, string> = {
  black: '#1f2430', midnight: '#1d2230', graphite: '#3a3d44', grey: '#6b7280', gray: '#6b7280',
  white: '#eceff3', starlight: '#e9e4da', silver: '#d4d8dd', cream: '#efe7d8',
  blue: '#3b6db5', navy: '#1e3a8a', green: '#3f7d4e', olive: '#7d8c5c', lime: '#b9d77e',
  red: '#c0392b', pink: '#e8a3b8', purple: '#9b8ec4', violet: '#9b8ec4', lavender: '#c3b6e0',
  yellow: '#e8c84a', gold: '#d4af6a', orange: '#e0863a', beige: '#d9c7a7', titanium: '#8a8d92',
};

function guessHex(color: string): string {
  const lower = color.toLowerCase();
  for (const [name, hex] of Object.entries(COLOR_FALLBACKS)) {
    if (lower.includes(name)) return hex;
  }
  return '#475569';
}

const EMPTY: Product = {
  id: 'new-product',
  brand: '', model: '', storage: '', ram: '', color: '', colorHex: '#475569',
  category: 'android', grade: 'B', mrp: 0, price: 0, batteryHealth: 90, stock: 1,
  rating: 0, reviewCount: 0, accessories: [], conditionNotes: '', hasVideo: false, specs: {},
};

export default function AdminProducts() {
  const { products, refreshProducts } = useStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const save = async (p: Product) => {
    setBusy(true);
    setError('');
    try {
      await saveProduct(p);
      await refreshProducts();
      setEditing(null);
      setNotice(p.id.startsWith('new-') ? 'Phone added to the store ✓' : 'Listing updated ✓');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`Remove "${productTitle(p)}" from the store?`)) return;
    setBusy(true);
    try {
      await deleteProduct(p.id);
      await refreshProducts();
      setNotice('Listing removed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <ProductForm
        initial={editing}
        busy={busy}
        error={error}
        onCancel={() => setEditing(null)}
        onSave={save}
      />
    );
  }

  return (
    <div>
      <div className="admin-toolbar">
        <button className="btn btn-buy btn-lg" onClick={() => { setNotice(''); setEditing(EMPTY); }}>
          + Add Phone / Accessory
        </button>
        <span className="muted">{products.length} listings</span>
      </div>
      {notice && <p className="promo-ok">{notice}</p>}
      {error && <p className="promo-err">{error}</p>}
      <div className="admin-list">
        {products.map((p) => (
          <div key={p.id} className="admin-row">
            <ProductImage product={p} />
            <div className="admin-row-info">
              <GradeBadge grade={p.grade} />
              <strong>{productTitle(p)}</strong>
              <span className="muted">
                {formatINR(p.price)} · stock {p.stock}
                {p.batteryHealth !== undefined && ` · battery ${p.batteryHealth}%`}
              </span>
            </div>
            <div className="admin-row-actions">
              <button className="btn btn-outline" onClick={() => { setNotice(''); setEditing(p); }}>Edit</button>
              <button className="link-btn danger" disabled={busy} onClick={() => remove(p)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductForm({
  initial, busy, error, onSave, onCancel,
}: {
  initial: Product;
  busy: boolean;
  error: string;
  onSave: (p: Product) => void;
  onCancel: () => void;
}) {
  const [p, setP] = useState<Product>(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const isNew = initial.id.startsWith('new-');

  const set = <K extends keyof Product>(key: K, value: Product[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const catalogModels = useMemo(
    () => DEVICE_CATALOG.filter((d) => !p.brand || d.brand === p.brand),
    [p.brand],
  );

  const applyCatalog = (brand: string, model: string) => {
    const dev = findDevice(brand, model);
    if (!dev) return;
    setP((prev) => ({
      ...prev,
      brand: dev.brand,
      model: dev.model,
      category: dev.category,
      mrp: dev.launchMrp,
      storage: dev.storageOptions[0],
      ram: dev.ramOptions[0],
      color: dev.colors[0],
      colorHex: guessHex(dev.colors[0]),
      specs: dev.specs,
    }));
  };

  const device = findDevice(p.brand, p.model);
  const gradeInfo = GRADES[p.grade];
  const suggestedPrice = p.mrp > 0 ? suggestPrice(p.mrp, p.grade) : null;

  const addImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        urls.push(await uploadProductImage(file));
      }
      setP((prev) => ({ ...prev, images: [...(prev.images ?? []), ...urls].slice(0, 8) }));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const valid = p.brand.trim() && p.model.trim() && p.price > 0 && p.mrp >= p.price && p.conditionNotes.trim();

  return (
    <div className="card">
      <h2>{isNew ? 'Add a phone or accessory' : 'Edit listing'}</h2>

      <h3 className="form-section">1. Pick the model (auto-fills the fixed specs)</h3>
      <div className="form-grid">
        <label>Brand
          <select value={CATALOG_BRANDS.includes(p.brand) ? p.brand : ''} onChange={(e) => set('brand', e.target.value)}>
            <option value="">— Choose or type below —</option>
            {CATALOG_BRANDS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label>Model from catalog
          <select
            value={device ? p.model : ''}
            onChange={(e) => e.target.value && applyCatalog(
              DEVICE_CATALOG.find((d) => d.model === e.target.value)!.brand,
              e.target.value,
            )}
          >
            <option value="">— Choose a model —</option>
            {catalogModels.map((d) => <option key={d.brand + d.model} value={d.model}>{d.brand} {d.model}</option>)}
          </select>
        </label>
        <label>Brand (custom)
          <input value={p.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Apple" />
        </label>
        <label>Model name (custom)
          <input value={p.model} onChange={(e) => set('model', e.target.value)} placeholder="e.g. iPhone 15" />
        </label>
        <label>Category
          <select value={p.category} onChange={(e) => set('category', e.target.value as Product['category'])}>
            <option value="iphone">iPhone</option>
            <option value="android">Android Phone</option>
            <option value="accessory">Accessory</option>
          </select>
        </label>
        <label>Storage
          {device ? (
            <select value={p.storage} onChange={(e) => set('storage', e.target.value)}>
              {device.storageOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <input value={p.storage ?? ''} onChange={(e) => set('storage', e.target.value)} placeholder="e.g. 128GB" />
          )}
        </label>
        <label>RAM
          {device ? (
            <select value={p.ram} onChange={(e) => set('ram', e.target.value)}>
              {device.ramOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <input value={p.ram ?? ''} onChange={(e) => set('ram', e.target.value)} placeholder="e.g. 6GB" />
          )}
        </label>
        <label>Colour
          {device ? (
            <select value={p.color} onChange={(e) => { set('color', e.target.value); set('colorHex', guessHex(e.target.value)); }}>
              {device.colors.map((c) => <option key={c}>{c}</option>)}
            </select>
          ) : (
            <input value={p.color} onChange={(e) => { set('color', e.target.value); set('colorHex', guessHex(e.target.value)); }} placeholder="e.g. Midnight" />
          )}
        </label>
      </div>
      {Object.keys(p.specs).length > 0 && (
        <p className="muted">✓ Specs auto-filled: {Object.entries(p.specs).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}…</p>
      )}

      <h3 className="form-section">2. Condition &amp; grade</h3>
      <div className="form-grid">
        <label>Grade
          <select value={p.grade} onChange={(e) => set('grade', e.target.value as Grade)}>
            {GRADE_LIST.map((g) => <option key={g.grade} value={g.grade}>Grade {g.grade} — {g.label}</option>)}
          </select>
        </label>
        <label>Battery health %
          <input
            type="number" min={0} max={100}
            value={p.batteryHealth ?? ''}
            onChange={(e) => set('batteryHealth', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </label>
        <label className="span2">Condition notes (shown to customers — be honest, this is your trust)
          <input
            value={p.conditionNotes}
            onChange={(e) => set('conditionNotes', e.target.value)}
            placeholder="e.g. Minor scratches visible under light, no dents. Single owner."
          />
        </label>
        <label className="span2">Repair history (leave empty if never repaired)
          <input
            value={p.repairs ?? ''}
            onChange={(e) => set('repairs', e.target.value || undefined)}
            placeholder="e.g. Battery replaced (new compatible part)"
          />
        </label>
        <label className="span2">Included accessories (comma-separated)
          <input
            value={p.accessories.join(', ')}
            onChange={(e) => set('accessories', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="e.g. Original 20W charger, USB-C cable, Box"
          />
        </label>
        <label>IMEI (kept for your records)
          <input value={p.imei ?? ''} onChange={(e) => set('imei', e.target.value || undefined)} />
        </label>
      </div>
      <p className="muted">Grade {p.grade}: {gradeInfo.warrantyNote} · typical pricing {gradeInfo.discountRange}</p>

      <h3 className="form-section">3. Price &amp; stock</h3>
      <div className="form-grid">
        <label>MRP (₹)
          <input type="number" min={0} value={p.mrp || ''} onChange={(e) => set('mrp', Number(e.target.value))} />
        </label>
        <label>Your selling price (₹)
          <input type="number" min={0} value={p.price || ''} onChange={(e) => set('price', Number(e.target.value))} />
        </label>
        <label>Units in stock
          <input type="number" min={0} value={p.stock} onChange={(e) => set('stock', Math.max(0, Number(e.target.value)))} />
        </label>
      </div>
      {suggestedPrice && (
        <p className="muted">
          💡 Suggested price for Grade {p.grade}: about {formatINR(suggestedPrice)}{' '}
          <button type="button" className="link-btn" onClick={() => set('price', suggestedPrice)}>use this</button>
        </p>
      )}

      <h3 className="form-section">4. Photos &amp; video</h3>
      <div className="image-strip">
        {(p.images ?? []).map((src, i) => (
          <div key={i} className="image-thumb">
            <img src={src} alt={`Photo ${i + 1}`} />
            <button
              type="button" className="link-btn danger"
              onClick={() => set('images', p.images!.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <label className="image-add">
          {uploading ? 'Uploading…' : '+ Add photos'}
          <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(e) => addImages(e.target.files)} />
        </label>
      </div>
      {uploadError && <p className="promo-err">{uploadError}</p>}
      <div className="form-grid">
        <label className="span2">Video link of this exact unit (YouTube link — optional but builds trust)
          <input
            value={p.videoUrl ?? ''}
            onChange={(e) => { set('videoUrl', e.target.value || undefined); set('hasVideo', !!e.target.value); }}
            placeholder="https://youtube.com/..."
          />
        </label>
      </div>

      <div className="step-nav">
        <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-buy btn-lg" disabled={!valid || busy} onClick={() => onSave(p)}>
          {busy ? 'Saving…' : isNew ? 'Add to Store' : 'Save Changes'}
        </button>
      </div>
      {!valid && <p className="muted">Required: brand, model, price (≤ MRP) and condition notes.</p>}
      {error && <p className="promo-err">{error}</p>}
    </div>
  );
}

// Midpoint of the grade's discount band, rounded to a clean ₹99 ending.
function suggestPrice(mrp: number, grade: Grade): number {
  const mid: Record<Grade, number> = { A: 0.7, B: 0.6, C: 0.5, D: 0.4, E: 0.3 };
  const raw = mrp * mid[grade];
  return Math.max(Math.round(raw / 100) * 100 - 1, 99);
}
