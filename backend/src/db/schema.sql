-- ===========================================================================
-- CHANGES THE BACKEND NEEDS - for the DB owner to run in the Supabase SQL editor.
--
-- This is NOT the schema; the schema is owned by the DB teammate. This file
-- lists only what the API layer needs on top of it, in the order it has to
-- run. Everything here is additive - no existing column is dropped or renamed.
--
-- The column names the backend uses all live in src/db/tables.js. If any name
-- below is changed, change it there too and nothing else needs touching.
-- ===========================================================================


-- Checked against the live schema pulled from Supabase. products.product_id
-- exists with a primary key and all foreign keys are valid, so the earlier
-- concern about that is resolved - nothing to do there.


-- ---------------------------------------------------------------------------
-- 1. BLOCKER: nobody can log in.
--
--    The statement requires customer registration and login plus a separate
--    admin role, but customers has no email, no password and no role. The API
--    hashes passwords with bcrypt and issues its own JWT, so it needs these
--    three columns and nothing else.
-- ---------------------------------------------------------------------------

alter table customers add column if not exists email text;
alter table customers add column if not exists password_hash text;
alter table customers add column if not exists role text not null default 'customer';

-- Emails must be unique, and are compared case-insensitively at login.
create unique index if not exists idx_customers_email_lower
    on customers (lower(email));

-- Optional: seeded customers from the dataset have no email, so they cannot
-- log in. `npm run seed:users` creates two accounts that can:
--     admin@aura.dev / admin123
--     demo@aura.dev  / demo123


-- ---------------------------------------------------------------------------
-- 2. Semantic search (the chatbot's recommend loop).
--
--    Until this runs, product search silently falls back to keyword matching
--    on searchable_text - the chatbot still works, just less cleverly. This
--    is safe to do last.
-- ---------------------------------------------------------------------------

create extension if not exists vector;

-- 768 dimensions = Gemini text-embedding-004. Change both here and in
-- GEMINI_EMBEDDING_MODEL if a different model is used.
alter table products add column if not exists embedding vector(768);

-- Backfill the vectors with:  node src/db/seed/seedProducts.js --embeddings-only

-- Approximate-nearest-neighbour index. Build it AFTER backfilling, since
-- ivfflat needs existing rows to pick its cluster centres.
create index if not exists idx_products_embedding
    on products using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- The function the API calls for semantic search. Returns whole product rows
-- plus a similarity score, so the ranking layer has everything it needs.
create or replace function match_products(
    query_embedding vector(768),
    match_count int default 20,
    filter_category text default null,
    max_price numeric default null
)
returns table (
    product_id text,
    category text,
    title text,
    product_url text,
    image_url text,
    rating numeric,
    rating_count integer,
    review_count integer,
    price numeric,
    original_price numeric,
    discount_percent numeric,
    offer text,
    exchange_offer text,
    key_features text,
    searchable_text text,
    similarity float
)
language sql stable
as $$
    select
        p.product_id, p.category, p.title, p.product_url, p.image_url,
        p.rating, p.rating_count, p.review_count, p.price, p.original_price,
        p.discount_percent, p.offer, p.exchange_offer, p.key_features,
        p.searchable_text,
        1 - (p.embedding <=> query_embedding) as similarity
    from products p
    where p.embedding is not null
      and (filter_category is null or p.category ilike filter_category)
      and (max_price is null or p.price <= max_price)
    order by p.embedding <=> query_embedding
    limit match_count;
$$;


-- ---------------------------------------------------------------------------
-- 3. Two more indexes.
--
--    The four already written cover the joins. These cover the two remaining
--    hot filters: the 60-day "did they buy this recently" window, and every
--    budget-filtered product search.
-- ---------------------------------------------------------------------------

create index if not exists idx_orders_order_date on orders (order_date desc);
create index if not exists idx_products_price on products (price);


-- ---------------------------------------------------------------------------
-- 4. Row Level Security.
--
--    The API connects with the service role key, which bypasses RLS, so
--    nothing here is required for the backend to work. But if RLS is enabled
--    on these tables and the frontend ever queries Supabase directly, note
--    that customers.password_hash must never be readable by the anon key.
-- ---------------------------------------------------------------------------
