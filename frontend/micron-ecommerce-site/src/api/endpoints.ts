import { apiFetch } from './client';
import type {
  ProductListResponse,
  CategoryListResponse,
  ProductDetailResponse,
  SearchResponse,
  AuthResponse,
  MeResponse,
  CartItemInput,
  CartPriceResponse,
  CartOptimizeResponse,
  CheckoutResponse,
  OrderListResponse,
  OrderDetailResponse,
  ChatRequest,
  ChatResponse,
  StockUpdateResponse,
  DeleteResponse,
  Product,
  InventoryResponse,
  Order
} from '../types/api-types';

// Public Product Endpoints
export const getProducts = (params?: Record<string, string | number | boolean>) => {
  const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return apiFetch<ProductListResponse>(`/api/products${query}`);
};

export const getCategories = () => apiFetch<CategoryListResponse>('/api/products/categories');

export const getDiscountedProducts = (params?: { limit?: number; offset?: number }) => {
  const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return apiFetch<ProductListResponse>(`/api/products/discounted${query}`);
};

export const searchProductsRanked = (q: string) => 
  apiFetch<SearchResponse>(`/api/products/search?q=${encodeURIComponent(q)}`);

export const getProductById = (id: string) => 
  apiFetch<ProductDetailResponse>(`/api/products/${id}`);

// Auth Endpoints
export const registerUser = (body: { name: string; email: string; password?: string }) =>
  apiFetch<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });

export const loginUser = (body: { email: string; password?: string }) =>
  apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });

export const getMe = () => apiFetch<MeResponse>('/api/auth/me');

// Cart Endpoints
export const calculateCartPrice = (items: CartItemInput[]) =>
  apiFetch<CartPriceResponse>('/api/cart/price', { method: 'POST', body: JSON.stringify({ items }) });

export const optimizeCart = (items: CartItemInput[]) =>
  apiFetch<CartOptimizeResponse>('/api/cart/optimize', { method: 'POST', body: JSON.stringify({ items }) });

// Order Endpoints
export const getUserOrders = () => apiFetch<OrderListResponse>('/api/orders');

export const getOrderById = (id: string) => apiFetch<OrderDetailResponse>(`/api/orders/${id}`);

export const checkoutOrder = (items: CartItemInput[]) =>
  apiFetch<CheckoutResponse>('/api/orders/checkout', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });

// Chat Endpoint
export const sendChatMessage = (payload: ChatRequest) =>
  apiFetch<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify(payload) });

// Admin Endpoints
export const updateProductStock = (id: string, stock: number) =>
  apiFetch<StockUpdateResponse>(`/api/admin/products/${id}/stock`, {
    method: 'PUT',
    body: JSON.stringify({ stock }),
  });

export const deleteProduct = (id: string) =>
  apiFetch<DeleteResponse>(`/api/admin/products/${id}`, { method: 'DELETE' });

export const getAdminInventory = () => apiFetch<InventoryResponse>('/api/admin/inventory');

export const getAdminOrders = () => apiFetch<OrderListResponse>('/api/admin/orders');

export const updateOrderStatus = (id: string, status: string) =>
  apiFetch<Order>(`/api/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });