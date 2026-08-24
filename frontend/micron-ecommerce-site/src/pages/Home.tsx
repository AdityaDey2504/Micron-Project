import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getProducts, getDiscountedProducts } from '../api/endpoints';
import type { Product } from '../types/api-types';

export default function Home() {
  const [popular, setPopular] = useState<Product[]>([]);
  const [discounted, setDiscounted] = useState<Product[]>([]);
  const [whatsNew, setWhatsNew] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [popRes, discRes, newRes] = await Promise.all([
          getProducts({ limit: 4, sort: 'popular' }),
          getDiscountedProducts({ limit: 4 }),
          getProducts({ limit: 4, sort: 'price_desc' }),
        ]);

        setPopular(popRes.items);
        setDiscounted(discRes.items);
        setWhatsNew(newRes.items);
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
      {items.map((prod) => (
        <Link
          key={prod.id}
          to={`/product/${prod.id}`}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-600 transition block group"
        >
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
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs font-semibold text-slate-900">₹{prod.finalPrice}</span>
            {prod.discountPercent > 0 && (
              <span className="text-[10px] text-slate-400 line-through">₹{prod.price}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );

  if (loading) return <div className="text-center py-12 text-xs text-slate-400">Loading recommendations...</div>;
  if (error) return <div className="text-center py-12 text-xs text-red-500">{error}</div>;

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Most Popular</h2>
        {renderProductGrid(popular)}
      </section>

      <section>
        <div className="flex items-center space-x-2 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Discounted Deals</h2>
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Sale</span>
        </div>
        {renderProductGrid(discounted)}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">What's New</h2>
        {renderProductGrid(whatsNew)}
      </section>
    </div>
  );
}