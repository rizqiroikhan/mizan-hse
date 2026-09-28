export const ROLES = ['staff', 'manager', 'supervisor', 'management'] as const;
export type Role = (typeof ROLES)[number];

export const SITES = [
  { id: 'dukuh', name: 'JPM Dukuh Atas', city: 'Jakarta', code: 'JPM' },
  { id: 'sentral', name: 'Sentral Office', city: 'Jakarta', code: 'SNT' },
  { id: 'depot', name: 'East Operations Depot', city: 'Bekasi', code: 'EOD' },
];

const P3K: [string, number][] = [
  ['Kasa steril terbungkus', 20],
  ['Perban 5 cm', 2],
  ['Perban 10 cm', 2],
  ['Plester 1,25 cm', 2],
  ['Plester cepat', 10],
  ['Kapas 25 gram', 1],
  ['Kain segitiga / mittela', 2],
  ['Gunting', 1],
  ['Peniti', 12],
  ['Sarung tangan sekali pakai', 2],
  ['Masker', 2],
  ['Pinset', 1],
  ['Lampu senter', 1],
  ['Gelas untuk cuci mata', 1],
  ['Kantong plastik bersih', 1],
  ['NaCl', 1],
  ['Povidone', 1],
  ['Alkohol 70%', 1],
  ['Buku panduan P3K', 1],
  ['Buku catatan', 1],
  ['Daftar isi kotak', 1],
];

function item(id: string, label: string, extra: Record<string, unknown> = {}) {
  return { id, label, ...extra };
}

export const TEMPLATES = {
  APAR: {
    version: 1,
    name: 'APAR inspection',
    description: 'Monthly visual inspection · technical servicing is separate',
    items: [
      item('presence', 'Present at the registered location'),
      item('access', 'Accessible and unobstructed'),
      item('sign', 'Equipment ID and location sign visible'),
      item('label', 'Operating instructions readable and facing outward'),
      item('cylinder', 'Cylinder free from visible damage, corrosion and leakage'),
      item('handle', 'Handle and lever visibly undamaged'),
      item('seal', 'Safety pin and tamper seal intact'),
      item('hose', 'Hose / nozzle / horn intact and unobstructed'),
      item('gauge', 'Pressure within manufacturer operating range', { conditional: 'gauge' }),
      item('mount', 'Bracket or cabinet secure and accessible'),
      item('service', 'Required service and testing up to date'),
      item('weight', 'CO₂ weight meets equipment-specific criteria', { conditional: 'co2' }),
    ],
  },
  Hydrant: {
    version: 1,
    name: 'Hydrant inspection',
    description: 'Monthly condition check · 6 components',
    items: [
      item('box', 'Box hydrant'),
      item('hose', 'Fire hose'),
      item('coupling', 'Hose coupling'),
      item('rack', 'Hose rack'),
      item('nozzle', 'Nozzle'),
      item('valve', 'Valve / pillar hydrant'),
    ],
  },
  P3K: {
    version: 1,
    name: 'P3K inventory check',
    description: 'Monthly inventory · 21 supplies',
    items: P3K.map(([label, qty], i) =>
      item(`p3k_${i + 1}`, label, { required: qty, expiry: [0, 15, 16, 17].includes(i) }),
    ),
  },
  Patrol: {
    version: 1,
    name: 'Safety patrol',
    description: 'Proposed baseline checklist · plus free-form observations',
    items: [
      item('access', 'Emergency equipment accessible'),
      item('exits', 'Escape routes and exits clear'),
      item('housekeeping', 'Housekeeping / 5R satisfactory'),
      item('electrical', 'No visible unsafe cables or electrical conditions'),
      item('waste', 'Waste stored in the designated area'),
      item('signage', 'Safety signs visible and legible'),
    ],
  },
} as const;

export type InspectionType = keyof typeof TEMPLATES;
export const INSPECTION_TYPES = Object.keys(TEMPLATES) as InspectionType[];
