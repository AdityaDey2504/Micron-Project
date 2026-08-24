import React, { type SubmitEvent } from 'react';

const Login: React.FC = () => {
  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <div className="max-w-sm mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-8">
      <h2 className="text-lg font-semibold text-center mb-6">Welcome Back</h2>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-600 mb-1">Email</label>
          <input type="email" className="w-full border border-slate-200 rounded-lg p-2.5 outline-none" placeholder="user@example.com" required />
        </div>
        <div>
          <label className="block text-slate-600 mb-1">Password</label>
          <input type="password" className="w-full border border-slate-200 rounded-lg p-2.5 outline-none" placeholder="••••••••" required />
        </div>
        <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium text-xs hover:bg-slate-800 transition">
          Sign In
        </button>
      </form>
    </div>
  );
};

export default Login;