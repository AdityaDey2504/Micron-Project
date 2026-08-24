import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { checkoutOrder, optimizeCart } from '../api/endpoints';
import type { CartOptimizeResponse } from '../types/api-types';

export default function Checkout() {
  const { cart, cartPrice, clearCart, removeFromCart, updateQuantity } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<CartOptimizeResponse | null>(null);

  const navigate = useNavigate();

  const handleCheckout = async (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
  if (cart.length === 0) return;

  setSubmitting(true);
  setError(null);

  try {
    await checkoutOrder(cart);
    clearCart();
    navigate('/customer');
  } catch (err: any) {
    setError(err.message || 'Checkout failed.');
  } finally {
    setSubmitting(false);
  }
};

  const handleOptimizeCart = async () => {
    setOptimizing(true);
    try {
      const res = await optimizeCart(cart);
      setOptimization(res);
    } catch (err) {
      console.error(err);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      <div className="md:col-span-2 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs">{error}</div>}

        {/* Swap Suggestions Banner */}
        {optimization && optimization.suggestions.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-indigo-900">
                ⚡ Swaps Available! Save ₹{optimization.totalSavings}
              </span>
              <button onClick={() => setOptimization(null)} className="text-indigo-400 hover:text-indigo-900">✕</button>
            </div>
            {optimization.suggestions.map((s, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-indigo-100 flex justify-between items-center">
                <div>
                  <p className="text-slate-500 line-through">{s.from.name} (₹{s.from.finalPrice})</p>
                  <p className="font-medium text-slate-800">{s.to.name} (₹{s.to.finalPrice})</p>
                </div>
                <button
                  onClick={() => {
                    removeFromCart(s.from.productId);
                    // Add suggested replacement item
                  }}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-indigo-700"
                >
                  Swap & Save ₹{s.saves}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-sm mb-4">Cart Items</h2>
          {cartPrice?.items.map((item) => (
            <div key={item.productId} className="flex justify-between items-center py-3 border-b border-slate-100 text-xs">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{item.name}</p>
                <p className="text-slate-400">Unit: ₹{item.unitPrice} {item.discountPercent > 0 && <span className="line-through">₹{item.listPrice}</span>}</p>
                {!item.inStock && <p className="text-red-500 font-semibold mt-0.5">Item Out of Stock</p>}
              </div>

              <div className="flex items-center space-x-4">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                  className="w-12 border border-slate-200 rounded px-1.5 py-1 text-center"
                />
                <span className="font-semibold text-slate-900 w-16 text-right">₹{item.lineTotal}</span>
                <button onClick={() => removeFromCart(item.productId)} className="text-red-500 font-bold">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 h-fit space-y-4">
        <h2 className="font-semibold text-sm border-b border-slate-100 pb-2">Order Summary</h2>

        <div className="text-xs space-y-2">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>₹{cartPrice?.subtotal || 0}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Savings</span>
            <span className="text-emerald-600">-₹{cartPrice?.savings || 0}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-2 text-sm">
            <span>Total Payable</span>
            <span>₹{cartPrice?.total || 0}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOptimizeCart}
          disabled={optimizing || cart.length === 0}
          className="w-full bg-indigo-50 text-indigo-700 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition"
        >
          {optimizing ? 'Checking Deals...' : '⚡ Optimize Cart Price'}
        </button>

        <button
          onClick={handleCheckout}
          disabled={submitting || cart.length === 0 || cartPrice?.hasUnavailableItems}
          className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
        >
          {submitting ? 'Processing...' : 'Place Order'}
        </button>
      </div>
    </div>
  );
}