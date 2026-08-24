import React, { useState, type SubmitEvent } from 'react';
import { type AdminTab } from '../types';

const Admin: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('manage');

  const tabs: AdminTab[] = ['manage', 'add', 'sold', 'inventory'];

  const handleAddProduct = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-slate-200 pb-2 text-xs font-medium">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md capitalize transition ${
              tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {tab === 'add' && (
          <form onSubmit={handleAddProduct} className="max-w-md space-y-3 text-xs">
            <h3 className="font-semibold text-sm text-slate-800">Add New Product</h3>
            <input type="text" placeholder="Title" className="w-full border border-slate-200 rounded-lg p-2 outline-none" required />
            <input type="number" step="0.01" placeholder="Price" className="w-full border border-slate-200 rounded-lg p-2 outline-none" required />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium">Create Product</button>
          </form>
        )}

        {(tab === 'manage' || tab === 'sold' || tab === 'inventory') && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2">Item ID</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Stock / Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3">#PRD-101</td>
                  <td className="py-3 font-medium">Minimal Lamp</td>
                  <td className="py-3">24 units</td>
                  <td className="py-3">
                    <button className="text-red-500 hover:underline">Delete</button>
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

export default Admin;