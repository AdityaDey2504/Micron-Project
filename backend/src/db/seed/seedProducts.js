/**
 * Loads the Flipkart electronics dataset into products (+ inventory), and can
 * backfill products.embedding once that column exists.
 *
 *   node src/db/seed/seedProducts.js ./data/flipkart.csv
 *   node src/db/seed/seedProducts.js --embeddings-only
 *
 * The DB owner owns the schema; this script only writes rows. Column names
 * come from db/tables.js, so if the schema shifts, fix that file, not this
 * one. Header names in the CSV are matched loosely because Kaggle exports
 * spell them inconsistently.
 */
const fs = require('fs');
const supabase = require('../../config/supabase');
const { TABLES, COLUMNS, generateId } = require('../tables');
const { embedBatch, productToEmbeddingText } = require('../../services/ai/embeddings');

const P = COLUMNS.products;
const O = COLUMNS.productsOptional;
const I = COLUMNS.inventory;

const BATCH_SIZE = 100;

/** Minimal CSV parser - handles quoted fields and embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const normalise = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Finds a column by any of several possible header spellings. */
function pick(record, ...candidates) {
  for (const candidate of candidates) {
    const key = normalise(candidate);
    if (record[key] !== undefined && record[key] !== '') return record[key];
  }
  return undefined;
}

function toNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function rowToProduct(record) {
  const name = pick(record, 'product_name', 'title', 'name', 'product');
  const price = toNumber(pick(record, 'discount_price', 'selling_price', 'price'));
  if (!name || price == null) return null;

  const mrp = toNumber(pick(record, 'actual_price', 'original_price', 'mrp', 'retail_price'));

  const product = {
    [P.id]: generateId('PROD'), // product_id is a text PK with no default
    [P.name]: String(name).slice(0, 300),
    [P.price]: price,
    [P.category]: pick(record, 'category', 'main_category', 'product_category') || 'Electronics',
    [P.description]: pick(record, 'description', 'about_product', 'details') || null,
    [P.imageUrl]: pick(record, 'image', 'image_url', 'img_link') || null,
  };

  // Discount is stored as a percentage; derive it from MRP when the dataset
  // only gives the two prices.
  if (mrp && mrp > price) {
    product[P.discountPercent] = Math.round(((mrp - price) / mrp) * 100);
  }

  // Optional dataset columns - only sent when present, so an insert does not
  // fail against a schema that does not have them.
  const optional = {
    [O.rating]: toNumber(pick(record, 'rating', 'ratings', 'average_rating')),
    [O.ratingCount]: toNumber(pick(record, 'rating_count', 'no_of_ratings', 'reviews')),
    [O.mrp]: mrp,
    [O.reviewCount]: toNumber(pick(record, 'review_count', 'reviews')),
    [O.productUrl]: pick(record, 'link', 'product_url', 'url'),
    [O.offer]: pick(record, 'offer', 'offers'),
    [O.exchangeOffer]: pick(record, 'exchange_offer'),
  };

  // searchable_text is what keyword search hits, so build it here rather than
  // leaving the column empty.
  product[P.searchableText] = [product[P.name], product[P.category], product[P.description]]
    .filter(Boolean)
    .join(' ')
    .slice(0, 2000);
  for (const [key, value] of Object.entries(optional)) {
    if (value != null && value !== '') product[key] = value;
  }

  return { product, stock: Math.floor(Math.random() * 40) + 5 };
}

async function insertProducts(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at ${csvPath}`);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const header = rows.shift().map(normalise);

  const parsed = rows
    .map((cells) => {
      const record = {};
      header.forEach((key, index) => {
        record[key] = (cells[index] ?? '').trim();
      });
      return rowToProduct(record);
    })
    .filter(Boolean);

  console.log(`parsed ${parsed.length} products from ${csvPath}`);

  let inserted = 0;
  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const batch = parsed.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from(TABLES.products)
      .insert(batch.map((b) => b.product))
      .select(P.id);

    if (error) {
      // A schema mismatch shows up on the very first batch; say so clearly
      // rather than printing the same error 50 times.
      console.error(`batch at row ${i} failed:`, error.message);
      if (i === 0) {
        console.error(
          'First batch failed - the column names in src/db/tables.js probably do not match the real schema yet. Fix that file and re-run.'
        );
        return 0;
      }
      continue;
    }

    inserted += data.length;

    // Give each new product an inventory row so stock and checkout work.
    const stockRows = data.map((productRow, index) => ({
      [I.productId]: productRow[P.id],
      [I.stock]: batch[index].stock,
    }));
    const { error: stockError } = await supabase.from(TABLES.inventory).insert(stockRows);
    if (stockError) console.warn(`inventory rows for batch ${i} failed:`, stockError.message);

    console.log(`inserted ${inserted}/${parsed.length}`);
  }

  return inserted;
}

/**
 * Backfills products.embedding. Skipped automatically while that column does
 * not exist - it is on the DB owner's list, not a blocker for everything else.
 */
async function backfillEmbeddings() {
  const { data, error } = await supabase
    .from(TABLES.products)
    .select('*')
    .is(P.embedding, null)
    .limit(500);

  if (error) {
    console.warn('Skipping embeddings - products.embedding is not available yet:', error.message);
    return;
  }
  if (!data?.length) {
    console.log('No products need embedding.');
    return;
  }

  console.log(`embedding ${data.length} products...`);
  const texts = data.map((row) =>
    row[P.searchableText] ||
      productToEmbeddingText({
        name: row[P.name],
        category: row[P.category],
        description: row[P.description],
      })
  );

  const vectors = await embedBatch(texts);

  let done = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (!vectors[i]) continue;
    const { error: updateError } = await supabase
      .from(TABLES.products)
      .update({ [P.embedding]: vectors[i] })
      .eq(P.id, data[i][P.id]);
    if (!updateError) done += 1;
  }
  console.log(`embedded ${done}/${data.length}`);
}

async function run() {
  const args = process.argv.slice(2);
  const embeddingsOnly = args.includes('--embeddings-only');

  if (!embeddingsOnly) {
    const csvPath = args.find((a) => !a.startsWith('--')) || './data/flipkart.csv';
    await insertProducts(csvPath);
  }
  await backfillEmbeddings();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
