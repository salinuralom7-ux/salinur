import type { Branch } from '../../src/types';

/**
 * Canonical branch records — the source of truth that seeds the database.
 * Edit here (and re-seed) to add, remove or update stores.
 *
 * `phone`    — tel-dialable, keep the country code (+91…).
 * `whatsapp` — digits only (no +, spaces or dashes) for wa.me links.
 * `mapUrl`   — a Google Maps share link for the branch.
 *
 * The numbers below are placeholders — replace them with real branch
 * phone/WhatsApp numbers before going live.
 */
export const BRANCH_SEED: Branch[] = [
  {
    id: 'bongaigaon',
    name: 'Budget Phone Store — Bongaigaon (Main)',
    city: 'Bongaigaon',
    area: 'Main Branch',
    address: 'Barpara Main Road, near Ganesh Mandir, Bongaigaon, Assam 783380',
    phone: '+919876500001',
    whatsapp: '919876500001',
    hours: 'Mon–Sat 10:00 AM – 8:00 PM · Sun 11:00 AM – 6:00 PM',
    mapUrl: 'https://maps.google.com/?q=Bongaigaon+Assam',
    landmark: 'Opposite SBI main branch',
  },
  {
    id: 'guwahati',
    name: 'Budget Phone Store — Guwahati',
    city: 'Guwahati',
    area: 'Fancy Bazar',
    address: 'HB Road, Fancy Bazar, Guwahati, Assam 781001',
    phone: '+919876500002',
    whatsapp: '919876500002',
    hours: 'Mon–Sat 10:30 AM – 8:30 PM · Sun closed',
    mapUrl: 'https://maps.google.com/?q=Fancy+Bazar+Guwahati+Assam',
    landmark: 'Near Fancy Bazar bus stop',
  },
  {
    id: 'barpeta',
    name: 'Budget Phone Store — Barpeta Road',
    city: 'Barpeta Road',
    area: 'Town Centre',
    address: 'Station Road, Barpeta Road, Assam 781315',
    phone: '+919876500003',
    whatsapp: '919876500003',
    hours: 'Mon–Sat 10:00 AM – 7:30 PM · Sun 11:00 AM – 5:00 PM',
    mapUrl: 'https://maps.google.com/?q=Barpeta+Road+Assam',
    landmark: 'Beside the railway station gate',
  },
];
