export type TxType = 'credit' | 'debit' | 'reversal' | 'adjustment';
export type TxDir = 'in' | 'out';

export interface Txn {
  id: string;
  type: TxType;
  desc: string;
  amt: number;
  dir: TxDir;
  bal: number;
  time: string;
  order: string | null;
}

export interface Notif {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: 'in' | 'out' | 'check';
}

export interface FoodItem {
  id: string;
  name: string;
  cat: 'rice' | 'swallow' | 'soup' | 'protein' | 'sides' | 'snacks' | 'combos' | 'drinks';
  price: number;
  desc: string;
  prep: number;
  avail: 'available' | 'soldout' | 'hidden';
  tags: string[];
  emoji: string;
  image?: string; // URL or base64 string for food image
  featured?: boolean;
  menuOrder?: number;
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  prepMinutes?: number;
}

export interface Order {
  id: string;
  status: 'scheduled' | 'new' | 'accepted' | 'ready' | 'picked' | 'done';
  customer: string;
  addr: string;
  items: OrderItem[];
  total: number;
  placed: string;
  note: string;
  readyInMinutes?: number;
  delayNotices?: { delayMinutes: number; reason: string; createdAt?: string }[];
  scheduledLabel?: string;
  scheduledFor?: string;
  fulfillmentType?: string;
}

export interface WeekScheduleRow {
  day: string;
  open: boolean;
  from: string;
  to: string;
}

export const CHART = [
  { d: 'Mon', v: 9400 },
  { d: 'Tue', v: 14200 },
  { d: 'Wed', v: 8100 },
  { d: 'Thu', v: 18600 },
  { d: 'Fri', v: 22100 },
  { d: 'Sat', v: 31200 },
  { d: 'Sun', v: 11500 },
];

export const TXNS: Txn[] = [
  { id: 't1', type: 'credit', desc: 'Order #ORD-0091', amt: 18630, dir: 'in', bal: 284500, time: 'Today, 2:41 PM', order: 'ORD-0091' },
  { id: 't2', type: 'debit', desc: 'Withdrawal to GTBank', amt: 50000, dir: 'out', bal: 265870, time: 'Today, 11:10 AM', order: null },
  { id: 't3', type: 'credit', desc: 'Order #ORD-0088', amt: 12150, dir: 'in', bal: 315870, time: 'Yesterday, 7:18 PM', order: 'ORD-0088' },
  { id: 't4', type: 'credit', desc: 'Order #ORD-0087', amt: 9450, dir: 'in', bal: 303720, time: 'Yesterday, 1:45 PM', order: 'ORD-0087' },
  { id: 't5', type: 'reversal', desc: 'Refund — Order #ORD-0081', amt: 4500, dir: 'out', bal: 294270, time: 'Jun 11, 10:22 AM', order: 'ORD-0081' },
  { id: 't6', type: 'adjustment', desc: 'Onboarding Bonus', amt: 5000, dir: 'in', bal: 298770, time: 'Jun 10, 9:00 AM', order: null },
  { id: 't7', type: 'credit', desc: 'Order #ORD-0078', amt: 22680, dir: 'in', bal: 293770, time: 'Jun 9, 6:12 PM', order: 'ORD-0078' },
  { id: 't8', type: 'debit', desc: 'Withdrawal to GTBank', amt: 80000, dir: 'out', bal: 271090, time: 'Jun 8, 2:00 PM', order: null },
];

export const NOTIFS: Notif[] = [
  { id: 'n1', title: 'Wallet Credited', body: 'Your wallet has been credited ₦18,630 for order #ORD-0091.', time: '2:41 PM', read: false, icon: 'in' },
  { id: 'n2', title: 'Withdrawal Complete', body: '₦50,000 withdrawal to GTBank ****1234 was successful.', time: '11:42 AM', read: false, icon: 'check' },
  { id: 'n3', title: 'Wallet Credited', body: 'Your wallet has been credited ₦12,150 for order #ORD-0088.', time: 'Yesterday', read: true, icon: 'in' },
  { id: 'n4', title: 'Refund Deducted', body: '₦4,500 reversed from your wallet for order #ORD-0081.', time: 'Jun 11', read: true, icon: 'out' },
];

