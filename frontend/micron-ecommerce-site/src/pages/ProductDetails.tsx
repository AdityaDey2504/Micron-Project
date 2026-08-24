import React from 'react';

const ProductDetails: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="h-80 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
          Product Main Image
        </div>
        <div className="flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Minimalist Desk Lamp</h1>
            <p className="text-xl font-medium text-indigo-600 mb-4">$89.00</p>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Designed for modern workspaces. Features warm adjustable lighting, touch controls, and an anodized aluminum frame.
            </p>
          </div>
          <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-slate-800 transition">
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;