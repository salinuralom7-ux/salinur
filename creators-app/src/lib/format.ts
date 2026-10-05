/** Display helpers so every number on the site reads the same way. */

/** 950 → "950", 12_400 → "12.4K", 1_250_000 → "1.3M". */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1_000) return String(Math.round(n));
  const units: [number, string][] = [
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "K"],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      // One decimal under 100 (12.4K), none above (240K); never "12.0K".
      const s = v < 100 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v).toString();
      return `${s}${suffix}`;
    }
  }
  return String(n);
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 1500 → "₹1,500", 150000 → "₹1,50,000" (Indian grouping). */
export function formatINR(n: number): string {
  return `₹${inr.format(Math.round(n))}`;
}

/** "₹1,500/reel" style rate label. */
export function formatRate(n: number, unit: string): string {
  return `${formatINR(n)}/${unit}`;
}
