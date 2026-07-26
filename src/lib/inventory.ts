import type { Condition, Listing, PhoneModel, Review } from '../types';
import { CONDITIONS, CONDITION_IDS } from '../data/conditions';
import { MODELS, MODELS_BY_ID } from '../data/catalog';
import { color } from '../data/colors';

/**
 * Stock is generated rather than typed out by hand. A second-hand shop's shelf
 * is the cross product of model × storage × colour × condition, which runs to
 * tens of thousands of rows; writing them out would be unreadable and would go
 * stale the moment a price moved.
 *
 * Everything below is derived from a stable hash of the configuration, so the
 * same phone always carries the same battery figure, the same unit reference
 * and the same stock count on every device and every reload. Replace this
 * module with a fetch against real inventory when the backend exists — nothing
 * outside it knows how listings are produced.
 */

/** FNV-1a. Small, fast, and stable across platforms. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic value in [0, 1) derived from a seed string. */
function rand(seed: string): number {
  return hash(seed) / 0x100000000;
}

function randInt(seed: string, min: number, max: number): number {
  return min + Math.floor(rand(seed) * (max - min + 1));
}

function pick<T>(seed: string, options: readonly T[]): T {
  return options[Math.floor(rand(seed) * options.length)];
}

const CURRENT_YEAR = 2026;

/**
 * How many units of a configuration sit on the shelf. Newer and more popular
 * phones turn over faster and are stocked deeper; the oldest handsets in the
 * worst conditions are often simply absent.
 */
function stockFor(model: PhoneModel, seed: string, condition: Condition): number {
  const age = CURRENT_YEAR - model.year;
  const roll = rand(seed + ':stock');

  // Older stock is scarcer, and Superb examples of old phones barely exist.
  let availability = age <= 1 ? 0.55 : age <= 3 ? 0.72 : age <= 5 ? 0.66 : 0.5;
  if (condition === 'superb') availability -= age * 0.07;
  if (condition === 'moderate' && age < 2) availability -= 0.25;

  if (roll > availability) return 0;
  return randInt(seed + ':qty', 1, age <= 2 ? 3 : 5);
}

const REPAIR_NOTES: Record<Condition, string[]> = {
  superb: [],
  excellent: [],
  good: [
    'Battery replaced with a certified cell in our workshop',
    'Display assembly replaced with an OEM-grade panel',
    'Charging port cleaned and re-seated',
    'No repairs — wear is cosmetic only',
  ],
  moderate: [
    'Display and battery both replaced with OEM-grade parts',
    'Battery replaced; back glass chipped and left as is',
    'Rear camera glass replaced, lens itself untouched',
    'Charging port replaced with an OEM-grade part',
    'Frame straightened after a drop; all seals re-checked',
  ],
};

const COSMETIC_NOTES: Record<Condition, string[]> = {
  superb: [
    'No marks anywhere on the body or glass under shop lighting.',
    'Presents as an unopened handset. Screen protector and case were on it from day one.',
    'Flawless front and back. Original owner kept it in a folio case throughout.',
  ],
  excellent: [
    'Two hairline marks on the frame, visible only when tilted against a lamp. Glass is clean.',
    'One faint scuff near the charging port. Nothing on the display or the back panel.',
    'Light polishing marks on the rear glass. Frame and screen are unmarked.',
  ],
  good: [
    'Scratches along the left edge and a small dent at the lower-right corner. Display is clear.',
    'Visible wear around all four corners with light scuffing on the back. Screen is unmarked.',
    'Several fine scratches across the rear glass and worn paint on the frame edges.',
  ],
  moderate: [
    'Deep scratches on the back glass and worn edges on three corners. Fully functional.',
    'Hairline crack in the top-left of the back panel, not spreading. Display and frame are sound.',
    'Heavy scuffing on the frame and a visible dent on the top edge. Everything works.',
  ],
};

function conditionNotes(seed: string, condition: Condition): string {
  return pick(seed + ':cosmetic', COSMETIC_NOTES[condition]);
}

function repairs(seed: string, condition: Condition): string | undefined {
  const options = REPAIR_NOTES[condition];
  if (options.length === 0) return undefined;
  const note = pick(seed + ':repair', options);
  return note.startsWith('No repairs') ? undefined : note;
}

