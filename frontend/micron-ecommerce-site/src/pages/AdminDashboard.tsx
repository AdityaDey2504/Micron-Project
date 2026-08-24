import React, { useState, type SubmitEvent } from 'react';
import { type AdminTab } from '../types';

const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('manage');

  const tabs: AdminTab[] = ['manage', 'add', 'sold', 'inventory'];

  const handleAddProduct = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-6">
      {/* Sub Navigation */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3 text-xs font-medium">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md capitalize transition ${
              tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Admin Panel Body */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        {tab === 'add' && (
          <form onSubmit={handleAddProduct} className="max-w-md space-y-3 text-xs">
            <h3 className="font-semibold text-sm text-slate-100 mb-2">Add New Catalog Product</h3>
            <div>
              <label className="block text-slate-400 mb-1">Product Title</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" required />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Catalog Department</label>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none">
                <option value="tech">Tech & Electronics</option>
                <option value="fashion">Apparel & Accessories</option>
                <option value="home">Home & Living</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Price ($)</label>
              <input type="number" step="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" required />
            </div>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition">
              Create Entry
            </button>
          </form>
        )}

        {(tab === 'manage' || tab === 'sold' || tab === 'inventory') && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-medium">
                  <th className="py-2.5">Item ID</th>
                  <th className="py-2.5">Title</th>
                  <th className="py-2.5">Catalog</th>
                  <th className="py-2.5">Stock / Status</th>
                  <th className="py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                <tr>
                  <td className="py-3 font-mono text-slate-400">#PRD-101</td>
                  <td className="py-3 font-medium text-slate-200">Minimal Desk Lamp</td>
                  <td className="py-3 text-slate-400">Home & Living</td>
                  <td className="py-3 text-emerald-400">24 in stock</td>
                  <td className="py-3">
                    <button className="text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;