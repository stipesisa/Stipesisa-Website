// Zentrale Einstellungen. Alles, was der Studio-Inhaber anpassen möchte, steht hier.

export const INSTAGRAM_URL = 'https://www.instagram.com/stipezcutz/';
export const INSTAGRAM_HANDLE = '@stipezcutz';

export const WELCOME_POINTS = 25;
export const REPOST_POINTS = 50;
// Mindestabstand zwischen zwei Repost-Anfragen eines Kunden.
export const REPOST_COOLDOWN_HOURS = 24;

export const SESSION_DAYS = 30;

// Ränge richten sich nach den insgesamt gesammelten Punkten (Einlösen senkt den Rang nicht).
export const RANKS = [
  { id: 'rookie', name: 'Rookie', min: 0, color: '#4f9a5d', perk: 'Willkommen im Club' },
  { id: 'silver', name: 'Silver', min: 300, color: '#9fb4d8', perk: 'Gratis Getränk bei jedem Besuch' },
  { id: 'gold', name: 'Gold', min: 750, color: '#e0b25a', perk: '5 % auf alle Produkte' },
  { id: 'elite', name: 'Elite', min: 1500, color: '#a46cf0', perk: 'Bevorzugte Terminvergabe' },
  { id: 'diamond', name: 'Diamond', min: 3000, color: '#7cc8f2', perk: '10 % auf alle Produkte' },
  { id: 'legend', name: 'Legend', min: 6000, color: '#f3c969', perk: 'Jeder 10. Haarschnitt gratis' },
];

export function rankFor(lifetimePoints) {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (lifetimePoints >= rank.min) index = i;
  });
  const current = RANKS[index];
  const next = RANKS[index + 1] || null;
  const progress = next ? (lifetimePoints - current.min) / (next.min - current.min) : 1;
  return { ...current, index, next, progress: Math.max(0, Math.min(1, progress)) };
}

// Schnellbuttons im Admin-Bereich zum Gutschreiben von Punkten.
export const EARN_PRESETS = [
  { label: 'Haarschnitt', points: 100 },
  { label: 'Bart', points: 50 },
  { label: 'Haarschnitt + Bart', points: 140 },
  { label: 'Produktkauf', points: 30 },
];

export const DEFAULT_REWARDS = [
  {
    slug: 'sculpting-clay',
    title: 'L3VEL3 Sculpting Clay',
    description: 'Matte Modellierpaste mit starkem Halt – perfekt für Texturen, Crops und Quiffs.',
    category: 'product',
    cost: 400,
    image: '/img/products/sculpting-clay.png',
    original_image: '/img/products/sculpting-clay-original.png',
    video: '/video/sculpting-clay.mp4',
  },
  {
    slug: 'styling-powder',
    title: 'L3VEL3 Styling Powder',
    description: 'Texturizing Dust für sofortiges Volumen und einen natürlich matten Look.',
    category: 'product',
    cost: 350,
    image: '/img/products/styling-powder.png',
    original_image: '/img/products/styling-powder-original.png',
    video: '/video/styling-powder.mp4',
  },
  {
    slug: 'salt-spray',
    title: 'L3VEL3 Texturizing Salt Spray',
    description: 'Meersalz-Spray für Beach-Texture, Volumen und natürlichen Halt.',
    category: 'product',
    cost: 350,
    image: '/img/products/salt-spray.png',
    original_image: '/img/products/salt-spray-original.png',
    video: '/video/salt-spray.mp4',
  },
  {
    slug: 'beard-trim',
    title: 'Bartpflege gratis',
    description: 'Konturen, Rasur mit dem Messer und heißes Handtuch – komplett aufs Haus.',
    category: 'service',
    cost: 500,
    image: '/img/rewards/beard.png',
  },
  {
    slug: 'free-cut',
    title: 'Haarschnitt gratis',
    description: 'Ein kompletter Haarschnitt inkl. Waschen und Styling.',
    category: 'service',
    cost: 900,
    image: '/img/rewards/haircut.png',
  },
  {
    slug: 'vip-package',
    title: 'VIP Paket',
    description: 'Haarschnitt, Bartpflege und ein Styling-Produkt deiner Wahl.',
    category: 'service',
    cost: 1600,
    image: '/img/rewards/vip.png',
  },
];