function accessoriesFor(model: PhoneModel, condition: Condition): string[] {
  const usbC =
    model.brand !== 'Apple' ||
    ['iphone-15', 'iphone-15-plus', 'iphone-15-pro', 'iphone-15-pro-max'].includes(model.id) ||
    model.year >= 2024;
  const cable = model.brand === 'Apple' && !usbC ? 'Lightning cable' : 'USB-C cable';

  if (condition === 'superb') {
    return ['Original box', 'Original charger', `Original ${cable}`, 'SIM tray tool', 'Documentation'];
  }
  if (condition === 'excellent') {
    return ['Certified charger', `Certified ${cable}`, 'Protective case'];
  }
  return ['Certified charger', `Certified ${cable}`];
}

function ratingFor(seed: string, condition: Condition): { rating: number; reviewCount: number } {
  const base = { superb: 4.8, excellent: 4.7, good: 4.5, moderate: 4.2 }[condition];
  const jitter = (randInt(seed + ':rating', 0, 2) - 1) / 10;
  return {
    rating: Math.min(5, Math.round((base + jitter) * 10) / 10),
    reviewCount: randInt(seed + ':reviews', 6, 90),
  };
}

/** Human-readable shelf reference, e.g. 'BPS-4F2A9C'. */
function unitRefFor(seed: string): string {
  return 'BPS-' + hash(seed).toString(16).toUpperCase().padStart(8, '0').slice(-6);
}

function priceFor(referencePrice: number, condition: Condition): number {
  const raw = referencePrice * CONDITIONS[condition].priceFactor;
  // Round to the nearest ₹100 so the shelf never shows an odd figure.
  return Math.round(raw / 100) * 100;
}

function batteryFor(seed: string, model: PhoneModel, condition: Condition): number {
  const [low, high] = CONDITIONS[condition].batteryRange;
  const age = CURRENT_YEAR - model.year;
  // Older handsets sit toward the bottom of their band.
  const span = high - low;
  const drift = Math.min(span - 1, Math.floor(age / 3));
  return randInt(seed + ':battery', low, high - drift);
}

function buildListing(
  model: PhoneModel,
  storageGb: number,
  mrp: number,
  referencePrice: number,
  colorName: string,
  condition: Condition,
): Listing | null {
  const id = `${model.id}--${storageGb}--${color(colorName).id}--${condition}`;
  const stock = stockFor(model, id, condition);
  if (stock === 0) return null;

  const { rating, reviewCount } = ratingFor(id, condition);

  return {
    id,
    modelId: model.id,
    brand: model.brand,
    model: model.name,
    series: model.series,
    year: model.year,
    storageGb,
    color: color(colorName),
    condition,
    mrp,
    price: priceFor(referencePrice, condition),
    batteryHealth: batteryFor(id, model, condition),
    stock,
    warrantyMonths: CONDITIONS[condition].warrantyMonths,
    rating,
    reviewCount,
    conditionNotes: conditionNotes(id, condition),
    repairs: repairs(id, condition),
    accessories: accessoriesFor(model, condition),
    ram: model.ram,
    fiveG: model.fiveG,
    unitRef: unitRefFor(id),
  };
}

/** Every listing currently on the shelf. Built once, on first access. */
export const LISTINGS: Listing[] = (() => {
  const out: Listing[] = [];
  for (const model of MODELS) {
    for (const [gb, mrp, reference] of model.storage) {
      for (const colorName of model.colors) {
        for (const condition of CONDITION_IDS) {
          const listing = buildListing(model, gb, mrp, reference, colorName, condition);
          if (listing) out.push(listing);
        }
      }
    }
  }
  return out;
})();

export const LISTINGS_BY_ID: Map<string, Listing> = new Map(LISTINGS.map((l) => [l.id, l]));

export function getListing(id: string): Listing | undefined {
  return LISTINGS_BY_ID.get(id);
}

const BY_MODEL = (() => {
  const map = new Map<string, Listing[]>();
  for (const listing of LISTINGS) {
    const bucket = map.get(listing.modelId);
    if (bucket) bucket.push(listing);
    else map.set(listing.modelId, [listing]);
  }
  return map;
})();

