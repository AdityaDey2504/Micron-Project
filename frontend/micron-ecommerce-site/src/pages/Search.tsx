import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { getProducts, searchProductsRanked } from '../api/endpoints';
import type { Product, RankedProduct, SearchResponse } from '../types/api-types';

export default function Search() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'discount' | 'popular'>('price_asc');
  
  const [standardProducts, setStandardProducts] = useState<Product[]>([]);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [useRankedSearch, setUseRankedSearch] = useState<boolean>(false);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        if (useRankedSearch && searchTerm.trim()) {
          const res = await searchProductsRanked(searchTerm);
          setSearchResponse(res);
        } else {
          setSearchResponse(null);
          const res = await getProducts({
            search: searchTerm,
            category: category,
            maxPrice,
            sort,
          });
          setStandardProducts(res.items);
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
        ) : useRankedSearch && searchResponse ? (
          <div className="grid grid-cols-3 gap-4">
            {searchResponse.products.map((prod: RankedProduct) => (
              <Link
                key={prod.id}
                to={`/product/${prod.id}`}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-600 transition block"
              >
                <div className="h-32 bg-slate-100 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs">
                  Image
                </div>
                <p className="text-sm font-medium text-slate-800 truncate">{prod.name}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-indigo-600 font-semibold">₹{prod.price}</span>
                  {prod.discountPercent > 0 && (
                    <span className="text-[10px] text-slate-400 line-through">₹{prod.listPrice}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {standardProducts.map((prod: Product) => (
              <Link
                key={prod.id}
                to={`/product/${prod.id}`}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-600 transition block"
              >
                <div className="h-32 bg-slate-100 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs overflow-hidden">
                  {prod.imageUrl ? <img src={prod.imageUrl} alt={prod.name} className="h-full w-full object-cover" /> : 'Image'}
                </div>
                <p className="text-sm font-medium text-slate-800 truncate">{prod.name}</p>
                <div className="flex items-center space-x-2 mt-1">
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