import type { Vendor } from '../types';

export const SEED_VENDORS: Vendor[] = [
  {
    id: 'demo-vendor', businessName: 'Arjun Photography', category: 'photography', city: 'Bongaigaon',
    phone: '98640XXXXX', rating: 4.8, reviewCount: 42, status: 'approved', createdAt: '2026-01-10',
    bio: 'Candid wedding photography & cinematic films. 8 years of experience, 200+ weddings covered across Lower Assam.',
    packages: [
      { title: 'Basic — 1 day photo coverage', price: 25000 },
      { title: 'Standard — photo + video', price: 45000 },
      { title: 'Premium — 2 days, drone, album', price: 75000 },
    ],
    photos: [],
  },
  {
    id: 'v-kamrup', businessName: 'Kamrup Caterers', category: 'catering', city: 'Bongaigaon',
    phone: '98641XXXXX', rating: 4.6, reviewCount: 31, status: 'approved', createdAt: '2026-01-15',
    bio: 'Authentic Assamese and pan-Indian wedding menus. 100–2000 guests. Live counters available.',
    packages: [
      { title: 'Assamese thali — per plate', price: 350 },
      { title: 'Multi-cuisine — per plate', price: 550 },
      { title: 'Premium + live counters — per plate', price: 850 },
    ],
    photos: [],
  },
  {
    id: 'v-roselight', businessName: 'Roselight Decor', category: 'decor', city: 'Guwahati',
    phone: '98642XXXXX', rating: 4.7, reviewCount: 26, status: 'approved', createdAt: '2026-02-01',
    bio: 'Stage, mandap and full-venue floral decor. Traditional Assamese and modern themes.',
    packages: [
      { title: 'Stage + mandap decor', price: 40000 },
      { title: 'Full venue decor', price: 90000 },
      { title: 'Premium destination set-up', price: 180000 },
    ],
    photos: [],
  },
  {
    id: 'v-priyanka', businessName: 'Priyanka Makeovers', category: 'makeup', city: 'Bongaigaon',
    phone: '98643XXXXX', rating: 4.9, reviewCount: 58, status: 'approved', createdAt: '2026-02-10',
    bio: 'Bridal HD & airbrush makeup. Trials available. Travels across the Northeast.',
    packages: [
      { title: 'Bridal makeup', price: 8000 },
      { title: 'Bride + 2 family members', price: 14000 },
      { title: 'Full family package', price: 25000 },
    ],
    photos: [],
  },
  {
    id: 'v-brahmaputra', businessName: 'Brahmaputra Banquets', category: 'venue', city: 'Bongaigaon',
    phone: '98644XXXXX', rating: 4.5, reviewCount: 19, status: 'approved', createdAt: '2026-03-01',
    bio: 'AC banquet hall with 500 capacity, parking for 100 cars, in-house generator backup.',
    packages: [
      { title: 'Hall only — 1 day', price: 60000 },
      { title: 'Hall + basic decor', price: 95000 },
      { title: 'Hall + decor + guest rooms', price: 140000 },
    ],
    photos: [],
  },
  {
    id: 'v-axombeats', businessName: 'DJ Axom Beats', category: 'music', city: 'Guwahati',
    phone: '98645XXXXX', rating: 4.4, reviewCount: 22, status: 'approved', createdAt: '2026-03-12',
    bio: 'Bihu + Bollywood + EDM. Full sound & light rig, traditional dhol players on request.',
    packages: [
      { title: 'DJ night — 4 hours', price: 15000 },
      { title: 'DJ + lights + LED wall', price: 28000 },
      { title: 'Full sangeet production', price: 50000 },
    ],
    photos: [],
  },
];
