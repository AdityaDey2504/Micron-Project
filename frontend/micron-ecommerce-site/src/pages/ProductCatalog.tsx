import React from 'react';

const ProductCatalog: React.FC = () => {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold mb-4">All Products</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="h-36 bg-slate-100 rounded-lg mb-2"></div>
              <p className="text-sm font-medium">Catalog Item #{i}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-6">
        <h2 className="text-md font-semibold text-indigo-900 mb-3">AI Recommendations For You</h2>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-indigo-100 rounded-lg p-3">
              <p className="text-xs font-medium">Recommended #{i}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductCatalog;