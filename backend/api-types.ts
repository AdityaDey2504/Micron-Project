/**
 * Response types for the Micron backend API.
 *
 * Generated from real responses against the live database, not written by
 * hand - if something here is wrong, the API changed and this file should be
 * regenerated rather than patched.
 *
 * FRONTEND: copy this file into src/types/api.ts and import from there.
 *
 * Conventions that hold across every endpoint:
 *   - All money is a number in rupees, already rounded to 2 decimals.
 *   - `finalPrice` is what the customer pays. `price` is the pre-discount
 *     price, for the struck-through display. Never compute the discount
 *     yourself - the server has already done it.
 *   - `stock: null` means UNKNOWN (no inventory row), not sold out.
 *   - Any request can fail with ApiError and a non-2xx status.
 *   - Authenticated calls need: Authorization: `Bearer ${token}`
 *
 * ---------------------------------------------------------------------------
 * BASE URL   http://localhost:4000        (set VITE_API_URL to override)
 *
 * TEST LOGINS
 *   demo@aura.dev  / demo123    customer with 6 real orders - use this one,
 *                               a newly registered account has no history and
 *                               makes the chatbot look broken
 *   admin@aura.dev / admin123   admin dashboard
 *
 * ENDPOINTS                                          auth      response type
 *   GET    /health                                   -         { status }
 *   POST   /api/auth/register                        -         AuthResponse
 *   POST   /api/auth/login                           -         AuthResponse
 *   GET    /api/auth/me                              user      MeResponse
 *   GET    /api/products                             -         ProductListResponse
 *   GET    /api/products/categories                  -         CategoryListResponse
 *   GET    /api/products/discounted                  -         ProductListResponse
 *   GET    /api/products/search?q=                   optional  SearchResponse
 *   GET    /api/products/:id                         -         ProductDetailResponse
 *   GET    /api/products/:id/reviews                 -         ReviewListResponse
 *   POST   /api/cart/price                           -         CartPriceResponse
 *   POST   /api/cart/optimize                        -         CartOptimizeResponse
 *   GET    /api/orders                               user      OrderListResponse
 *   GET    /api/orders/:id                           user      OrderDetailResponse
 *   POST   /api/orders/checkout                      user      CheckoutResponse (201)
 *   POST   /api/chat                                 optional  ChatResponse
 *   POST   /api/admin/products                       admin     Product (201)
 *   PATCH  /api/admin/products/:id                   admin     Product
 *   DELETE /api/admin/products/:id                   admin     DeleteResponse
 *   PUT    /api/admin/products/:id/stock             admin     StockUpdateResponse
 *   PUT    /api/admin/products/:id/discount          admin     Product
 *   GET    /api/admin/inventory                      admin     InventoryResponse
 *   GET    /api/admin/orders                         admin     OrderListResponse
 *   PATCH  /api/admin/orders/:id/status              admin     Order
 *
 * QUERY PARAMS for GET /api/products (all optional, combinable)
 *   category=laptops        exact category name: laptops | mobiles | earphones
 *   search=gaming           matched word by word against title and category
 *   q=gaming                alias for search
 *   minPrice=5000
 *   maxPrice=80000
 *   discounted=true         only products with a discount
 *   sort=price_asc | price_desc | discount | popular
 *   limit=20                default 20, max 100
 *   offset=0
 *
 * Categories in the catalog right now: mobiles (673), earphones (425),
 * laptops (330) - 1,428 products in total.
 * ---------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Every failed request returns this shape, whatever the status code. */
export interface ApiError {
  error: string;
  /** Only on some 409s, e.g. which cart items were out of stock. */
  details?: unknown;
}

/**
 * 400 bad input · 401 not logged in · 403 not an admin · 404 missing
 * 409 conflict (e.g. out of stock at checkout) · 429 rate limited
 * 502 database problem
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Standard wrapper for list endpoints. */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type UserRole = 'customer' | 'admin';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  // The seeded dataset also contains this one.
  | 'processing';

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * The full product shape, from GET /products and GET /products/:id.
 *
 * The optional fields come from the source dataset and are absent when that
 * column is empty for a given product - always guard before rendering them.
 */
