/**
 * lib/data/seller.ts
 * Single source of truth for all mock seller data.
 * Never use real Snapdeal seller data here.
 */

export interface SkuRecord {
  id: string;
  name: string;
  category: string;
  asp: number; // average selling price ₹
  lastMonthUnits: number;
  thisMonthUnits: number;
  stock: number; // current stock
  isOos: boolean; // out of stock
  isBestSeller: boolean;
}

export interface SellerMetrics {
  sellerId: string;
  sellerName: string;
  category: string;
  location: string;
  lastMonth: MonthMetrics;
  thisMonth: MonthMetrics;
}

export interface MonthMetrics {
  sales: number;
  orders: number;
  cancellationRate: number; // as decimal e.g. 0.08
  asp: number;
  oosProducts: number;
}

// ─── Seller Profile ───────────────────────────────────────────────────────────
export const SELLER: SellerMetrics = {
  sellerId: "SNAP-RT-29847",
  sellerName: "Rakesh Traders",
  category: "Home & Kitchen",
  location: "Indore, MP",
  lastMonth: {
    sales: 200000,
    orders: 400,
    cancellationRate: 0.08,
    asp: 500,
    oosProducts: 5,
  },
  thisMonth: {
    sales: 135000,
    orders: 270,
    cancellationRate: 0.14,
    asp: 500,
    oosProducts: 18,
  },
};

// ─── SKU Catalogue (≥18 SKUs) ────────────────────────────────────────────────
// 5 best sellers are among the out-of-stock items (drives narrative)
export const SKUS: SkuRecord[] = [
  // Best sellers — now OUT OF STOCK ⚠️
  {
    id: "RT-001",
    name: "Stainless Steel Pressure Cooker 5L",
    category: "Cookware",
    asp: 899,
    lastMonthUnits: 62,
    thisMonthUnits: 11,
    stock: 0,
    isOos: true,
    isBestSeller: true,
  },
  {
    id: "RT-002",
    name: "Non-Stick Tawa 28cm",
    category: "Cookware",
    asp: 349,
    lastMonthUnits: 54,
    thisMonthUnits: 8,
    stock: 0,
    isOos: true,
    isBestSeller: true,
  },
  {
    id: "RT-003",
    name: "Casserole Set 3-Piece",
    category: "Serveware",
    asp: 649,
    lastMonthUnits: 48,
    thisMonthUnits: 6,
    stock: 0,
    isOos: true,
    isBestSeller: true,
  },
  {
    id: "RT-004",
    name: "Glass Mixing Bowl Set",
    category: "Bakeware",
    asp: 429,
    lastMonthUnits: 41,
    thisMonthUnits: 4,
    stock: 0,
    isOos: true,
    isBestSeller: true,
  },
  {
    id: "RT-005",
    name: "Bamboo Cutting Board XL",
    category: "Kitchen Tools",
    asp: 299,
    lastMonthUnits: 38,
    thisMonthUnits: 3,
    stock: 0,
    isOos: true,
    isBestSeller: true,
  },
  // Additional out-of-stock (13 more → total 18 OOS)
  {
    id: "RT-006",
    name: "Silicone Spatula Set 4-Piece",
    category: "Kitchen Tools",
    asp: 199,
    lastMonthUnits: 29,
    thisMonthUnits: 2,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-007",
    name: "Copper Bottom Kadai 2.5L",
    category: "Cookware",
    asp: 749,
    lastMonthUnits: 24,
    thisMonthUnits: 1,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-008",
    name: "Idli Maker 4-Plate",
    category: "Appliances",
    asp: 299,
    lastMonthUnits: 20,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-009",
    name: "Masala Box 7-Compartment",
    category: "Storage",
    asp: 249,
    lastMonthUnits: 18,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-010",
    name: "Stainless Steel Water Bottle 1L",
    category: "Drinkware",
    asp: 349,
    lastMonthUnits: 17,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-011",
    name: "Vegetable Chopper 14-Blade",
    category: "Kitchen Tools",
    asp: 599,
    lastMonthUnits: 15,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-012",
    name: "Roti Maker Electric",
    category: "Appliances",
    asp: 1299,
    lastMonthUnits: 13,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-013",
    name: "Fruit Infuser Water Jug 2L",
    category: "Drinkware",
    asp: 449,
    lastMonthUnits: 11,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-014",
    name: "Colander Strainer Large",
    category: "Kitchen Tools",
    asp: 199,
    lastMonthUnits: 9,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-015",
    name: "Oven Mitts Silicone Pair",
    category: "Kitchen Linen",
    asp: 149,
    lastMonthUnits: 8,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-016",
    name: "Mini Food Processor 500W",
    category: "Appliances",
    asp: 1899,
    lastMonthUnits: 7,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-017",
    name: "Fridge Organiser Set 6-Piece",
    category: "Storage",
    asp: 549,
    lastMonthUnits: 7,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  {
    id: "RT-018",
    name: "Marble Rolling Pin with Board",
    category: "Bakeware",
    asp: 379,
    lastMonthUnits: 6,
    thisMonthUnits: 0,
    stock: 0,
    isOos: true,
    isBestSeller: false,
  },
  // In-stock SKUs (healthy)
  {
    id: "RT-019",
    name: "Dinner Set 18-Piece Melamine",
    category: "Dinnerware",
    asp: 1299,
    lastMonthUnits: 32,
    thisMonthUnits: 29,
    stock: 45,
    isOos: false,
    isBestSeller: false,
  },
  {
    id: "RT-020",
    name: "Kitchen Towel Set 6-Piece",
    category: "Kitchen Linen",
    asp: 249,
    lastMonthUnits: 28,
    thisMonthUnits: 25,
    stock: 120,
    isOos: false,
    isBestSeller: false,
  },
  {
    id: "RT-021",
    name: "Can Opener Heavy Duty",
    category: "Kitchen Tools",
    asp: 149,
    lastMonthUnits: 19,
    thisMonthUnits: 17,
    stock: 83,
    isOos: false,
    isBestSeller: false,
  },
  {
    id: "RT-022",
    name: "Spice Rack 12-Jar Rotating",
    category: "Storage",
    asp: 699,
    lastMonthUnits: 15,
    thisMonthUnits: 12,
    stock: 31,
    isOos: false,
    isBestSeller: false,
  },
];

// ─── Assumptions ─────────────────────────────────────────────────────────────
export const ASSUMPTIONS = [
  "Orders = net placed orders; sales = orders × ASP (₹500 flat).",
  "The 13 additional stock-outs are assumed to be top/mid sellers; OOS listings lose search rank on Snapdeal.",
  "Seller-initiated cancellations are driven mainly by stock-outs (can't fulfil after order).",
  "Competitor pricing is unknown — ASP is flat, so price is not blamed unless the seller reports undercutting.",
];

