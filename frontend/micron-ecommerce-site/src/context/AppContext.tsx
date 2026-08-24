import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CartItemInput, CartPriceResponse, User } from '../types/api-types';
import { calculateCartPrice, getMe } from '../api/endpoints';

interface AppContextType {
  cart: CartItemInput[];
  cartPrice: CartPriceResponse | null;
  user: User | null;
  token: string | null;
  addToCart: (productId: string, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  refreshCartPrice: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItemInput[]>(() => {
    const saved = localStorage.getItem('aura_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [cartPrice, setCartPrice] = useState<CartPriceResponse | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('aura_auth_token'));

  useEffect(() => {
    localStorage.setItem('aura_cart', JSON.stringify(cart));
    refreshCartPrice();
  }, [cart]);

  useEffect(() => {
    if (token && !user) {
      getMe()
        .then((res) => setUser(res.user))
        .catch(() => logout());
    }
  }, [token]);

  const refreshCartPrice = async () => {
    if (cart.length === 0) {
      setCartPrice(null);
      return;
    }
    try {
      const details = await calculateCartPrice(cart);
      setCartPrice(details);
    } catch (err) {
      console.error('Failed to update cart pricing', err);
    }
  };

  const addToCart = (productId: string, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { productId, quantity }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => setCart([]);

  const setAuth = (newToken: string, newUser: User) => {
    localStorage.setItem('aura_auth_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('aura_auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AppContext.Provider
      value={{
        cart,
        cartPrice,
        user,
        token,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        setAuth,
        logout,
        refreshCartPrice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};