import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router';
import Home from './pages/Home';
import Search from './pages/Search';
import ProductCatalog from './pages/ProductCatalog';
import ProductDetails from './pages/ProductDetails';
import Checkout from './pages/Checkout';
import Admin from './pages/Admin';
import Login from './pages/Login';
import CustomerDetails from './pages/CustomerDetails';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
        {/* Navbar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link to="/" className="text-xl font-semibold tracking-tight text-slate-900">
              AURA<span className="text-indigo-600">.</span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium text-slate-600">
              <Link to="/" className="hover:text-indigo-600 transition">Home</Link>
              <Link to="/search" className="hover:text-indigo-600 transition">Search</Link>
              <Link to="/products" className="hover:text-indigo-600 transition">Catalog</Link>
              <Link to="/admin" className="hover:text-indigo-600 transition">Admin</Link>
              <Link to="/customer" className="hover:text-indigo-600 transition">Account</Link>
              <Link to="/login" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-xs font-semibold">Login</Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/products" element={<ProductCatalog />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/customer" element={<CustomerDetails />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;