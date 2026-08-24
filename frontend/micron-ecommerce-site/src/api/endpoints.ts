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


export const getAdminInventory = () => apiFetch<InventoryResponse>('/api/admin/inventory');

export const getAdminOrders = () => apiFetch<OrderListResponse>('/api/admin/orders');


  // src/api/endpoints.ts

const getAuthHeader = () => {
  const token = localStorage.getItem('aura_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export async function fetchAdminProducts() {
  const response = await fetch('/api/products', { headers: getAuthHeader() });
  if (!response.ok) throw new Error('Failed to fetch products');
  return response.json();
}

export async function fetchAdminInventory() {
  const response = await fetch('/api/admin/inventory', { headers: getAuthHeader() });
  if (!response.ok) throw new Error('Failed to fetch inventory');
  return response.json();
}

export async function fetchAdminOrders() {
  const response = await fetch('/api/admin/orders', { headers: getAuthHeader() });
  if (!response.ok) throw new Error('Failed to fetch orders');
  return response.json();
}

export async function createProduct(payload: { title: string; category: string; price: number; stock: number }) {
  const response = await fetch('/api/admin/products', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to create product');
  return response.json();
}

export async function deleteProduct(id: string) {
  const response = await fetch(`/api/admin/products/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error('Failed to delete product');
  return response.json();
}

export async function setStock(id: string, stock: number) {
  const response = await fetch(`/api/admin/products/${id}/stock`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ stock }),
  });
  if (!response.ok) throw new Error('Failed to update stock');
  return response.json();
}

export async function setDiscount(id: string, discountPercentage: number) {
  const response = await fetch(`/api/admin/products/${id}/discount`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ discountPercentage }),
  });
  if (!response.ok) throw new Error('Failed to set discount');
  return response.json();
}

export async function updateOrderStatus(id: string, status: string) {
  const response = await fetch(`/api/admin/orders/${id}/status`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Failed to update order status');
  return response.json();
}