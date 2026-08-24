# Backend — API contract

Express + Supabase. Everything the frontend and the chatbot talk to lives here.

## Run it

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values
npm run dev               # http://localhost:4000
```

`.env` currently contains only a placeholder comment — copy `.env.example` over it.
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `JWT_SECRET` are required; the server
refuses to boot without them, on purpose. Use the **service role** key: this is a
trusted server and RLS would otherwise block every query.

`GEMINI_API_KEY` is optional. Without it the chat endpoint still answers, using a
deterministic keyword router instead of the model.

Health check: `GET /health`.

## Blocked on the DB owner

Checked against the live schema pulled from Supabase. Every column the backend
uses exists, with one exception:

**`customers` has no `email`, `password_hash` or `role`**, so registration and
login cannot work at all, and there is no way to tell an admin from a customer.
The API hashes with bcrypt and issues its own JWT — it just needs those three
columns. The `ALTER TABLE` statements are ready to paste in
**`src/db/schema.sql`**, along with the pgvector setup.

Also worth adding: `idx_orders_order_date` and `idx_products_price`. The four
indexes already written cover the joins; those two cover the 60-day
recent-purchase window and every budget-filtered search.

Until pgvector lands, product search falls back to keyword matching on
`searchable_text` automatically. The chatbot works either way.

## Where the schema lives in the code

Every table and column name is in **`src/db/tables.js`** and nowhere else. If the
schema changes, edit that one file — no service, controller or route needs
touching. That is why the backend could be built before the schema was final.

## Seeding

```bash
npm run seed:users                              # admin@aura.dev/admin123, demo@aura.dev/demo123
node src/db/seed/seedProducts.js ./data/flipkart.csv
npm run seed:orders                             # order history for demo@aura.dev
node src/db/seed/seedProducts.js --embeddings-only   # after pgvector is set up
```

`seedOrders` deliberately places one order 41 days ago so the don't-buy warning
has something to fire on during the demo.

## Auth

Custom JWT. `POST /api/auth/login` returns `{ token, user }`; send it back as
`Authorization: Bearer <token>` on every authenticated call. Roles are
`customer` and `admin`; `role` is never read from a request body, so nobody can
register themselves as an admin.

## Endpoints

### Public

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/products` | `?category=&search=&minPrice=&maxPrice=&discounted=true&sort=price_asc\|price_desc\|discount&limit=&offset=` |
| `GET` | `/api/products/categories` | For the catalog overview page |
| `GET` | `/api/products/discounted` | Biggest discount first |
| `GET` | `/api/products/search` | `?q=` — the ranked search the chatbot uses, without the model call |
| `GET` | `/api/products/:id` | Includes `stock` |
| `POST` | `/api/auth/register` | `{ name, email, password }` → `{ token, user }` |
| `POST` | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| `POST` | `/api/cart/price` | `{ items: [{ productId, quantity }] }` |
| `POST` | `/api/cart/optimize` | Same body; returns cheaper same-category swaps |
| `POST` | `/api/chat` | Auth optional — see below |

### Authenticated

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/auth/me` | Restore a session from a stored token |
| `GET` | `/api/orders` | The signed-in customer's orders |
| `GET` | `/api/orders/:id` | Scoped to the caller — order ids cannot be walked |
| `POST` | `/api/orders/checkout` | `{ items: [{ productId, quantity }] }` |

### Admin only

| Method | Path |
|---|---|
| `POST` | `/api/admin/products` |
| `PATCH` | `/api/admin/products/:id` |
| `DELETE` | `/api/admin/products/:id` |
| `PUT` | `/api/admin/products/:id/stock` |
| `PUT` | `/api/admin/products/:id/discount` |
| `GET` | `/api/admin/inventory` |
| `GET` | `/api/admin/orders` |
| `PATCH` | `/api/admin/orders/:id/status` |

## Notes for the frontend

**The cart is yours.** There is no cart table in the schema, so the cart lives in
the browser. Send the whole thing to `/api/cart/price` whenever you need totals,
and to `/api/orders/checkout` to buy. The server re-reads every price from the
database, so a tampered cart cannot change what anything costs.

**Products** come back as:

```json
{
  "id": "PROD-...", "name": "...", "category": "...", "description": "...",
  "price": 89990, "discountPercent": 20, "finalPrice": 71992,
  "imageUrl": "...", "stock": 12,
  "rating": 4.3, "ratingCount": 1284, "mrp": 89990
}
```

`finalPrice` is what the customer pays — use it everywhere. `price` is the
pre-discount price, for the struck-through display.

`stock` is **sellable** stock: `inventory.stock` minus `inventory.reserved_stock`,
so it is already the number you can safely offer. `stock: null` means unknown (no
inventory row), not sold out.

**Errors** are always `{ "error": "message" }` with a real status code —
`400` bad input, `401` not logged in, `403` not an admin, `404` missing,
`409` conflict (e.g. out of stock at checkout), `429` rate limited.

**Chat**:

```jsonc
// POST /api/chat
{
  "message": "gaming laptop under 80k",
  "history": [{ "role": "user", "content": "..." }],  // optional, last 10 turns
  "cart": [{ "productId": "...", "quantity": 1 }],    // needed for cart optimisation
  "sessionId": "..."                                  // echo back what the server returns
}
// →
{ "reply": "...", "products": [...], "toolCalls": [...], "sessionId": "...", "usedModel": true }
```

Keep sending the same `sessionId` — "what if I raise my budget" needs the
previous search to compare against. Render `products` as cards; `reply` is the
chat bubble. Rate limited to 20 messages/minute per user.

## Notes for the AI teammate

Your file is **`src/services/ai/orchestrator.js`**. The backend side is done:

- `toolSchemas.js` — the 7 Gemini function declarations and the system prompt
- `toolDispatcher.js` — `dispatch(name, args, context)` runs any of them
- `config/gemini.js` — `generateContent()`, `extractText()`, `extractFunctionCalls()`
- `ranking.js` — the weighted scorer (0.4 semantic / 0.3 budget / 0.2 discount / 0.1 novelty)

`runGeminiLoop()` in that file already implements the ask → call tools → feed
results back → answer loop and works as-is. Replace or extend it freely, but keep
`runChat`'s signature and return shape — the controller and the frontend both
depend on them. The contract is documented at the top of the file.

Tools available: `searchProducts`, `getOrderHistory`, `checkInventory`,
`compareProducts`, `whatIfBudget`, `optimizeCart`, `listDiscounts`.

Two things the ranking layer does that are worth knowing:

- A stated budget is a **hard filter**, not a score. Over-budget products are
  excluded entirely, because a large discount could otherwise float a ₹1.2L
  laptop to the top of an ₹80k search.
- `searchProducts` folds the don't-buy check into its own response as
  `recentPurchase`. It costs no extra model call — just mention it in the reply.

Embeddings are cached in-process and degrade to `null` on any failure, so a blown
quota mid-demo downgrades search to keyword matching instead of breaking it.
