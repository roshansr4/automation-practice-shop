// Deterministic product catalogue used to seed the database.
// Kept in one place so the data set is identical on every machine, which
// matters when your automated tests assert on counts, prices or ordering.

export const CATEGORIES = [
  { slug: 'laptops', name: 'Laptops' },
  { slug: 'phones', name: 'Phones' },
  { slug: 'audio', name: 'Audio' },
  { slug: 'wearables', name: 'Wearables' },
  { slug: 'cameras', name: 'Cameras' },
  { slug: 'accessories', name: 'Accessories' }
];

export const BRANDS = ['Nordvik', 'Kestrel', 'Auralis', 'Pinemark', 'Vertex', 'Lumira'];

const MODELS = {
  laptops: ['Studio 14', 'Studio 16 Pro', 'Traveller Air', 'Workbench X', 'Slate Ultra'],
  phones: ['Pulse 7', 'Pulse 7 Pro', 'Mini 5', 'Edge Max', 'Core Lite'],
  audio: ['Halo Over-Ear', 'Halo Buds', 'Rumble Speaker', 'Session Mic', 'Drift ANC'],
  wearables: ['Track Band', 'Chrono Watch', 'Chrono Watch SE', 'Focus Ring', 'Pace GPS'],
  cameras: ['Frame One', 'Frame One Kit', 'Pocket Action', 'Lens 35mm', 'Gimbal Duo'],
  accessories: ['Braided Cable', 'Fast Charger 65W', 'Laptop Sleeve', 'Desk Hub 8-in-1', 'Travel Pouch']
};

const COLOURS = ['#2f6f4e', '#3a5a8c', '#8c4b3a', '#5b4b8a', '#2b6b7a', '#7a5c2b'];

// Small linear congruential generator so the seed data never shifts around.
function makeRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const DESCRIPTION_PARTS = [
  'Built for people who move between the desk, the train and the sofa without noticing the difference.',
  'A quiet, understated design that survives a rucksack and still looks presentable in a meeting.',
  'Two years of firmware support, a replaceable battery and a repair manual you can actually download.',
  'Tuned in a small studio outside Gothenburg, then re-tuned after the first batch of customer complaints.',
  'Ships in recycled board, no plastic clamshell, no printed manual you were going to throw away anyway.'
];

const HIGHLIGHTS = [
  'Two-year limited warranty',
  'Ships in 24 hours from our Rotterdam warehouse',
  'Carbon-neutral delivery on every order',
  '30-day returns, no questions asked',
  'Spare parts available for five years'
];

export function buildProducts() {
  const products = [];
  const random = makeRandom(20260730);
  let id = 1;

  for (const category of CATEGORIES) {
    const models = MODELS[category.slug];
    models.forEach((model, modelIndex) => {
      // Two brands carry each model so that brand filtering has something to do.
      const brandPair = [
        BRANDS[(modelIndex * 2) % BRANDS.length],
        BRANDS[(modelIndex * 2 + 1) % BRANDS.length]
      ];

      for (const brand of brandPair) {
        const basePrice = 25 + Math.floor(random() * 1800);
        const price = Number((basePrice + 0.99).toFixed(2));
        const hasDiscount = random() < 0.35;
        const listPrice = hasDiscount ? Number((price * (1.1 + random() * 0.35)).toFixed(2)) : null;
        const stock = random() < 0.12 ? 0 : 1 + Math.floor(random() * 40);
        const rating = Number((3 + random() * 2).toFixed(1));
        const reviewCount = Math.floor(random() * 400);
        const name = `${brand} ${model}`;

        products.push({
          id: id++,
          sku: `${category.slug.slice(0, 3).toUpperCase()}-${String(id).padStart(4, '0')}`,
          name,
          slug: slugify(name),
          brand,
          category: category.slug,
          categoryName: category.name,
          price,
          listPrice,
          stock,
          rating,
          reviewCount,
          colour: COLOURS[(id + modelIndex) % COLOURS.length],
          shortDescription: `${category.name.replace(/s$/, '')} from ${brand}. ${HIGHLIGHTS[id % HIGHLIGHTS.length]}.`,
          description: [
            `The ${name} is the ${modelIndex % 2 === 0 ? 'everyday' : 'enthusiast'} option in our ${category.name.toLowerCase()} range.`,
            DESCRIPTION_PARTS[id % DESCRIPTION_PARTS.length],
            DESCRIPTION_PARTS[(id + 2) % DESCRIPTION_PARTS.length]
          ].join(' '),
          specs: {
            Model: model,
            Brand: brand,
            Warranty: `${1 + (id % 3)} years`,
            Weight: `${(0.2 + random() * 2.4).toFixed(2)} kg`,
            'Released': `20${20 + (id % 6)}`,
            'Country of origin': ['Netherlands', 'Portugal', 'Vietnam', 'Poland'][id % 4]
          },
          tags: [
            hasDiscount ? 'sale' : null,
            stock === 0 ? 'out-of-stock' : null,
            rating >= 4.5 ? 'top-rated' : null,
            id % 7 === 0 ? 'new' : null
          ].filter(Boolean)
        });
      }
    });
  }

  return products;
}

export const COUPONS = [
  { code: 'SAVE10', kind: 'percent', value: 10, minimum: 0, active: 1 },
  { code: 'SAVE25', kind: 'percent', value: 25, minimum: 400, active: 1 },
  { code: 'FLAT50', kind: 'fixed', value: 50, minimum: 200, active: 1 },
  { code: 'FREESHIP', kind: 'shipping', value: 0, minimum: 0, active: 1 },
  { code: 'EXPIRED', kind: 'percent', value: 90, minimum: 0, active: 0 }
];

export const REVIEW_SEEDS = [
  { author: 'Marta K.', rating: 5, title: 'Better than expected', body: 'Arrived a day early and the finish is far nicer than the photos suggest.' },
  { author: 'Dan O.', rating: 4, title: 'Good, with one niggle', body: 'No complaints about the hardware. The bundled cable is too short.' },
  { author: 'Priya S.', rating: 3, title: 'Fine for the price', body: 'Does the job. I would not pay full price for it again.' },
  { author: 'Tomas H.', rating: 5, title: 'Second one I have bought', body: 'Bought the first two years ago, still going, so I bought another.' },
  { author: 'Ellie R.', rating: 2, title: 'Returned it', body: 'Mine had a rattle out of the box. Returns process was painless at least.' }
];
