import type { Grade, GradeInfo } from '../types';

export const GRADES: Record<Grade, GradeInfo> = {
  A: {
    grade: 'A',
    name: 'Like New / Super Quality',
    label: 'Unboxed Like New',
    color: '#16a34a',
    warrantyMonths: 12,
    warrantyNote: '12-month warranty',
    discountRange: '25–35% off MRP',
    description:
      'Phones still under brand warranty or recently purchased. Zero to minimal cosmetic damage, original accessories included, and every hardware function works perfectly.',
    points: [
      'Original accessories included (charger, cable, manual)',
      'No visible scratches or dents',
      'Battery health 95%+',
      'Display perfect — no dead pixels or burn-in',
      'All hardware functions perfectly (camera, speakers, sensors)',
    ],
  },
  B: {
    grade: 'B',
    name: 'Great Quality — Minimal/No Repairs',
    label: 'Excellent Condition',
    color: '#2563eb',
    warrantyMonths: 6,
    warrantyNote: '6-month warranty',
    discountRange: '35–45% off MRP',
    description:
      'Phones used 1–2 years max. Never repaired or only minor cosmetic repairs. Minor scratches visible under light, but no dents — all functions perfect.',
    points: [
      'Used 1–2 years max',
      'Never repaired, or only minor cosmetic repairs',
      'Minor scratches visible under light, no dents',
      'Battery health 85–95%',
      'Mostly original accessories (may include compatible charger)',
    ],
  },
  C: {
    grade: 'C',
    name: 'Repaired But Excellent',
    label: 'Very Good Condition',
    color: '#ca8a04',
    warrantyMonths: 6,
    warrantyNote: '6-month warranty',
    discountRange: '45–55% off MRP',
    description:
      'Used 2–3 years, fully functional. Professionally repaired with no major parts replaced. Visible wear and tear, but every part works.',
    points: [
      'Used 2–3 years, fully functional',
      'Professionally repaired (no major parts replaced)',
      'Visible wear, scratches, minor dents',
      'Battery health 75–85%',
      'Compatible accessories included',
    ],
  },
  D: {
    grade: 'D',
    name: 'Repaired With Major Parts Replaced',
    label: 'Good Condition — Major Repairs',
    color: '#ea580c',
    warrantyMonths: 3,
    warrantyNote: '3-month warranty',
    discountRange: '55–65% off MRP',
    description:
      'Used 3+ years with major parts replaced (display, battery, or logic board). Fully functional but shows its age.',
    points: [
      'Used 3+ years',
      'Major parts replaced (display, battery, or board)',
      'Visible scratches, dents, cosmetic wear',
      'Battery health 60–75% (or recently replaced)',
      'Aftermarket/compatible accessories',
    ],
  },
  E: {
    grade: 'E',
    name: 'Needs Repair',
    label: 'Fair Condition — For Repair/Parts',
    color: '#dc2626',
    warrantyMonths: 1,
    warrantyNote: '1-month repair warranty only',
    discountRange: '65–75% off MRP',
    description:
      'Requires repair before use (charging issue, display glitch, etc.). Heavy cosmetic damage. Functions impaired but fixable — sold at clearance pricing with full honesty.',
    points: [
      'Requires repair before use',
      'Heavy cosmetic damage',
      'Battery health below 60% or non-functional',
      'Functions impaired but fixable',
      'No accessories included',
    ],
  },
};

export const GRADE_LIST: GradeInfo[] = Object.values(GRADES);

export const QUALITY_CHECKS: { area: string; items: string[] }[] = [
  { area: 'Display', items: ['Brightness', 'Colour accuracy', 'Touch response', 'Dead pixel scan'] },
  { area: 'Battery', items: ['Health %', 'Charging speed', 'Capacity test'] },
  { area: 'Camera', items: ['Focus', 'Image quality', 'Video recording', 'Night mode'] },
  { area: 'Audio', items: ['Speaker', 'Microphone', 'Earphone jack (if applicable)'] },
  { area: 'Hardware', items: ['Buttons', 'Ports', 'Vibration', 'Fingerprint / Face unlock'] },
  { area: 'Software', items: ['OS version', 'App compatibility', 'Malware-free check'] },
  { area: 'Thermal', items: ['Temperature under load'] },
  { area: 'Integrity', items: ['Water damage indicators', 'All sensors calibrated', 'Factory reset done'] },
];