export interface Product {
  id: string;
  name: string;
  category: string;
  /** From key_features. Frequently null - many products have no description. */
  description: string | null;
  /** Pre-discount price, for the struck-through display. */
  price: number;
  discountPercent: number;
  /** What the customer actually pays. Use this everywhere. */
  finalPrice: number;
  imageUrl: string | null;
  createdAt: string | null;

  /** Sellable stock. null = unknown, not sold out. Only on GET /products/:id. */
  stock?: number | null;

  // Optional dataset fields - present only when the product has them.
  rating?: number;
  ratingCount?: number;
  reviewCount?: number;
  /** Original list price, where the dataset recorded one. */
  mrp?: number;
  productUrl?: string;
  offer?: string;
  exchangeOffer?: string;
}

/** GET /products/categories */
export interface Category {
  /** URL-safe slug, e.g. "laptops". Use for /products/:category routes. */
  id: string;
  name: string;
  itemCount: number;
}

/**
 * The trimmed product shape used by search and chat. NOTE the different field
 * names: `price` here is the final price, and the pre-discount price is
 * `listPrice`. This is not the same shape as Product.
 */
export interface RankedProduct {
  id: string;
  name: string;
  category: string;
  /** Final price - what the customer pays. */
  price: number;
  /** Pre-discount price. */
  listPrice: number;
  discountPercent: number;
  rating?: number;
  stock?: number | null;
  /** 0-1 relevance score from the ranker. Useful for debugging, not display. */
  rankScore?: number;
}

/** GET /products and /products/discounted */
export type ProductListResponse = Paginated<Product>;

/** GET /products/categories */
export interface CategoryListResponse {
  items: Category[];
}

/** GET /products/:id */
export type ProductDetailResponse = Product;

