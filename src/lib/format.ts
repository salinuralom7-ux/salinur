const RUPEES = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹41,900 — Indian digit grouping, no paise. */
export function inr(amount: number): string {
  return RUPEES.format(Math.round(amount));
}

/** 41,900 without the symbol, for use next to an explicit ₹ in the markup. */
export function num(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(amount));
}

export function percentOff(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** 'in 4 months' / '2 months ago', used for warranty expiry. */
export function relativeMonths(from: string, months: number): { expiry: Date; expired: boolean; label: string } {
  const expiry = new Date(from);
  expiry.setMonth(expiry.getMonth() + months);
  const now = new Date();
  const expired = expiry.getTime() < now.getTime();
  const days = Math.round(Math.abs(expiry.getTime() - now.getTime()) / 86400000);

  let label: string;
  if (days < 45) label = `${days} day${days === 1 ? '' : 's'}`;
  else label = `${Math.round(days / 30)} months`;

  return { expiry, expired, label: expired ? `expired ${label} ago` : `${label} remaining` };
}
