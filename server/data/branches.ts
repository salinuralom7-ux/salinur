import type { Branch } from '../../src/types';

/**
 * Canonical branch records — the source of truth that seeds the database.
 * Edit here (and re-seed) to add, remove or update stores.
 *
 * `phone`    — tel-dialable, keep the country code (+91…).
 * `whatsapp` — digits only (no +, spaces or dashes) for wa.me links.
 * `mapUrl`   — a Google Maps share link for the branch.
 *
 * The phone numbers and street addresses below are placeholders — replace
 * them with the real branch details before going live.
 */
export const BRANCH_SEED: Branch[] = [
  {
    id: 'assam',
    name: 'Phone Factory Assam',
    city: 'Assam',
    area: 'Flagship Store',
    address: 'Phone Factory Assam, Main Road, Assam',
    phone: '+919876500001',
    whatsapp: '919876500001',
    hours: 'Mon–Sat 10:00 AM – 8:00 PM · Sun 11:00 AM – 6:00 PM',
    mapUrl: 'https://maps.google.com/?q=Phone+Factory+Assam',
    landmark: 'Flagship / head office',
  },
  {
    id: 'kokrajhar',
    name: 'Phone Factory Kokrajhar',
    city: 'Kokrajhar',
    area: 'Town Centre',
    address: 'Phone Factory Kokrajhar, Station Road, Kokrajhar, Assam 783370',
    phone: '+919876500002',
    whatsapp: '919876500002',
    hours: 'Mon–Sat 10:00 AM – 8:00 PM · Sun 11:00 AM – 5:00 PM',
    mapUrl: 'https://maps.google.com/?q=Kokrajhar+Assam',
    landmark: 'Near Kokrajhar main market',
  },
  {
    id: 'bongaigaon',
    name: 'Phone Factory Bongaigaon',
    city: 'Bongaigaon',
    area: 'Main Road',
    address: 'Phone Factory Bongaigaon, Barpara Main Road, Bongaigaon, Assam 783380',
    phone: '+919876500003',
    whatsapp: '919876500003',
    hours: 'Mon–Sat 10:00 AM – 8:00 PM · Sun 11:00 AM – 6:00 PM',
    mapUrl: 'https://maps.google.com/?q=Bongaigaon+Assam',
    landmark: 'Opposite SBI main branch',
  },
];
