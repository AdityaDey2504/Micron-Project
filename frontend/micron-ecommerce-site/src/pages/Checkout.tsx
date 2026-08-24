import React, { type SubmitEvent } from 'react';

const Checkout: React.FC = () => {
  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      <form onSubmit={handleSubmit} className="md:col-span-2 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-sm mb-4">Shipping Information</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <input type="text" placeholder="First Name" className="border border-slate-200 rounded-lg p-2.5 outline-none" required />
            <input type="text" placeholder="Last Name" className="border border-slate-200 rounded-lg p-2.5 outline-none" required />
            <input type="text" placeholder="Address" className="col-span-2 border border-slate-200 rounded-lg p-2.5 outline-none" required />
          </div>
        </div>
      </form>
      <div className="bg-white border border-slate-200 rounded-xl p-6 h-fit">
        <h2 className="font-semibold text-sm mb-3">Order Summary</h2>
        <div className="flex justify-between text-xs text-slate-600 py-2 border-b border-slate-100">
          <span>Subtotal</span>
          <span>$138.00</span>
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-xs font-semibold mt-4 hover:bg-indigo-700 transition">
          Pay Now
        </button>
      </div>
    </div>
  );
};

export default Checkout;