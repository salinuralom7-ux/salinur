import type { Product } from '../types';

// SVG illustration stand-in until real product photos are uploaded.
export default function PhoneImage({ product, large = false }: { product: Product; large?: boolean }) {
  const size = large ? 280 : 150;
  if (product.category === 'accessory') {
    return (
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={product.model}>
        <rect x="20" y="30" width="80" height="60" rx="10" fill={product.colorHex} stroke="#94a3b8" strokeWidth="2" />
        <rect x="35" y="45" width="50" height="8" rx="4" fill="rgba(0,0,0,0.15)" />
        <rect x="35" y="60" width="34" height="8" rx="4" fill="rgba(0,0,0,0.15)" />
        <circle cx="92" cy="38" r="5" fill="#f59e0b" />
      </svg>
    );
  }
  const dark = isDark(product.colorHex);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${product.brand} ${product.model}`}>
      <rect x="38" y="8" width="44" height="104" rx="9" fill={product.colorHex} stroke={dark ? '#475569' : '#94a3b8'} strokeWidth="2" />
      <rect x="42" y="14" width="36" height="86" rx="4" fill={dark ? '#0f172a' : '#1e293b'} />
      <rect x="46" y="20" width="28" height="20" rx="2" fill="url(#screenGlow)" opacity="0.5" />
      <circle cx="60" cy="106" r="3" fill={dark ? '#64748b' : '#cbd5e1'} />
      <rect x="54" y="16" width="12" height="3" rx="1.5" fill={dark ? '#334155' : '#475569'} />
      <circle cx="48" cy="28" r="4" fill="#334155" stroke="#64748b" strokeWidth="1" />
      <defs>
        <linearGradient id="screenGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
