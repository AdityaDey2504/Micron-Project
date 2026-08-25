import React, { useState, useEffect, useCallback } from 'react';
import { type AdminTab } from '../types';

// Configuration
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Defensive API Fetcher
const safeApiFetch = async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('aura_auth_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 1. Guard against non-OK statuses and handle missing backend routes (404/500 HTML pages)
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Authentication expired. Please log in again.');
    }
    
    if (isJson) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Server error (${response.status})`);
    }

    throw new Error(`Endpoint "${endpoint}" returned non-JSON (${response.status}). Is the route created on your backend?`);
  }

  // 2. Guard against invalid JSON content types on HTTP 200
  if (!isJson) {
    throw new Error(`Unexpected response format from "${endpoint}". Expected JSON but received HTML/Text.`);
  }

  return response.json();
};

const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('manage');
  const tabs: AdminTab[] = ['manage', 'add', 'sold', 'inventory'];

  // Data State
  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('tech');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Dashboard Data Safely
  const fetchData = useCallback(async () => {
    if (tab === 'add') return;

    setLoading(true);
    setError(null);

    try {
      if (tab === 'sold') {
        // GET /api/admin/orders
        const data = await safeApiFetch<any>('http://localhost:4000/api/admin/orders');
        const orderList = Array.isArray(data) ? data : data?.items || data?.orders || [];
        setOrders(orderList);
      } else {
        // GET /api/admin/inventory OR GET /api/products
        const endpoint = tab === 'inventory' ? 'http://localhost:4000/api/admin/inventory' : 'http://localhost:4000/api/products';
        const data = await safeApiFetch<any>(endpoint);
        const itemList = Array.isArray(data) ? data : data?.items || data?.products || [];
        setItems(itemList);
      }
    } catch (err: any) {
      console.warn(`[AdminDashboard] Fetch error for tab "${tab}":`, err.message);
      setError(err.message);
      // Fallback arrays prevent UI crash
      setItems([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // POST /api/admin/products
  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await safeApiFetch('http://localhost:4000/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          price: parseFloat(price),
          stock: parseInt(stock, 10),
        }),
      });

      // Reset form on success
      setTitle('');
      setPrice('');
      setStock('10');
      setTab('manage');
    } catch (err: any) {
      setError(err.message || 'Failed to create product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // DELETE /api/admin/products/:id
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await safeApiFetch(`http://localhost:4000/api/admin/products/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete product.');
    }
  };

  // PUT /api/admin/products/:id/stock
  const handleSetStock = async (id: string) => {
    const input = prompt('Enter new stock quantity:');
    if (input === null || input.trim() === '') return;

    try {
      await safeApiFetch(`http://localhost:4000/api/admin/products/${id}/stock`, {
        method: 'PUT',
        body: JSON.stringify({ stock: parseInt(input, 10) }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update stock.');
    }
  };

  // PUT /api/admin/products/:id/discount
  const handleSetDiscount = async (id: string) => {
    const input = prompt('Enter discount percentage (0 - 100):');
    if (input === null || input.trim() === '') return;

    try {
      await safeApiFetch(`http://localhost:4000/api/admin/products/${id}/discount`, {
        method: 'PUT',
        body: JSON.stringify({ discountPercentage: parseFloat(input) }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update discount.');
    }
  };

  // PATCH /api/admin/orders/:id/status
  const handleUpdateOrderStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus = prompt(
      'Enter new status (pending, processing, shipped, delivered, cancelled):',
      currentStatus
    );
    if (!nextStatus || nextStatus === currentStatus) return;

    try {
      await safeApiFetch(`http://localhost:4000/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update order status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Controls */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3 text-xs font-medium">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md capitalize transition ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Warning/Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-lg text-xs flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => fetchData()}
            className="ml-4 bg-red-500/20 hover:bg-red-500/30 px-2.5 py-1 rounded text-[11px] text-red-300 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        {/* TAB 1: ADD PRODUCT */}
        {tab === 'add' && (
          <form onSubmit={handleAddProduct} className="max-w-md space-y-3 text-xs">
            <h3 className="font-semibold text-sm text-slate-100 mb-2">Add New Catalog Product</h3>
            <div>
              <label className="block text-slate-400 mb-1">Product Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"
              >
                <option value="tech">Tech & Electronics</option>
                <option value="fashion">Apparel & Accessories</option>
                <option value="home">Home & Living</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Initial Stock</label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Entry'}
            </button>
          </form>
        )}

        {/* TAB 2: ORDERS (SOLD) */}
        {tab === 'sold' && (
          <div className="overflow-x-auto">
            <h3 className="font-semibold text-sm text-slate-100 mb-4">Customer Orders</h3>
            {loading ? (
              <p className="text-xs text-slate-400">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-xs text-slate-400">No orders found.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 font-medium">
                    <th className="py-2.5">Order ID</th>
                    <th className="py-2.5">Customer</th>
                    <th className="py-2.5">Total</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {orders.map((ord) => (
                    <tr key={ord.id}>
                      <td className="py-3 font-mono text-slate-400">#{ord.id}</td>
                      <td className="py-3 text-slate-200">{ord.userEmail || ord.customerName || 'Customer'}</td>
                      <td className="py-3 font-semibold text-emerald-400">
                        ₹{Number(ord.total || 0).toFixed(2)}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[11px] capitalize">
                          {ord.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, ord.status)}
                          className="text-indigo-400 hover:underline"
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3 & 4: MANAGE & INVENTORY */}
        {(tab === 'manage' || tab === 'inventory') && (
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-xs text-slate-400">Loading catalog items...</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-slate-400">No catalog items available.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 font-medium">
                    <th className="py-2.5">Item ID</th>
                    <th className="py-2.5">Title</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5">Stock</th>
                    <th className="py-2.5">Price</th>
                    <th className="py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 font-mono text-slate-400">#{item.id}</td>
                      <td className="py-3 font-medium text-slate-200">{item.title}</td>
                      <td className="py-3 text-slate-400 capitalize">{item.category}</td>
                      <td className="py-3 text-emerald-400">{item.stock ?? 0} in stock</td>
                      <td className="py-3 font-medium text-slate-200">
                        ₹{Number(item.price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 space-x-3">
                        <button
                          onClick={() => handleSetStock(item.id)}
                          className="text-amber-400 hover:underline"
                        >
                          Set Stock
                        </button>
                        <button
                          onClick={() => handleSetDiscount(item.id)}
                          className="text-indigo-400 hover:underline"
                        >
                          Discount
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(item.id)}
                          className="text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;