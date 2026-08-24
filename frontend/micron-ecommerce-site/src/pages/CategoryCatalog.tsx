import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { getProducts } from '../api/endpoints';
import type { Product } from '../types/api-types';

export default function CategoryCatalog() {
  const { category } = useParams<{ category: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (category) {
      getProducts({ category })
        .then((res) => setProducts(res.items))
        .finally(() => setLoading(false));
    }
  }, [category]);

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
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((prod) => (
            <Link key={prod.id} to={`/product/${prod.id}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition block">
              <div className="h-36 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-slate-400 text-xs overflow-hidden">
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
    </div>
  );
}