import React, { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { type UserRole } from '../types';

const Login: React.FC = () => {
  const [role, setRole] = useState<UserRole>('customer');
  const navigate = useNavigate();

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/customer');
    }
  };

  return (
    <div className="max-w-sm mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
      {/* Role Toggle Switch */}
      <div className="flex bg-slate-100 p-1 rounded-lg mb-6 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setRole('customer')}
          className={`flex-1 py-1.5 rounded-md transition ${role === 'customer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          Customer Login
        </button>
        <button
          type="button"
          onClick={() => setRole('admin')}
          className={`flex-1 py-1.5 rounded-md transition ${role === 'admin' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}
        >
          Admin Login
        </button>
      </div>

      <h2 className="text-lg font-semibold text-center mb-1 text-slate-900">
        {role === 'admin' ? 'Admin Portal Access' : 'Welcome Back'}
      </h2>
      <p className="text-xs text-slate-500 text-center mb-6">
        {role === 'admin' ? 'Enter administrative credentials' : 'Sign in to access your orders'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-600 mb-1">{role === 'admin' ? 'Admin Email' : 'Email'}</label>
          <input 
            type="email" 
            className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-indigo-600" 
            placeholder={role === 'admin' ? 'admin@aura.com' : 'user@example.com'} 
            required 
          />
        </div>
        <div>
          <label className="block text-slate-600 mb-1">Password</label>
          <input type="password" className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-indigo-600" placeholder="••••••••" required />
        </div>
        <button 
          type="submit" 
          className={`w-full py-2.5 rounded-lg font-medium text-xs text-white transition ${
            role === 'admin' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-slate-800'
          }`}
        >
          {role === 'admin' ? 'Authenticate as Admin' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default Login;