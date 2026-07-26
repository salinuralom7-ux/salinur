import type { ColorOption } from '../types';

/**
 * Manufacturer colour names mapped to the closest sRGB value we can print on a
 * swatch. Two-tone and gradient finishes carry a second hex.
 *
 * Names here must match the strings used in the catalog exactly. Anything not
 * listed falls back to a deterministic grey so a typo degrades into a dull
 * swatch rather than a crash.
 */
const PALETTE: Record<string, string | [string, string]> = {
  // ---- Apple ----------------------------------------------------------------
  'Jet Black': '#0b0b0d',
  'Space Grey': '#53565a',
  'Space Black': '#26282b',
  Graphite: '#54524f',
  Midnight: '#1f2937',
  Starlight: '#f0e9dd',
  Silver: '#e3e4e6',
  Gold: '#f6e2c4',
  'Rose Gold': '#eec2ba',
  '(PRODUCT)RED': '#bf0a1f',
  'Midnight Green': '#4e5851',
  'Pacific Blue': '#2d4e63',
  'Sierra Blue': '#a7c5dd',
  'Alpine Green': '#495c4c',
  'Deep Purple': '#584c5d',
  'Black Titanium': '#3b3b3d',
  'White Titanium': '#f2f1ed',
  'Blue Titanium': '#3f4a58',
  'Natural Titanium': '#9a938c',
  'Desert Titanium': '#bfa48f',
  Ultramarine: '#5a68d8',
  Teal: '#8bb9bd',
  'Cosmic Orange': '#e0662a',
  'Deep Blue': '#2a3d63',
  'Mist Blue': '#c5d3e0',
  Lavender: '#d7cbe6',
  Sage: '#c3ceb8',
  'Cloud White': '#f4f2ef',
  'Light Gold': '#e7d3ae',
  'Sky Blue': '#bdd4e7',
  Coral: '#f4776a',

  // ---- Common single words --------------------------------------------------
  Black: '#1b1c1e',
  White: '#f3f4f6',
  Blue: '#2f5fd0',
  Green: '#3f8f5c',
  Red: '#c62828',
  Yellow: '#f2cd4d',
  Pink: '#f0b8c4',
  Purple: '#7c5bbd',
  Grey: '#7a7d82',
  Cream: '#efe6d6',
  Titanium: '#9c9691',
  Bronze: '#a9764f',
  Orange: '#e8702a',

  // ---- Samsung --------------------------------------------------------------
  'Phantom Black': '#1c1c1e',
  'Phantom Silver': '#d9dade',
  'Phantom Violet': '#8b7fae',
  'Cream White': '#f2ece1',
  'Awesome Black': '#232326',
  'Awesome Blue': '#4a6ea8',
  'Awesome White': '#f1f2f4',
  'Awesome Violet': '#8f7fbc',
  'Awesome Mint': '#b7d9c6',
  'Awesome Graphite': '#4b4d52',
  'Awesome Lime': '#c9d96a',
  'Awesome Peach': '#f3c4ad',
  'Awesome Iceblue': '#c9dbe8',
  'Awesome Navy': '#2d3a52',
  'Mystic Bronze': '#8f7660',
  'Mystic Blue': '#4a6684',
  'Mystic Green': '#5c7a63',
  'Cloud Navy': '#2f3a52',
  'Cloud Lavender': '#cdc0e0',
  'Cloud Mint': '#bfe0cd',
  'Cloud Pink': '#f2c8d2',
  'Titanium Gray': '#7f8286',
  'Titanium Black': '#33343a',
  'Titanium Violet': '#9f93bd',
  'Titanium Yellow': '#e5d08b',
  'Titanium Silverblue': '#b8c6d4',
  'Titanium Whitesilver': '#e8e9ec',
  Graygreen: '#7d8a7d',
  Mint: '#b6ddc6',
  Navy: '#26344e',
  'Burgundy Red': '#7d2436',
  'Ocean Blue': '#2f6d92',
  Lime: '#c4d95f',
  Peach: '#f5c8ae',

  // ---- Xiaomi, Redmi, Poco --------------------------------------------------
  'Midnight Black': '#1a1b1f',
  'Glacier Blue': '#b9d5e3',
  'Sunset Orange': '#e8703a',
  'Aurora Green': '#4fa07a',
  'Carbon Black': '#232427',
  'Cool Blue': '#3e6fb3',
  'Pearl White': '#f0f1f3',
  'Nebula Purple': '#6f5aa8',
  'Astral Black': '#1d1e22',
  'Peach Fuzz': '#f6c6ac',
  'Aqua Blue': '#5ba7c8',
  'Coral Green': '#5eb59a',
  'Onyx Gray': '#3d3f44',
  'Titan Black': '#212227',
  'Starlit Blue': '#4a6fa8',
  'Frosted Blue': '#c4d9e8',
  'Chrome Silver': '#d5d8dc',
  'Cosmic Purple': '#6c5896',

  // ---- OnePlus --------------------------------------------------------------
  'Sierra Black': '#242528',
  'Marble Odyssey': ['#e8e2d8', '#b9b2a6'],
  'Flowy Emerald': '#2f7a63',
  'Silky Black': '#1e1f23',
  'Eternal Green': '#2d6b52',
  'Glacial Blue': '#b6d4e2',
  'Soft Jade': '#a8cbc0',
  'Astral Trail': '#5e6b7a',
  'Nebula Green': '#3f8a6d',
  'Pale Green': '#c2ddc9',
  'Emerald Forest': '#276b53',
  'Sunset Dune': '#d8a06a',
  'Morning Mist': '#d5dbe0',
  'Sandstone Black': '#2b2a28',

  // ---- Realme, iQOO, Vivo, Oppo --------------------------------------------
  'Rushing Blue': '#2f5fbf',
  'Forest Green': '#39734f',
  'Sunrise Beige': '#e6d5bd',
  'Submarine Blue': '#2b4f7a',
  'Legendary Black': '#1c1d21',
  'Racing Yellow': '#f0c94b',
  'Monet Purple': '#9a86c6',
  'Alpine White': '#f1f1ee',
  'Legend Silver': '#dcdfe3',
  'Volcano Orange': '#e2652c',
  'Nardo Grey': '#a4a8ad',
  'Sailing Blue': '#3a6ea8',
  'Stellar Green': '#3d8a6a',
  'Meteor Grey': '#54575d',
  'Glaze Green': '#7fbfa0',
  'Twilight Blue': '#3b4c7a',
  'Dawn Gold': '#e6c99a',
  'Aurora Blue': '#4a86c4',
  'Starry Black': '#1b1c20',
  'Glory Gold': '#e4c58f',
  'Pearl Pink': '#f3c9d3',
  'Ocean Green': '#3f9a86',
  'Cloud Purple': '#b6a6d8',
  'Icy Blue': '#c2dcea',

  // ---- Google, Nothing, Motorola, Asus, Nokia -------------------------------
  Obsidian: '#232527',
  Snow: '#f2f3f4',
  Hazel: '#8c8878',
  Bay: '#5b7fa8',
  Porcelain: '#efe9df',
  Charcoal: '#2f3134',
  'Sorta Sunny': '#f5d78f',
  'Kinda Coral': '#f2836e',
  'Stormy Black': '#1e2023',
  'Sea Green': '#7fb59b',
  Wintergreen: '#b6d4bc',
  Peony: '#f4b8c4',
  Aloe: '#b8d1a8',
  Iris: '#8b8fd0',
  Lemongrass: '#dfe0a8',
  'Dark Grey': '#3a3c40',
  'Viva Magenta': '#a5304a',
  'Pantone Aqua Foam': '#9fd4c4',
  'Nordic Blue': '#3f5f8a',
  'Polar Night': '#22252a',
  'Meteor Black': '#212227',
  'Storm White': '#eef0f2',
  'Velvet Red': '#8f2436',
  'Midnight Blue': '#1f3557',

  // ---- Remaining catalog finishes -------------------------------------------
  'Amber Yellow': '#e8c86a',
  'Andaman Blue': '#33628f',
  'Arctic Dawn': '#dfe6ec',
  'Arctic White': '#f2f4f6',
  'Aurora Purple': '#7a5fa8',
  'Awesome Lemon': '#e8dd7a',
  'Awesome Lilac': '#c4b0dd',
  'Black Beauty': '#1a1b1e',
  'Black Eclipse': '#16171a',
  'Blue Black': '#232a33',
  'Classic Black': '#1c1d20',
  'Cobalt Violet': '#8d86d4',
  'Conqueror Black': '#1b1c1f',
  'Coral Purple': '#a87f96',
  'Cosmos Black': '#17181c',
  'Daybreak Blue': '#5b8ec4',
  'Fiery Red': '#c33a2e',
  'Flora Green': '#5c9c73',
  'Fluid Silver': '#dadde1',
  'Frosted Green': '#b9d6c2',
  Icyblue: '#c6dae8',
  'Iron Gray': '#4c4f55',
  'Jade Green': '#4e8f74',
  'Lavender Mist': '#d3c8e4',
  Legend: ['#f0f1f3', '#2f5fbf'],
  'Luxe Lavender': '#c9b8dd',
  'Marble Grey': '#c9c9cc',
  'Marshmallow Blue': '#7fa8d4',
  'Matte Black': '#1f2023',
  'Mercurial Silver': '#d8dbdf',
  'Midnight Ocean': '#1f3a52',
  'Moonlight Blue': '#4a6f9c',
  'Moonlight Pearl': '#ece7de',
  'Mystic White': '#eef0f2',
  'Mystique Blue': '#3d5f8f',
  'Natural Green': '#5f8a6b',
  'Navigator Beige': '#ddcdb4',
  'Nebula Silver': '#d2d6db',
  'Oasis Green': '#6fae8f',
  'Obsidian Midnight': '#1b1d21',
  Olive: '#7d8258',
  'Onyx Black': '#1d1e21',
  'Peacock Green': '#2f7d6f',
  'Phantom Grey': '#5a5c60',
  'Phantom Navy': '#2b3a52',
  'Phantom Pink': '#f0c9cf',
  'Phantom Purple': '#6b5a94',
  'Phantom White': '#f0f1f3',
  'Razor Green': '#4fa06a',
  Rose: '#e8b4bc',
  'Rose Quartz': '#f0cfd2',
  'Silver Shadow': '#c6c9cd',
  'Spectre Blue': '#3a5f9c',
  'Sunset Gold': '#e5c48f',
  'Thunder Grey': '#4a4d52',
};

const FALLBACK = '#8a8d92';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(product\)/g, 'product-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const cache = new Map<string, ColorOption>();

/** Resolve a manufacturer colour name into a swatch. Results are memoised. */
export function color(name: string): ColorOption {
  const cached = cache.get(name);
  if (cached) return cached;

  const entry = PALETTE[name];
  const option: ColorOption = Array.isArray(entry)
    ? { id: slugify(name), name, hex: entry[0], hex2: entry[1] }
    : { id: slugify(name), name, hex: entry ?? FALLBACK };

  cache.set(name, option);
  return option;
}

export function colorById(name: string): string {
  return slugify(name);
}

/** True when a swatch needs light text drawn over it. */
export function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}