/** GET /products/search?q=... */
export interface SearchResponse {
  products: RankedProduct[];
  appliedFilters: {
    category: string | null;
    maxPrice: number | null;
  };
  /** true when semantic (vector) search ran, false when it fell back to keywords. */
  semantic: boolean;
  /**
   * Present only when the signed-in customer bought from this category in the
   * last 60 days. This is the "don't buy" warning - surface it in the UI.
   */
  recentPurchase?: {
    productName: string;
    daysAgo: number;
    /** Phrasing intended for the AI; write your own copy for the UI. */
    note: string;
  };
  /** Present only when nothing matched. */
  message?: string;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface Review {
  id: string;
  productId: string;
  /** Free-text name. NOT linked to a customer account - there is no user to
   *  link a review to, so no "verified purchase" concept exists. */
  author: string;
  title: string | null;
  text: string | null;
  /** 1-5. */
  rating: number;
  /** "YYYY-MM-DD". */
  date: string | null;
  /** Currently "synthetic_demo" for every row - label generated reviews honestly. */
  source: string | null;
}

export interface ReviewSummary {
  productId: string;
  count: number;
  /** null when the product has no reviews. */
  average: number | null;
  /** Star counts keyed "1".."5". null when there are no reviews. */
  breakdown: Record<string, number> | null;
}

/**
 * GET /products/:id/reviews
 *
 * IMPORTANT: all 425 earphones have zero reviews, so `items` is empty and
 * `summary.average` is null for roughly 30% of the catalogue. Design the
 * empty state deliberately - it is a normal case, not an error.
 */
export interface ReviewListResponse extends Paginated<Review> {
  summary: ReviewSummary;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * The signed-in customer. The personalisation fields come from the dataset
 * and are null for accounts created through /auth/register.
 */
export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  city: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredCategories: string | null;
  age: number | null;
  preferences: string | null;
  archetype: string | null;
  createdAt: string | null;
}

/** POST /auth/register and POST /auth/login */
export interface AuthResponse {
  /** JWT. Store it, and send as `Bearer ${token}` on authenticated calls. */
  token: string;
  user: User;
}

/** GET /auth/me */
export interface MeResponse {
  user: User;
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

/** What you send to /cart/price, /cart/optimize and /orders/checkout. */
export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface PricedCartItem {
  productId: string;
  name: string;
  imageUrl: string | null;
  /** Per-unit price after discount. */
  unitPrice: number;
  /** Per-unit price before discount. */
  listPrice: number;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
  savings: number;
  stock: number | null;
  /** false when stock is known and insufficient. Unknown stock counts as true. */
  inStock: boolean;
}

/** POST /cart/price */
export interface CartPriceResponse {
  items: PricedCartItem[];
  subtotal: number;
  /** Total saved versus list prices - worth showing, it looks good. */
  savings: number;
  total: number;
  itemCount: number;
  /** true if any line is out of stock. Checkout will 409 if you proceed. */
  hasUnavailableItems: boolean;
}

export interface SwapSuggestion {
  from: {
    productId: string;
    name: string;
    finalPrice: number;
    discountPercent: number;
  };
  to: {
    productId: string;
    name: string;
    finalPrice: number;
    discountPercent: number;
  };
  quantity: number;
  /** Rupees saved by taking this swap. */
  saves: number;
}

/** POST /cart/optimize */
export interface CartOptimizeResponse {
  current: { total: number; itemCount: number };
  /** Empty array means the cart is already the best price available. */
  suggestions: SwapSuggestion[];
  totalSavings: number;
  optimisedTotal: number;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  /** Price per unit at the time of purchase, not today's price. */
  unitPrice: number;
  lineTotal: number;
  /** The product as it exists now. Absent on some endpoints. */
  product?: Product;
}

export interface Order {
  id: string;
  customerId: string;
  total: number;
  status: OrderStatus;
  /** Date only, "YYYY-MM-DD" - orders.order_date is a DATE, not a timestamp. */
  createdAt: string;
  /** Absent on the status-update response. */
  items?: OrderItem[];
}

/** GET /orders and GET /admin/orders */
export type OrderListResponse = Paginated<Order>;

/** GET /orders/:id */
export type OrderDetailResponse = Order;

/** POST /orders/checkout - returns 201 on success. */
export interface CheckoutResponse {
  order: Order;
  /** Total saved on this order versus list prices. */
  savings: number;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** POST /chat request body. */
export interface ChatRequest {
  message: string;
  /** Last 10 turns are kept; older ones are dropped server-side. */
  history?: ChatHistoryTurn[];
  /** Required for cart optimisation, since the cart lives in the browser. */
  cart?: CartItemInput[];
  /** Echo back the sessionId from the previous response. */
  sessionId?: string;
}

/** POST /chat response. */
export interface ChatResponse {
  /** Prose for the chat bubble. May contain newlines; render them. */
  reply: string;
  /** Render these as product cards beneath the reply. Often empty. */
  products: RankedProduct[];
  /** Which tools ran. Useful for a debug panel; hide in the real UI. */
  toolCalls: { name: string; args: Record<string, unknown> }[];
  /** false when the deterministic fallback answered instead of the model. */
  usedModel: boolean;
  /**
   * Send this back on the next message. Without it, follow-ups like
   * "what if I raise my budget" have no previous search to compare against.
   */
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface InventoryRow {
  productId: string;
  name: string;
  category: string;
  /** Final price. */
  price: number;
  /** null = no inventory row exists for this product. */
  stock: number | null;
}

/** GET /admin/inventory - sorted lowest stock first. */
export interface InventoryResponse {
  items: InventoryRow[];
  total: number;
}

/** POST /admin/products and PATCH /admin/products/:id */
export interface ProductWriteRequest {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  discountPercent?: number;
  imageUrl?: string;
  /** Written to the inventory table, not the product row. */
  stock?: number;
}

/** PUT /admin/products/:id/stock */
export interface StockUpdateResponse {
  productId: string;
  stock: number;
}

/** DELETE /admin/products/:id */
export interface DeleteResponse {
  id: string;
  deleted: boolean;
}
