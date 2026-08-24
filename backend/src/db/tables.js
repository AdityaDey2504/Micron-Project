// ---------------------------------------------------------------------------
// SCHEMA ADAPTER - the single place table and column names are written down.
//
// Verified against the live Supabase schema (products / customers / orders /
// order_items / inventory). Every query in this codebase goes through the
// names below, so a schema change is a one-file fix.
//
// ONE THING THE DB OWNER STILL HAS TO ADD - see backend/README.md:
//
//   customers has no email, password_hash or role, so nobody can log in.
//   Auth needs those three columns. Names assumed below; the ALTER TABLE
//   statements are ready to paste in src/db/schema.sql.
//
// products.embedding is also absent, but that one degrades gracefully:
// search falls back to keyword matching on searchable_text.
// ---------------------------------------------------------------------------

const TABLES = {
  products: 'products',
  customers: 'customers',
  orders: 'orders',
  orderItems: 'order_items',
  inventory: 'inventory',
};

const COLUMNS = {
  products: {
    id: 'product_id',
    name: 'title',
    description: 'key_features',
    category: 'category',
    price: 'price',
    discountPercent: 'discount_percent',
    imageUrl: 'image_url',
    searchableText: 'searchable_text',
    embedding: 'embedding', // added later by the DB owner (pgvector)
    createdAt: 'created_at',
  },

  // Present in the schema but not needed by every query. mapProduct passes
  // these through only when the column actually has a value.
  productsOptional: {
    rating: 'rating',
    ratingCount: 'rating_count',
    reviewCount: 'review_count',
    mrp: 'original_price',
    productUrl: 'product_url',
    offer: 'offer',
    exchangeOffer: 'exchange_offer',
  },

  customers: {
    id: 'customer_id',
    name: 'name',
    // The three below do not exist in the schema yet - auth is blocked on them.
    email: 'email',
    passwordHash: 'password_hash',
    role: 'role',
    // Personalisation columns the DB owner did include.
    age: 'age',
    city: 'city',
    preferences: 'preferences',
    budgetMin: 'budget_min',
    budgetMax: 'budget_max',
    preferredCategories: 'preferred_categories',
    archetype: 'customer_archetype',
    createdAt: 'created_at',
  },

  orders: {
    id: 'order_id',
    customerId: 'customer_id',
    total: 'total_amount',
    status: 'order_status',
    // The schema has no created_at on orders; order_date is the timestamp.
    createdAt: 'order_date',
  },

  orderItems: {
    id: 'order_item_id',
    orderId: 'order_id',
    productId: 'product_id',
    quantity: 'quantity',
    unitPrice: 'price_paid',
  },

  inventory: {
    productId: 'product_id', // also the primary key
    stock: 'stock',
    reservedStock: 'reserved_stock',
    lastRestocked: 'last_restocked',
  },
};

// Postgres function the DB owner needs to create for semantic search once the
// embedding column exists. Until then products.service falls back to keyword
// search automatically - see searchProducts().
const RPC = {
  matchProducts: 'match_products',
};

// Every primary key in this schema is a text column with no default, so the
// application has to mint ids itself.
function generateId(prefix) {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${random}`;
}

// --- row <-> API shape mappers -------------------------------------------
// The API speaks camelCase to the frontend; Postgres speaks snake_case.
// Mapping in one place keeps that seam out of every controller.

function mapProduct(row) {
  if (!row) return null;
  const c = COLUMNS.products;
  const o = COLUMNS.productsOptional;

  const price = Number(row[c.price] ?? 0);
  const mrp = row[o.mrp] == null ? null : Number(row[o.mrp]);

  // Prefer the stored discount_percent; fall back to deriving it from
  // original_price, which is how the Flipkart dataset expresses a discount.
  const stored = row[c.discountPercent];
  const discountPercent =
    stored != null
      ? Number(stored)
      : mrp && mrp > price
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;

  const optional = {};
  if (row[o.rating] != null) optional.rating = Number(row[o.rating]);
  if (row[o.ratingCount] != null) optional.ratingCount = Number(row[o.ratingCount]);
  if (row[o.reviewCount] != null) optional.reviewCount = Number(row[o.reviewCount]);
  if (mrp != null) optional.mrp = mrp;
  if (row[o.productUrl] != null) optional.productUrl = row[o.productUrl];
  if (row[o.offer]) optional.offer = row[o.offer];
  if (row[o.exchangeOffer]) optional.exchangeOffer = row[o.exchangeOffer];

  return {
    ...optional,
    id: row[c.id],
    name: row[c.name],
    description: row[c.description] ?? null,
    category: row[c.category] ?? null,
    price,
    discountPercent,
    // Precomputed so the frontend and the chatbot never disagree on the maths.
    finalPrice: Math.round(price * (1 - discountPercent / 100) * 100) / 100,
    imageUrl: row[c.imageUrl] ?? null,
    createdAt: row[c.createdAt] ?? null,
  };
}

function mapCustomer(row) {
  if (!row) return null;
  const c = COLUMNS.customers;
  return {
    id: row[c.id],
    name: row[c.name],
    email: row[c.email] ?? null,
    role: row[c.role] ?? 'customer',
    city: row[c.city] ?? null,
    budgetMin: row[c.budgetMin] == null ? null : Number(row[c.budgetMin]),
    budgetMax: row[c.budgetMax] == null ? null : Number(row[c.budgetMax]),
    preferredCategories: row[c.preferredCategories] ?? null,
    // Dataset personalisation fields - handy for the recommendation prompt.
    age: row[c.age] == null ? null : Number(row[c.age]),
    preferences: row[c.preferences] ?? null,
    archetype: row[c.archetype] ?? null,
    createdAt: row[c.createdAt] ?? null,
  };
}

function mapOrder(row, items) {
  if (!row) return null;
  const c = COLUMNS.orders;
  return {
    id: row[c.id],
    customerId: row[c.customerId],
    total: Number(row[c.total] ?? 0),
    status: row[c.status] ?? 'pending',
    createdAt: row[c.createdAt] ?? null,
    items: items ?? undefined,
  };
}

function mapOrderItem(row) {
  if (!row) return null;
  const c = COLUMNS.orderItems;
  const quantity = Number(row[c.quantity] ?? 0);
  const unitPrice = Number(row[c.unitPrice] ?? 0);
  return {
    id: row[c.id],
    orderId: row[c.orderId],
    productId: row[c.productId],
    quantity,
    unitPrice,
    lineTotal: Math.round(quantity * unitPrice * 100) / 100,
    product: row.products ? mapProduct(row.products) : undefined,
  };
}

module.exports = {
  TABLES,
  COLUMNS,
  RPC,
  generateId,
  mapProduct,
  mapCustomer,
  mapOrder,
  mapOrderItem,
};
