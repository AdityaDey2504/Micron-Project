import React from 'react';
import { Link } from 'react-router';
import { type CatalogCategory } from '../types';

const categories: CatalogCategory[] = [
  { id: 'tech', name: 'Tech & Electronics', description: 'Minimalist gadgets, acoustics, and desktop setups.', itemCount: 42 },
  { id: 'fashion', name: 'Apparel & Accessories', description: 'Everyday essentials and timeless garments.', itemCount: 88 },
  { id: 'home', name: 'Home & Living', description: 'Functional decor and workspace architecture.', itemCount: 29 },
];

const CatalogOverview: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Product Catalogs</h1>
        <p className="text-xs text-slate-500 mt-1">Explore our curated collections by department.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <Link 
            key={cat.id} 
            to={`/products/${cat.id}`} 
            className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-600 hover:shadow-sm transition"
          >
            <div className="h-32 bg-slate-100 rounded-xl mb-4 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50/50 transition">
              <span className="text-xs font-semibold text-slate-500 group-hover:text-indigo-600">{cat.name} Preview</span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition">{cat.name}</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{cat.description}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
              <span>{cat.itemCount} Products</span>
              <span className="font-semibold text-indigo-600">Browse Catalog &rarr;</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CatalogOverview;