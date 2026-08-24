export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number; // Pre-discount price
  discountPercent: number;
  finalPrice: number; // Struck-through price/what customer pays
  imageUrl: string;
  stock: number | null;
  rating: number;
  ratingCount: number;
  mrp: number;
}

export interface PaginatedProductsResponse {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
}

export interface CatalogCategory {
  id: string;
  name: string;
  description: string;
  itemCount: number;
}

export type AdminTab = 'manage' | 'add' | 'sold' | 'inventory';
export type UserRole = 'customer' | 'admin';