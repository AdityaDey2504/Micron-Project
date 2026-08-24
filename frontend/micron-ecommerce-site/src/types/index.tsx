export interface Product {
  id: number;
  title: string;
  price: number;
  category?: string;
  imageUrl?: string;
  description?: string;
}

export interface Order {
  id: string;
  date: string;
  total: number;
  itemsCount: number;
  status: 'Delivered' | 'Processing' | 'Shipped';
}

export type AdminTab = 'manage' | 'add' | 'sold' | 'inventory';