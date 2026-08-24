import React, { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';

const Search: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [price, setPrice] = useState<number>(100);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <aside className="bg-white border border-slate-200 rounded-xl p-5 h-fit">
        <h3 className="font-semibold text-sm mb-4 border-b border-slate-100 pb-2">Filters</h3>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 mb-1">Category</label>
            <select className="w-full border border-slate-200 rounded-lg p-2 outline-none">
              <option value="all">All Categories</option>
              <option value="apparel">Apparel</option>
              <option value="electronics">Electronics</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Max Price: ${price}</label>
            <input 
              type="range" 
              min="0" 
              max="500" 
              value={price}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(Number(e.target.value))}
              className="w-full accent-indigo-600" 
            />
          </div>
        </div>
      </aside>

      <main className="md:col-span-3">
        <input 
          type="text" 
          placeholder="Search products..." 
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-6 outline-none focus:border-indigo-600 text-sm bg-white"
        />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Link 
              key={i} 
              to={`/product/${i}`}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-600 transition block"
            >
              <div className="h-32 bg-slate-100 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs">Image</div>
              <p className="text-sm font-medium text-slate-800">Search Result #{i}</p>
              <p className="text-xs text-slate-500 mt-1">$69.00</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Search;