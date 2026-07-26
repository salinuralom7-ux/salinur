import type { Condition, Listing, PhoneModel } from '../types';
import { CONDITIONS } from '../data/conditions';
import { listingsForModel, STOCKED_MODELS, formatStorage } from './inventory';
import { percentOff } from './format';

/**
 * The shop grid works in models, not listings — a customer looks for "iPhone 13",
 * not for one of the ninety-odd colour, capacity and condition combinations of
 * it that we happen to have on the shelf. Filters are applied to the underlying
 * listings, and a model survives if any of its listings survive.
 */

export interface Filters {
  query: string;
  brands: string[];
  conditions: Condition[];
  storages: number[];
  minPrice?: number;
  maxPrice?: number;
  fiveGOnly: boolean;
}

export type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating' | 'saving';

export const EMPTY_FILTERS: Filters = {
  query: '',
  brands: [],
  conditions: [],
  storages: [],
  fiveGOnly: false,
};

export interface Result {
  model: PhoneModel;
  /** Listings of this model that survived the filters. */
  matches: Listing[];
  /** Cheapest surviving listing — the price shown on the card. */
  cheapest: Listing;
  /** Conditions available among the surviving listings, best first. */
  conditions: Condition[];
  score: number;
}

/** Everything a listing can be matched against, lowercased once per listing. */
function haystack(model: PhoneModel, listing: Listing): string {
  return [
    model.brand,
    model.name,
    model.series,
    listing.color.name,
    formatStorage(listing.storageGb),
    `${listing.storageGb}gb`,
    CONDITIONS[listing.condition].name,
    listing.ram,
    model.fiveG ? '5g' : '4g',
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Scores a model against the search terms. Every term must appear somewhere,
 * which keeps "iphone 13 blue" from returning every blue phone in the shop.
 */
function scoreModel(model: PhoneModel, listings: Listing[], terms: string[]): number {
  if (terms.length === 0) return 1;

  const modelText = `${model.brand} ${model.name} ${model.series}`.toLowerCase();
  const listingText = listings.map((l) => haystack(model, l)).join(' | ');

  let score = 0;
  for (const term of terms) {
    if (!listingText.includes(term)) return 0;

    if (modelText === term) score += 100;
    else if (modelText.startsWith(term)) score += 40;
    else if (modelText.includes(term)) score += 20;
    else score += 5;
  }

  // Prefer an exact whole-name hit over a longer model that merely contains it,
  // so searching "iPhone 13" puts the 13 above the 13 Pro Max.
  const joined = terms.join(' ');
  if (model.name.toLowerCase() === joined) score += 200;
  else if (`${model.brand} ${model.name}`.toLowerCase() === joined) score += 200;

  return score;
}

function matchesFilters(listing: Listing, filters: Filters): boolean {
  if (filters.brands.length > 0 && !filters.brands.includes(listing.brand)) return false;
  if (filters.conditions.length > 0 && !filters.conditions.includes(listing.condition)) return false;
  if (filters.storages.length > 0 && !filters.storages.includes(listing.storageGb)) return false;
  if (filters.minPrice !== undefined && listing.price < filters.minPrice) return false;
  if (filters.maxPrice !== undefined && listing.price > filters.maxPrice) return false;
  if (filters.fiveGOnly && !listing.fiveG) return false;
  return true;
}

export function search(filters: Filters, sort: SortKey = 'relevance'): Result[] {
  const terms = filters.query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const results: Result[] = [];

  for (const model of STOCKED_MODELS) {
    const matches = listingsForModel(model.id).filter((l) => matchesFilters(l, filters));
    if (matches.length === 0) continue;

    const score = scoreModel(model, matches, terms);
    if (score === 0) continue;

    const cheapest = matches.reduce((best, l) => (l.price < best.price ? l : best));
    const conditions = [...new Set(matches.map((l) => l.condition))].sort(
      (a, b) => CONDITIONS[a].rank - CONDITIONS[b].rank,
    );

    results.push({ model, matches, cheapest, conditions, score });
  }

  return sortResults(results, sort);
}

function sortResults(results: Result[], sort: SortKey): Result[] {
  const byName = (a: Result, b: Result) => a.model.name.localeCompare(b.model.name);

  switch (sort) {
    case 'price-asc':
      return results.sort((a, b) => a.cheapest.price - b.cheapest.price || byName(a, b));
    case 'price-desc':
      return results.sort((a, b) => b.cheapest.price - a.cheapest.price || byName(a, b));
    case 'newest':
      return results.sort((a, b) => b.model.year - a.model.year || byName(a, b));
    case 'rating':
      return results.sort((a, b) => b.cheapest.rating - a.cheapest.rating || byName(a, b));
    case 'saving':
      return results.sort(
        (a, b) =>
          percentOff(b.cheapest.mrp, b.cheapest.price) - percentOff(a.cheapest.mrp, a.cheapest.price) ||
          byName(a, b),
      );
    default:
      return results.sort((a, b) => b.score - a.score || b.model.year - a.model.year || byName(a, b));
  }
}

/** Storage capacities present anywhere in the catalog, for the filter panel. */
export const ALL_STORAGES: number[] = [
  ...new Set(STOCKED_MODELS.flatMap((m) => m.storage.map(([gb]) => gb))),
].sort((a, b) => a - b);

/** Search suggestions shown under the search box before anything is typed. */
export const POPULAR_SEARCHES = [
  'iPhone 13',
  'iPhone 11',
  'Galaxy S23 Ultra',
  'iPhone 15 Pro',
  'Pixel 8a',
  'OnePlus 12R',
  'Redmi Note 13 Pro',
  'iPhone 16',
];
