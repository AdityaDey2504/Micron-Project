import React from 'react';
import { useParams, Link } from 'react-router';

const CategoryCatalog: React.FC = () => {
  const { category } = useParams<{ category: string }>();

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <Link to="/products" className="hover:text-slate-600">Catalogs</Link>
        <span>/</span>
        <span className="capitalize text-slate-800 font-medium">{category}</span>
      </div>

      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold text-slate-900 capitalize">{category} Catalog</h1>
        <p className="text-xs text-slate-500 mt-1">Showing all products listed in {category}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Link key={i} to={`/product/${i}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition">
            <div className="h-36 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-slate-400 text-xs">
              {category} Item #{i}
            </div>
            <p className="text-sm font-medium text-slate-800 capitalize">{category} Item #{i}</p>
            <p className="text-xs text-slate-500 mt-1">$99.00</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CategoryCatalog;