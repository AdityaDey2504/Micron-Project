import React from 'react';
import { useParams, Link } from 'react-router';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-4xl mx-auto space-y-6">
      <Link to="/" className="text-xs text-indigo-600 font-medium hover:underline inline-block">
        &larr; Back to browsing
      </Link>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="h-80 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
          Product Image #{id}
        </div>
        <div className="flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Minimalist Desk Item #{id}</h1>
            <p className="text-xl font-medium text-indigo-600 mb-4">$89.00</p>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Designed for modern workspaces. Features sleek materials, premium durability, and ergonomic geometry.
            </p>
          </div>
          <Link 
            to="/checkout" 
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-slate-800 transition text-center block"
          >
            Buy Item #{id} Now
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;