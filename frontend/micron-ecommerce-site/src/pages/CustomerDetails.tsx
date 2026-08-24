import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { getUserOrders } from '../api/endpoints';
import type { Order } from '../types/api-types';

export const CustomerDetails: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useApp();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!token && !user) {
      navigate('/login');
      return;
    }

    setLoadingOrders(true);
    getUserOrders()
      .then((response) => {
        setOrders(response.items || []);
      })
      .catch((err) => setOrderError(err.message || 'Failed to load order history'))
      .finally(() => setLoadingOrders(false));
  }, [token, user, navigate]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-slate-500">
        Loading account details...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Account Header */}
      <div className="flex justify-between items-center bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{user.name || 'Customer Account'}</h1>
          <p className="text-slate-500 text-sm">{user.email}</p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition"
        >
          Sign Out
        </button>
      </div>

      {/* Account Details */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 text-xs block">Full Name</span>
            <span className="font-semibold text-slate-800">{user.name || 'N/A'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 text-xs block">Email Address</span>
            <span className="font-semibold text-slate-800">{user.email}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 text-xs block">Role</span>
            <span className="font-semibold text-indigo-600 capitalize">{user.role || 'Customer'}</span>
          </div>
        </div>
      </div>

      {/* Order History */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Order History</h2>

        {loadingOrders ? (
          <div className="text-xs text-slate-400 py-4 animate-pulse">Loading orders...</div>
        ) : orderError ? (
          <div className="text-xs text-red-500 py-2">{orderError}</div>
        ) : orders.length === 0 ? (
          <div className="text-sm text-slate-500 py-4">
            No past orders found.{' '}
            <Link to="/" className="text-indigo-600 font-medium hover:underline">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-sm text-slate-800">Order #{order.id}</p>
                  <p className="text-xs text-slate-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Recent'} •{' '}
                    {order.items?.length || 0} items
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-600 text-sm">₹{order.total}</p>
                  <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full capitalize">
                    {order.status || 'Completed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};