export function listingsForModel(modelId: string): Listing[] {
  return BY_MODEL.get(modelId) ?? [];
}

export function getModel(modelId: string): PhoneModel | undefined {
  return MODELS_BY_ID.get(modelId);
}

/** The cheapest in-stock listing for a model — what the grid shows as "from". */
export function cheapestForModel(modelId: string): Listing | undefined {
  const all = listingsForModel(modelId);
  if (all.length === 0) return undefined;
  return all.reduce((best, l) => (l.price < best.price ? l : best));
}

/** Models that have at least one listing in stock, in catalog order. */
export const STOCKED_MODELS: PhoneModel[] = MODELS.filter((m) => listingsForModel(m.id).length > 0);

/** Full title as shown on cards, in the cart and on invoices. */
export function listingTitle(listing: Listing): string {
  return `${listing.model} · ${formatStorage(listing.storageGb)} · ${listing.color.name}`;
}

export function formatStorage(gb: number): string {
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

// ---------------------------------------------------------------------------
// Customer reviews
// ---------------------------------------------------------------------------

const REVIEW_AUTHORS = [
  'Rakesh D.',
  'Nabanita S.',
  'Imran H.',
  'Priyanka B.',
  'Jitul K.',
  'Farhana A.',
  'Sanjib R.',
  'Mridul G.',
  'Anamika C.',
  'Bhaskar T.',
  'Ruksana B.',
  'Dipankar N.',
];

const REVIEW_CITIES = [
  'Bongaigaon',
  'Guwahati',
  'Barpeta',
  'Goalpara',
  'Kokrajhar',
  'Dhubri',
  'Nalbari',
  'Rangia',
];

const REVIEW_TEXT: Record<Condition, string[]> = {
  superb: [
    'Could not tell it apart from a new one. Box, charger, everything was there and the battery reads 100%.',
    'Delivered in two days to Bongaigaon. Genuinely spotless — my brother refused to believe it was second-hand.',
    'Paid a bit more for Superb and it was worth it. Not one mark on the phone.',
  ],
  excellent: [
    'Tiny mark on the side exactly as they described in the listing. Everything else is perfect.',
    'Battery health showed 92%, matching the listing. Honest people, no surprises.',
    'Looks brand new in a case. The photos they sent on WhatsApp before I paid were the actual phone.',
  ],
  good: [
    'Scratches are visible but the phone works flawlessly and the price was unbeatable.',
    'They had replaced the battery and told me so upfront. Lasts all day.',
    'Exactly as listed — some wear on the frame, screen is clean. Six-month warranty is reassuring.',
  ],
  moderate: [
    'Cosmetically rough, as promised, but it runs perfectly. Half the price of the same phone in Good.',
    'The dent was in the photos they sent me before I paid, so no complaints at all. Great value.',
    'Bought it as a spare phone. Does everything I need and the price was very fair.',
  ],
};

/** Reviews are derived from the model id so they stay consistent between visits. */
export function reviewsForModel(modelId: string): Review[] {
  const listings = listingsForModel(modelId);
  if (listings.length === 0) return [];

  const conditions = [...new Set(listings.map((l) => l.condition))];
  const count = randInt(modelId + ':reviewcount', 3, 6);
  const out: Review[] = [];

  for (let i = 0; i < count; i++) {
    const seed = `${modelId}:review:${i}`;
    const condition = pick(seed + ':cond', conditions);
    const daysAgo = randInt(seed + ':when', 4, 400);
    const date = new Date(Date.UTC(2026, 6, 26) - daysAgo * 86400000);

    out.push({
      modelId,
      author: pick(seed + ':who', REVIEW_AUTHORS),
      city: pick(seed + ':city', REVIEW_CITIES),
      rating: randInt(seed + ':stars', 4, 5),
      condition,
      verified: rand(seed + ':verified') > 0.2,
      text: pick(seed + ':text', REVIEW_TEXT[condition]),
      date: date.toISOString().slice(0, 10),
    });
  }

  return out.sort((a, b) => b.date.localeCompare(a.date));
}