export const INITIAL_FOOD_ITEMS: FoodItem[] = [
  { id: 'f1', name: 'Jollof Rice + Chicken', cat: 'rice', price: 2500, desc: 'Smoky party jollof with well-seasoned grilled chicken and coleslaw.', prep: 25, avail: 'available', tags: ['popular', 'bestseller'], emoji: '🍛' },
  { id: 'f2', name: 'Egusi Soup + Pounded Yam', cat: 'soup', price: 3200, desc: 'Rich egusi soup with assorted meat, stockfish and freshly pounded yam.', prep: 35, avail: 'available', tags: ['popular'], emoji: '🥣' },
  { id: 'f3', name: 'Pepper Soup (Goat Meat)', cat: 'soup', price: 2800, desc: 'Hot and spicy goat meat pepper soup with utazi leaves.', prep: 20, avail: 'available', tags: ['spicy', 'popular'], emoji: '🍲' },
  { id: 'f4', name: 'Fried Rice + Plantain', cat: 'rice', price: 2200, desc: 'Nigerian fried rice with mixed vegetables, liver and ripe fried plantain.', prep: 20, avail: 'available', tags: ['bestseller'], emoji: '🍚' },
  { id: 'f5', name: 'Grilled Chicken (Full)', cat: 'protein', price: 4500, desc: 'Whole chicken marinated overnight, charcoal grilled to perfection.', prep: 45, avail: 'available', tags: ['popular', 'bestseller'], emoji: '🍗' },
  { id: 'f6', name: 'Catfish Peppersoup', cat: 'soup', price: 3500, desc: 'Fresh point-and-kill catfish pepper soup with scent leaves.', prep: 30, avail: 'soldout', tags: ['spicy'], emoji: '🐟' },
  { id: 'f7', name: 'Cow Leg (Bokoto)', cat: 'protein', price: 3800, desc: 'Slow-cooked cow leg in a rich sauce with spices and herbs.', prep: 60, avail: 'available', tags: [], emoji: '🦴' },
  { id: 'f8', name: 'Amala + Ewedu & Gbegiri', cat: 'rice', price: 1800, desc: 'Smooth amala with authentic ewedu soup and gbegiri bean soup.', prep: 15, avail: 'available', tags: ['vegan'], emoji: '🫙' },
  { id: 'f9', name: 'Chapman (Large)', cat: 'drinks', price: 1200, desc: 'Classic Nigerian Chapman cocktail with Ribena, Angostura bitters and fruit.', prep: 5, avail: 'available', tags: ['new'], emoji: '🍹' },
  { id: 'f10', name: 'Zobo Drink (Bottle)', cat: 'drinks', price: 800, desc: 'Chilled hibiscus zobo with ginger, cloves and pineapple flavour.', prep: 3, avail: 'available', tags: ['vegan', 'new'], emoji: '🫖' },
  { id: 'f11', name: 'Ofe Onugbu + Eba', cat: 'soup', price: 2600, desc: 'Bitter leaf soup with ofe-onugbu leaves, crayfish and palm oil with eba.', prep: 25, avail: 'soldout', tags: [], emoji: '🥘' },
  { id: 'f12', name: 'Asun (Peppered Goat)', cat: 'protein', price: 3200, desc: 'Spicy peppered goat meat, perfectly charred with onions and scotch bonnet.', prep: 30, avail: 'soldout', tags: ['spicy', 'popular'], emoji: '🥩' },
];

export const INITIAL_ORDERS: Order[] = [
  { id: 'ORD-0094', status: 'new', customer: 'Chidi Okeke', addr: '12 Allen Ave, Ikeja', items: [{ name: 'Jollof Rice + Chicken', qty: 2, price: 2500 }, { name: 'Chapman (Large)', qty: 1, price: 1200 }], total: 6200, placed: '2 mins ago', note: 'Extra pepper please' },
  { id: 'ORD-0093', status: 'new', customer: 'Amaka Nwosu', addr: '7 Bode Thomas, Surulere', items: [{ name: 'Egusi Soup + Pounded Yam', qty: 1, price: 3200 }, { name: 'Grilled Chicken (Full)', qty: 1, price: 4500 }], total: 7700, placed: '5 mins ago', note: '' },
  { id: 'ORD-0092', status: 'accepted', customer: 'Tunde Bakare', addr: '45 Opebi Road, Ikeja', items: [{ name: 'Pepper Soup (Goat Meat)', qty: 2, price: 2800 }, { name: 'Zobo Drink (Bottle)', qty: 2, price: 800 }], total: 7200, placed: '18 mins ago', note: 'No onions' },
  { id: 'ORD-0091', status: 'ready', customer: 'Funke Adeyemi', addr: '3 Unity Close, Yaba', items: [{ name: 'Fried Rice + Plantain', qty: 1, price: 2200 }, { name: 'Asun (Peppered Goat)', qty: 1, price: 3200 }], total: 5400, placed: '32 mins ago', note: '' },
  { id: 'ORD-0090', status: 'done', customer: 'Emeka Obi', addr: '20 Broad St, Lagos Island', items: [{ name: 'Amala + Ewedu & Gbegiri', qty: 2, price: 1800 }], total: 3600, placed: '1 hr ago', note: '' },
  { id: 'ORD-0089', status: 'done', customer: 'Ngozi Eze', addr: '11 Ladipo St, Mushin', items: [{ name: 'Jollof Rice + Chicken', qty: 3, price: 2500 }], total: 7500, placed: '1.5 hrs ago', note: '' },
  { id: 'ORD-0088', status: 'done', customer: 'Bayo Adegoke', addr: '5 Akin Adesola, VI', items: [{ name: 'Catfish Peppersoup', qty: 1, price: 3500 }, { name: 'Chapman (Large)', qty: 2, price: 1200 }], total: 5900, placed: '2 hrs ago', note: '' },
];

export const WEEK_SCHEDULE: WeekScheduleRow[] = [
  { day: 'Monday', open: true, from: '08:00', to: '21:00' },
  { day: 'Tuesday', open: true, from: '08:00', to: '21:00' },
  { day: 'Wednesday', open: true, from: '08:00', to: '21:00' },
  { day: 'Thursday', open: true, from: '08:00', to: '21:00' },
  { day: 'Friday', open: true, from: '08:00', to: '22:00' },
  { day: 'Saturday', open: true, from: '09:00', to: '22:00' },
  { day: 'Sunday', open: false, from: '10:00', to: '18:00' },
];
