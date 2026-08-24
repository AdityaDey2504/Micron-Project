import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { getProducts } from '../api/endpoints';
import { getProductReviews, type RatingSummary } from '../api/reviews';
import type { Product } from '../types/api-types';

export default function CategoryCatalog() {
  const { category } = useParams<{ category: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [ratingsMap, setRatingsMap] = useState<Record<string, RatingSummary>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) return;

    const fetchCategoryData = async () => {
      setLoading(true);
      try {
        const res = await getProducts({ category });
        const fetchedProducts = res.items || [];
        setProducts(fetchedProducts);

        if (fetchedProducts.length > 0) {
          const uniqueIds = Array.from(new Set(fetchedProducts.map((p) => p.id)));
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

    fetchCategoryData();
  }, [category]);

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

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <Link to="/products" className="hover:text-slate-600">Catalogs</Link>
        <span>/</span>
        <span className="capitalize text-slate-800 font-medium">{category}</span>
      </div>

      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold text-slate-900 capitalize">{category} Catalog</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <div className="text-3xl text-slate-300">📦</div>
          <h3 className="text-sm font-semibold text-slate-800">No products found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no products available in the <span className="capitalize font-medium">{category}</span> category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((prod) => (
            <Link 
              key={prod.id} 
              to={`/product/${prod.id}`} 
              className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition block flex flex-col justify-between group"
            >
              <div>
                <div className="h-36 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-slate-400 text-xs overflow-hidden">
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
    </div>
  );
}