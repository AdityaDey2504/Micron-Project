import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getCategories } from '../api/endpoints';
import type { Category } from '../types/api-types';

export default function CatalogOverview() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-xs text-slate-400">Loading departments...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Product Catalogs</h1>
        <p className="text-xs text-slate-500 mt-1">Explore our collections by department.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={`/products/${cat.id}`}
            className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-600 hover:shadow-sm transition"
          >
            <div className="h-32 bg-slate-100 rounded-xl mb-4 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50/50 transition">
              <span className="text-xs font-semibold text-slate-500 group-hover:text-indigo-600 capitalize">
                {cat.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-900 capitalize group-hover:text-indigo-600 transition">
                {cat.name}
              </h2>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {cat.itemCount} items
              </span>
            </div>
            <div className="mt-4 flex items-center justify-end text-xs text-indigo-600 font-semibold border-t border-slate-100 pt-3">
              <span>Browse Category &rarr;</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}