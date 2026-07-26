import type { Condition, ConditionInfo } from '../types';

/**
 * The four condition tiers every handset is sold under. A phone is assigned its
 * tier only after the 40-point inspection, and the tier fixes the price, the
 * warranty and what goes in the box.
 */
export const CONDITIONS: Record<Condition, ConditionInfo> = {
  superb: {
    id: 'superb',
    name: 'Superb',
    headline: 'Indistinguishable from new',
    rank: 0,
    color: '#0f9d58',
    priceFactor: 1,
    warrantyMonths: 12,
    batteryRange: [95, 100],
    description:
      'Barely used handsets, most of them under a year old and many still inside the manufacturer warranty. Held at arm’s length under shop lights you will not find a mark on them.',
    points: [
      'No scratches, scuffs or dents anywhere on the body or glass',
      'Battery health 95% or above, verified on the device',
      'Display flawless — no burn-in, no dead pixels, no discolouration',
      'Never opened, never repaired, no parts replaced',
      'Original box and accessories included wherever the seller kept them',
    ],
    accessories: 'Original box, charger and cable',
  },
  excellent: {
    id: 'excellent',
    name: 'Excellent',
    headline: 'Light use, nothing you would notice',
    rank: 1,
    color: '#1a73e8',
    priceFactor: 0.89,
    warrantyMonths: 9,
    batteryRange: [88, 95],
    description:
      'One to two years of careful use, almost always in a case. Faint hairline marks show up if you tilt the phone against a light, and that is the whole story. Every function is perfect.',
    points: [
      'Hairline marks visible only at an angle under direct light',
      'Battery health 88–95%',
      'Display perfect — no marks in the viewing area',
      'Never repaired, or cosmetic work only',
      'Charger and cable included; original box not guaranteed',
    ],
    accessories: 'Charger and cable, tested and certified',
  },
  good: {
    id: 'good',
    name: 'Good',
    headline: 'Honest wear, faultless function',
    rank: 2,
    color: '#f29900',
    priceFactor: 0.78,
    warrantyMonths: 6,
    batteryRange: [80, 88],
    description:
      'Two to three years of real-world use. You will see scratches on the frame and possibly a small dent on a corner. Some units have had a screen or battery professionally replaced. Everything works exactly as it should.',
    points: [
      'Visible scratches on frame and back; small dents possible',
      'Battery health 80–88%, or a new battery already fitted',
      'Display fully functional, may carry light marks outside the active area',
      'Any repair carried out in our own workshop with graded parts',
      'Certified charger and cable included',
    ],
    accessories: 'Certified charger and cable',
  },
  moderate: {
    id: 'moderate',
    name: 'Moderate',
    headline: 'Well used, priced accordingly',
    rank: 3,
    color: '#d93025',
    priceFactor: 0.65,
    warrantyMonths: 3,
    batteryRange: [75, 82],
    description:
      'Three years and up, and it shows: deep scratches, dents, worn edges, sometimes a hairline crack in the back glass. We list every fault in writing before you buy. Mechanically sound, cosmetically tired, and the cheapest way into a good phone.',
    points: [
      'Deep scratches, dents and worn edges; back glass may be chipped',
      'Battery health 75–82%, or replaced with a certified cell',
      'Display works fully; light shadowing or edge marks possible',
      'Major parts such as display or battery may have been replaced',
      'Certified charger and cable included',
    ],
    accessories: 'Certified charger and cable',
  },
};

/** Best condition first — the order we show everywhere in the UI. */
export const CONDITION_LIST: ConditionInfo[] = [
  CONDITIONS.superb,
  CONDITIONS.excellent,
  CONDITIONS.good,
  CONDITIONS.moderate,
];

export const CONDITION_IDS: Condition[] = CONDITION_LIST.map((c) => c.id);

export function isCondition(value: string): value is Condition {
  return value in CONDITIONS;
}

/**
 * The inspection every handset goes through before it is graded and listed.
 * Shown in full on the product page so customers can see what "checked" means.
 */
export const INSPECTION: { area: string; items: string[] }[] = [
  {
    area: 'Display',
    items: [
      'Brightness at maximum',
      'Colour uniformity',
      'Touch response across the full panel',
      'Dead and stuck pixel scan',
      'Burn-in check on OLED panels',
      'Oleophobic coating',
    ],
  },
  {
    area: 'Battery and charging',
    items: [
      'Reported battery health',
      'Charge cycle count',
      'Wired charging rate',
      'Wireless charging where supported',
      'Drain test under load',
    ],
  },
  {
    area: 'Cameras',
    items: [
      'Rear autofocus on every lens',
      'Front camera focus',
      'Optical stabilisation',
      'Video recording at maximum resolution',
      'Flash output',
      'Lens glass inspection',
    ],
  },
  {
    area: 'Audio',
    items: ['Earpiece', 'Loudspeaker', 'Both microphones', 'Headphone jack where fitted'],
  },
  {
    area: 'Connectivity',
    items: [
      'SIM slots and eSIM',
      '4G and 5G band lock',
      'Wi-Fi 2.4 and 5 GHz',
      'Bluetooth pairing',
      'GPS lock',
      'NFC where fitted',
    ],
  },
  {
    area: 'Sensors and biometrics',
    items: [
      'Face unlock or fingerprint reader',
      'Proximity sensor',
      'Ambient light sensor',
      'Accelerometer and gyroscope',
      'Compass',
    ],
  },
  {
    area: 'Body and buttons',
    items: [
      'Power and volume keys',
      'Mute switch or alert slider',
      'Charging port continuity',
      'Vibration motor',
      'Frame and glass inspection under lamp',
    ],
  },
  {
    area: 'Ownership and safety',
    items: [
      'IMEI verified against national blacklist',
      'Activation lock removed (iCloud / Mi Account / Google FRP)',
      'Water damage indicators',
      'Factory reset and fresh OS install',
      'Malware scan',
    ],
  },
];

export const INSPECTION_POINT_COUNT = INSPECTION.reduce((n, g) => n + g.items.length, 0);
