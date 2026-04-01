export type UserRole = 'admin' | 'manager' | 'cashier' | 'salesperson' | 'audit';

export type OrderStatus = 'draft' | 'sent' | 'confirmed' | 'cancelled' | 'returned';

export interface Branch {
  id: string;
  name: string;
  location?: string;
  is_active: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  branch_id?: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  price_buy?: number;
  price_sell_before: number;
  price_sell_after?: number;
  stock_quantity: number;
  min_stock_level: number;
  category?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: number;
  branch_id: string;
  salesperson_id: string;
  cashier_id?: string;
  status: OrderStatus;
  total_original_price: number;
  total_discount: number;
  total_final_price: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
}

export const BRANCHES = [
  'فرع فيصل الرئيسي',
  'فرع الهرم',
  'فرع المعادي',
  'فرع التجمع الخامس',
  'فرع الجيزة',
  'فرع الشيخ زايد',
  'فرع أكتوبر',
  'فرع مصر الجديدة',
  'فرع حدائق الأهرام'
];
