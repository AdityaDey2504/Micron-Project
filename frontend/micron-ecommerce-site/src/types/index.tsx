export interface Product {
  id: number;
  title: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  description: string;
  itemCount: number;
}

export type AdminTab = 'manage' | 'add' | 'sold' | 'inventory';
export type UserRole = 'customer' | 'admin';