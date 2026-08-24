import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Outlet } from 'react-router';
import Home from './pages/Home';
import Search from './pages/Search';
import CatalogOverview from './pages/CatalogOverview';
import CategoryCatalog from './pages/CategoryCatalog';
import ProductDetails from './pages/ProductDetails';
import Checkout from './pages/Checkout';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import CustomerDetails from './pages/CustomerDetails';
import { Chatbot } from './components/Chatbot';
import { AppProvider } from './context/AppContext';

const CustomerLayout: React.FC = () => (
  <AppProvider>
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-tight text-slate-900">
            AURA<span className="text-indigo-600">.</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-indigo-600 transition">Home</Link>
            <Link to="/search" className="hover:text-indigo-600 transition">Search</Link>
            <Link to="/products" className="hover:text-indigo-600 transition">Catalogs</Link>
            <Link to="/customer" className="hover:text-indigo-600 transition">Account</Link>
            <Link to="/login" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-xs font-semibold">Login</Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>

      <Chatbot/>
    </div>
  </AppProvider>
);

// Completely Separate Layout for Admin Interface
const AdminLayout: React.FC = () => (
  <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
    <header className="bg-slate-800 border-b border-slate-700 h-16 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <span className="text-lg font-bold tracking-tight text-white">AURA</span>
        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded">Admin Control Panel</span>
      </div>
      <Link to="/login" className="text-xs text-slate-400 hover:text-white transition">Exit Admin</Link>
    </header>
    <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
      <Outlet />
    </main>
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Regular User Routes */}
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/products" element={<CatalogOverview />} />
          <Route path="/products/:category" element={<CategoryCatalog />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/customer" element={<CustomerDetails />} />
        </Route>

        {/* Isolated Admin Routes */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;