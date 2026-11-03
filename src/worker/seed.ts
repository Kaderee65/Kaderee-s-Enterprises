import type { Category, ProductOption } from '../data/types'

export interface SeedProduct {
  slug: string
  name: string
  price: number
  compareAt?: number
  category: Category
  image: string
  badge?: string
  short: string
  description: string
  details: string[]
  materials: string
  options?: ProductOption
  stock: number
  featured: boolean
}

// The catalogue a fresh database starts with. Once the store is running the
// admin panel edits the `products` table and this list is never read again.
export const seedProducts: SeedProduct[] = [
  {
    slug: 'kitenge-map-big',
    name: 'Kitenge Map Tote — Big',
    price: 4500,
    compareAt: 5200,
    category: 'kitenge-map-big',
    image: '/images/kitenge-map-big.svg',
    badge: 'Bestseller',
    short: 'Large kitenge tote, fits a 15" laptop',
    description:
      'Our biggest map tote, cut from a full length of kitenge and lined in cotton canvas. Wide enough for a laptop, a file and a water bottle, with a zip closure and an inside pocket so nothing disappears on the matatu.',
    details: ['42 × 32 × 14 cm', 'Fits a 15" laptop', 'Zip closure with leather pull', 'One inside zip pocket, two slip pockets'],
    materials: 'Cotton kitenge outer, cotton canvas lining, leather handles and base.',
    options: { name: 'Print', values: ['Blue', 'Red', 'Green'] },
    stock: 12,
    featured: true,
  },
  {
    slug: 'kitenge-map-medium',
    name: 'Kitenge Map Tote — Medium',
    price: 3500,
    category: 'kitenge-map-medium',
    image: '/images/kitenge-map-medium.svg',
    badge: 'New',
    short: 'Medium kitenge tote, everyday size',
    description:
      'The size most people carry daily: a phone, a purse, a notebook and a shawl fit comfortably, and the bag still sits flat under your arm. Same kitenge and canvas lining as the big map, a little less bulk.',
    details: ['32 × 24 × 11 cm', 'Zip closure', 'Inside slip pocket', 'Shoulder straps with a 28 cm drop'],
    materials: 'Cotton kitenge outer, cotton canvas lining, leather straps.',
    options: { name: 'Print', values: ['Blue', 'Red', 'Green'] },
    stock: 16,
    featured: true,
  },
  {
    slug: 'kitenge-kichwa-big',
    name: 'Kitenge Kichwa — Big',
    price: 4200,
    category: 'kitenge-kichwa-big',
    image: '/images/kitenge-kichwa-big.svg',
    short: 'Structured kitenge bag, holds its shape',
    description:
      'A rounded, structured bag that stands on its own — cut with a stiffened base and a firm top edge so it keeps its shape whether it is full or empty. Roomy enough for a day out, smart enough for a meeting.',
    details: ['36 × 28 × 15 cm', 'Stands upright on a stiffened base', 'Zip closure', 'Detachable shoulder strap'],
    materials: 'Cotton kitenge over a firm interfacing, cotton lining, leather trim.',
    options: { name: 'Print', values: ['Blue', 'Purple', 'Green'] },
    stock: 9,
    featured: true,
  },
  {
    slug: 'kitenge-kichwa-medium',
    name: 'Kitenge Kichwa — Medium',
    price: 3200,
    category: 'kitenge-kichwa-medium',
    image: '/images/kitenge-kichwa-medium.svg',
    short: 'Medium structured kitenge bag',
    description:
      'A lighter version of the big kichwa: the same firm shape, a shorter handle and just enough room for the essentials plus a paperback. The print is cut so the pattern sits straight on the front panel.',
    details: ['28 × 22 × 12 cm', 'Structured top edge', 'Zip closure', 'Short handles, 18 cm drop'],
    materials: 'Cotton kitenge over a firm interfacing, cotton lining, leather handles.',
    options: { name: 'Print', values: ['Blue', 'Red', 'Purple'] },
    stock: 14,
    featured: false,
  },
  {
    slug: 'kitenge-small-crossbody',
    name: 'Kitenge Small Crossbody',
    price: 1900,
    category: 'kitenge-small',
    image: '/images/kitenge-small.svg',
    badge: 'Bestseller',
    short: 'Small kitenge bag, hands free',
    description:
      'A small crossbody for when you only want your phone, cards and keys. The strap adjusts from crossbody to shoulder with one pull, and the flap closes with a hidden magnetic snap.',
    details: ['20 × 15 × 7 cm', 'Adjustable strap, 60–120 cm', 'Magnetic flap closure', 'Two card slots inside'],
    materials: 'Cotton kitenge outer, cotton lining, leather strap.',
    options: { name: 'Print', values: ['Blue', 'Red', 'Green', 'Purple'] },
    stock: 22,
    featured: true,
  },
  {
    slug: 'kitenge-small-clutch',
    name: 'Kitenge Small Clutch',
    price: 1600,
    category: 'kitenge-small',
    image: '/images/kitenge-small.svg',
    short: 'Flat kitenge clutch for evenings',
    description:
      'A flat clutch in a single panel of kitenge, lined and stiffened so it holds a clean line under your arm. Carries a phone, a small purse and a lipstick; the wrist strap tucks inside when you would rather hold it.',
    details: ['26 × 15 cm', 'Detachable wrist strap', 'Zip closure', 'Cotton lining'],
    materials: 'Cotton kitenge over firm interfacing, cotton lining.',
    options: { name: 'Print', values: ['Blue', 'Red', 'Gold'] },
    stock: 6,
    featured: false,
  },
  {
    slug: 'tot-bag-classic',
    name: 'Classic Tot Bag',
    price: 2400,
    compareAt: 2800,
    category: 'tot-bags',
    image: '/images/tot-bag.svg',
    short: 'Plain canvas tote, leather handles',
    description:
      'A plain, sturdy tot bag for the days you do not want a pattern — heavy cotton canvas, leather handles and a base that holds its shape when you set it down.',
    details: ['38 × 30 × 12 cm', 'Open top with a magnetic clasp', 'Inside pocket', 'Leather handles, 25 cm drop'],
    materials: 'Heavy cotton canvas, leather handles and base, cotton lining.',
    options: { name: 'Colour', values: ['Natural', 'Black', 'Olive'] },
    stock: 18,
    featured: true,
  },
  {
    slug: 'tot-bag-canvas',
    name: 'Canvas Tot Bag',
    price: 2000,
    category: 'tot-bags',
    image: '/images/tot-bag.svg',
    short: 'Light canvas tote, everyday',
    description:
      'The light one: soft washed canvas that folds flat into another bag when you are not using it, and opens wide when you are. Good for the market, the office or the beach.',
    details: ['34 × 28 × 10 cm', 'Machine washable, cold', 'Two inside slip pockets', 'Folds flat'],
    materials: 'Washed cotton canvas, cotton lining, webbing handles.',
    options: { name: 'Colour', values: ['Natural', 'Sand', 'Charcoal'] },
    stock: 20,
    featured: false,
  },
]
