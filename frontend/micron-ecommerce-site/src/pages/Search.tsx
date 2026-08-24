import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { getProducts, getProductById, searchProductsRanked } from '../api/endpoints';
import { getProductReviews, type RatingSummary } from '../api/reviews';
import type { Product, RankedProduct, SearchResponse } from '../types/api-types';

export default function Search() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'discount' | 'popular'>('price_asc');
  
  const [standardProducts, setStandardProducts] = useState<Product[]>([]);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [ratingsMap, setRatingsMap] = useState<Record<string, RatingSummary>>({});
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [useRankedSearch, setUseRankedSearch] = useState<boolean>(false);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        let itemsToProcess: Array<{ id: string }> = [];

        if (useRankedSearch && searchTerm.trim()) {
          const res = await searchProductsRanked(searchTerm);
          setSearchResponse(res);
          setStandardProducts([]);
          itemsToProcess = res.products || [];

          // Fetch full product details to get image URLs for ranked products
          const uniqueRankedIds = Array.from(new Set(itemsToProcess.map((p) => p.id)));
          const productDetailResults = await Promise.allSettled(
            uniqueRankedIds.map((id) => getProductById(id))
          );

          const newImagesMap: Record<string, string> = {};
          productDetailResults.forEach((result, idx) => {
            if (result.status === 'fulfilled' && result.value?.imageUrl) {
              const prodId = uniqueRankedIds[idx];
              newImagesMap[prodId] = result.value.imageUrl;
            }
          });
          setImagesMap(newImagesMap);

        } else {
          setSearchResponse(null);
          const res = await getProducts({
            search: searchTerm,
            category: category,
            maxPrice,
            sort,
          });
          setStandardProducts(res.items || []);
          itemsToProcess = res.items || [];
          setImagesMap({});
        }

        // Fetch rating summaries in parallel for all returned products
        if (itemsToProcess.length > 0) {
          const uniqueIds = Array.from(new Set(itemsToProcess.map((p) => p.id)));
          const reviewResults = await Promise.allSettled(
            uniqueIds.map((id) => getProductReviews(id, 1, 0))
          );

          const newRatingsMap: Record<string, RatingSummary> = {};
          reviewResults.forEach((result, idx) => {
            if (result.status === 'fulfilled' && result.value?.summary) {
              const prodId = uniqueIds[idx];
              newRatingsMap[prodId] = result.value.summary;
            }
          });
          setRatingsMap(newRatingsMap);
        } else {
          setRatingsMap({});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, category, maxPrice, sort, useRankedSearch]);

  const renderRating = (productId: string) => {
    const summary = ratingsMap[productId];
    const hasRating = summary && summary.average !== null;

    return (
      <div className="flex items-center space-x-1 mt-1 text-xs">
        {hasRating ? (
          <>
            <span className="text-amber-400 font-bold">★ {summary.average?.toFixed(1)}</span>
            <span className="text-slate-400 text-[10px]">({summary.count})</span>
          </>
        ) : (
          <span className="text-slate-400 text-[10px] italic">No ratings</span>
        )}
      </div>
    );
  };

  const isRankedEmpty = useRankedSearch && searchResponse && searchResponse.products.length === 0;
  const isStandardEmpty = !useRankedSearch && standardProducts.length === 0;
  const isEmpty = isRankedEmpty || isStandardEmpty;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <aside className="bg-white border border-slate-200 rounded-xl p-5 h-fit">
        <h3 className="font-semibold text-sm mb-4 border-b border-slate-100 pb-2">Filters</h3>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 mb-1">Search Mode</label>
            <button
              onClick={() => setUseRankedSearch(!useRankedSearch)}
              className={`w-full py-1.5 px-3 rounded-lg border text-left font-medium transition ${
                useRankedSearch
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {useRankedSearch ? '⚡ AI Vector Search' : '🔍 Standard Filter'}
            </button>
          </div>

          {!useRankedSearch && (
            <>
              <div>
                <label className="block text-slate-600 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none bg-white"
                >
                  <option value="">All Categories</option>
                  <option value="laptops">Laptops</option>
                  <option value="mobiles">Mobiles</option>
                  <option value="earphones">Earphones</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Sort By</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none bg-white"
                >
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="discount">Discount</option>
                  <option value="popular">Popularity</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Max Price: ₹{maxPrice}</label>
                <input
                  type="range"
                  min="1000"
                  max="150000"
                  step="1000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </>
          )}
        </div>
      </aside>

      <main className="md:col-span-3">
        <input
          type="text"
          placeholder={useRankedSearch ? "Describe what you need (e.g., 'gaming laptop under 80k')..." : "Search products..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-indigo-600 text-sm bg-white"
        />

        {/* Surface Recent Purchase Warning */}
        {searchResponse?.recentPurchase && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex justify-between items-center">
            <div>
              <p className="font-semibold">Recent Purchase Warning</p>
              <p className="mt-0.5">
                You bought <strong>{searchResponse.recentPurchase.productName}</strong> {searchResponse.recentPurchase.daysAgo} days ago.
              </p>
            </div>
            <span className="text-[10px] bg-amber-200 px-2 py-1 rounded font-medium">Notice</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Searching catalog...</div>
        ) : isEmpty ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
            <div className="text-3xl text-slate-300">🔍</div>
            <h3 className="text-sm font-semibold text-slate-800">No products found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn't find anything matching your filters or search term. Try adjusting your search query, increasing max price, or changing categories.
            </p>
          </div>
        ) : useRankedSearch && searchResponse ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResponse.products.map((prod: RankedProduct) => {
              const imageUrl = imagesMap[prod.id];
              return (
                <Link
                  key={prod.id}
                  to={`/product/${prod.id}`}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-600 transition block flex flex-col justify-between group"
                >
                  <div>
                    <div className="h-32 bg-slate-100 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs overflow-hidden">
                      {imageUrl ? (
                        <img src={imageUrl} alt={prod.name} className="h-full w-full object-cover" />
                      ) : (
                        'No Image'
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">{prod.name}</p>
                    {renderRating(prod.id)}
                  </div>
                  <div className="flex items-center space-x-2 mt-3">
                    <span className="text-xs text-indigo-600 font-semibold">₹{prod.price}</span>
                    {prod.discountPercent > 0 && (
                      <span className="text-[10px] text-slate-400 line-through">₹{prod.listPrice}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {standardProducts.map((prod: Product) => (
              <Link
                key={prod.id}
                to={`/product/${prod.id}`}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-600 transition block flex flex-col justify-between group"
              >
                <div>
                  <div className="h-32 bg-slate-100 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs overflow-hidden">
                    {prod.imageUrl ? (
                      <img src={prod.imageUrl} alt={prod.name} className="h-full w-full object-cover" />
                    ) : (
                      'No Image'
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">{prod.name}</p>
                  {renderRating(prod.id)}
                </div>
                <div className="flex items-center space-x-2 mt-3">
                  <span className="text-xs text-indigo-600 font-semibold">₹{prod.finalPrice}</span>
                  {prod.discountPercent > 0 && (
                    <span className="text-[10px] text-slate-400 line-through">₹{prod.price}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}