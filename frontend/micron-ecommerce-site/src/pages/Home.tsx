import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getProducts, getDiscountedProducts } from '../api/endpoints';
import { getProductReviews, type RatingSummary } from '../api/reviews';
import type { Product } from '../types/api-types';

export default function Home() {
  const [popular, setPopular] = useState<Product[]>([]);
  const [discounted, setDiscounted] = useState<Product[]>([]);
  const [thirdRowProducts, setThirdRowProducts] = useState<Product[]>([]);
  const [ratingsMap, setRatingsMap] = useState<Record<string, RatingSummary>>({});
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch product rows (Row 1: Most Popular, Row 2: Discounted, Row 3: Standard Product List)
        const [popRes, discRes, row3Res] = await Promise.all([
          getProducts({ limit: 4, sort: 'popular' }),
          getDiscountedProducts({ limit: 4 }),
          getProducts({ limit: 4, sort: 'price_desc' }),
        ]);

        const popItems = popRes.items || [];
        const discItems = discRes.items || [];
        const row3Items = row3Res.items || [];

        setPopular(popItems);
        setDiscounted(discItems);
        setThirdRowProducts(row3Items);

        // 2. Extract all unique product IDs to fetch ratings in parallel
        const allProducts = [...popItems, ...discItems, ...row3Items];
        const uniqueIds = Array.from(new Set(allProducts.map((p) => p.id)));

        // 3. Fetch review summaries for all unique products
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load home products');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const renderProductGrid = (items: Product[]) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((prod) => {
        const ratingSummary = ratingsMap[prod.id];
        const hasRating = ratingSummary && ratingSummary.average !== null;

        return (
          <Link
            key={prod.id}
            to={`/product/${prod.id}`}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-600 transition block group flex flex-col justify-between"
          >
            <div>
              <div className="h-40 bg-slate-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {prod.imageUrl ? (
                  <img src={prod.imageUrl} alt={prod.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-slate-400 text-xs">No Image</span>
                )}
              </div>

              <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">
                {prod.name}
              </p>

              {/* Rating Summary Display */}
              <div className="flex items-center space-x-1 mt-1 text-xs">
                {hasRating ? (
                  <>
                    <span className="text-amber-400 font-bold">★ {ratingSummary.average?.toFixed(1)}</span>
                    <span className="text-slate-400 text-[10px]">({ratingSummary.count})</span>
                  </>
                ) : (
                  <span className="text-slate-400 text-[10px] italic">No ratings</span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 mt-2">
              <span className="text-xs font-semibold text-slate-900">₹{prod.finalPrice}</span>
              {prod.discountPercent > 0 && (
                <span className="text-[10px] text-slate-400 line-through">₹{prod.price}</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );

  if (loading) return <div className="text-center py-12 text-xs text-slate-400">Loading recommendations...</div>;
  if (error) return <div className="text-center py-12 text-xs text-red-500">{error}</div>;

  return (
    <div className="space-y-12">
      {/* Row 1: Most Popular */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Most Popular</h2>
        {renderProductGrid(popular)}
      </section>

      {/* Row 2: Discounted Deals */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Discounted Deals</h2>
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Sale</span>
        </div>
        {renderProductGrid(discounted)}
      </section>

      {/* Row 3: All Products / Featured (Replaced What's New) */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Featured Collection</h2>
        {renderProductGrid(thirdRowProducts)}
      </section>
    </div>
  );
}